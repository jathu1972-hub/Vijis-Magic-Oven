import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";

export const verifyToken = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  let payload;

  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (_error) {
    res.status(401).json({ message: "Your session is invalid or expired." });
    return;
  }

  const userResult = await pool.query(
    `
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [payload.sub]
  );

  if (userResult.rowCount === 0) {
    res.status(401).json({ message: "User account no longer exists." });
    return;
  }

  req.user = userResult.rows[0];
  next();
});

export function verifyOwnerRole(req, res, next) {
  if (req.user?.role !== "OWNER") {
    res.status(403).json({ message: "Owner access required." });
    return;
  }

  next();
}

export function verifyCustomerRole(req, res, next) {
  if (req.user?.role !== "CUSTOMER") {
    res.status(403).json({ message: "Customer access required." });
    return;
  }

  next();
}
