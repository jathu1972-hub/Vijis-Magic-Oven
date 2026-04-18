import path from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import cakeRoutes from "./routes/cake.routes.js";
import orderRoutes from "./routes/order.routes.js";
import { verifyCsrf } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, "../client");

const app = express();

app.disable("x-powered-by");

if (env.isProduction) {
  app.set("trust proxy", 1);
}

/* ── Security headers ─────────────────────────────── */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: env.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

/* ── CORS ─────────────────────────────────────────── */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === env.clientOrigin) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);

/* ── Global rate limiter (all routes) ────────────── */
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please slow down." },
  })
);

/* ── Body parsing + compression ───────────────────── */
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(verifyCsrf);

/* ── Health check ─────────────────────────────────── */
app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "vijis-magic-oven-api" });
});

/* ── API Routes ───────────────────────────────────── */
app.use("/auth", authRoutes);
app.use("/cakes", cakeRoutes);
app.use("/orders", orderRoutes);

/* ── Static client files ──────────────────────────── */
app.use(express.static(clientDir));

app.get("/owner-login", (_req, res) => {
  res.sendFile(path.join(clientDir, "owner.html"));
});

// SPA fallback — serve index.html for all non-API unmatched routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

/* ── Error handlers ───────────────────────────────── */
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
