import bcrypt from "bcrypt";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/auth.js";
import { issueCsrfToken } from "../middleware/csrf.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";
import { cleanText } from "../utils/sanitize.js";
import {
  loginValidation,
  registerValidation,
  validateRequest,
} from "../utils/validators.js";

const router = express.Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

/** Minimal JWT payload — only subject (user ID). Role is fetched from DB on each request. */
function signAuthToken(user) {
  return jwt.sign({}, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: env.jwtExpiresIn,
  });
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}

/** Check account lockout. Returns true if locked. */
async function isAccountLocked(userId) {
  const result = await pool.query(
    "SELECT locked_until FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );
  const lockedUntil = result.rows[0]?.locked_until;
  return lockedUntil && new Date(lockedUntil) > new Date();
}

/** Record a failed login attempt and lock after 5 failures. */
async function recordFailedLogin(userId) {
  await pool.query(
    `
      UPDATE users
      SET
        failed_logins = failed_logins + 1,
        locked_until = CASE
          WHEN failed_logins + 1 >= 5
          THEN NOW() + INTERVAL '30 minutes'
          ELSE locked_until
        END
      WHERE id = $1
    `,
    [userId]
  );
}

/** Reset failed login counter on successful auth. */
async function resetFailedLogins(userId) {
  await pool.query(
    "UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1",
    [userId]
  );
}

/* ── Routes ─────────────────────────────────────────── */

router.get("/csrf-token", issueCsrfToken);

router.get(
  "/me",
  verifyToken,
  asyncHandler(async (req, res) => {
    res.json({ user: safeUser(req.user) });
  })
);

router.post(
  "/register",
  loginRateLimiter,
  registerValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body.name, { maxLength: 80 });
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email]
    );
    if (existing.rowCount > 0) {
      res.status(409).json({ message: "An account with that email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await pool.query(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, 'CUSTOMER')
        RETURNING id, name, email, role, created_at
      `,
      [name, email, passwordHash]
    );

    const user = inserted.rows[0];
    const token = signAuthToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ message: "Account created successfully.", user: safeUser(user) });
  })
);

router.post(
  "/login",
  loginRateLimiter,
  loginValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const userResult = await pool.query(
      `
        SELECT id, name, email, password_hash, role, created_at, locked_until
        FROM users
        WHERE email = $1 AND role = 'CUSTOMER'
        LIMIT 1
      `,
      [email]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    const user = userResult.rows[0];

    // Check lockout before comparing password (avoid bcrypt timing on locked accounts)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(423).json({
        message: "Account temporarily locked due to multiple failed attempts. Try again in 30 minutes.",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      await recordFailedLogin(user.id);
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    await resetFailedLogins(user.id);
    const token = signAuthToken(user);
    setAuthCookie(res, token);
    res.json({ message: "Login successful.", user: safeUser(user) });
  })
);

router.post(
  "/owner-login",
  loginRateLimiter,
  loginValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const ownerResult = await pool.query(
      `
        SELECT id, name, email, password_hash, role, created_at, locked_until
        FROM users
        WHERE email = $1 AND role = 'OWNER'
        LIMIT 1
      `,
      [email]
    );

    if (ownerResult.rowCount === 0) {
      res.status(401).json({ message: "Invalid owner credentials." });
      return;
    }

    const owner = ownerResult.rows[0];

    if (owner.locked_until && new Date(owner.locked_until) > new Date()) {
      res.status(423).json({
        message: "Owner account temporarily locked. Try again in 30 minutes.",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, owner.password_hash);
    if (!passwordMatches) {
      await recordFailedLogin(owner.id);
      res.status(401).json({ message: "Invalid owner credentials." });
      return;
    }

    await resetFailedLogins(owner.id);
    const token = signAuthToken(owner);
    setAuthCookie(res, token);
    res.json({ message: "Owner login successful.", user: safeUser(owner) });
  })
);

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out successfully." });
});

export default router;
