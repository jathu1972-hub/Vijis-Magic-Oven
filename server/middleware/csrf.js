import crypto from "node:crypto";

const csrfCookieOptions = {
  httpOnly: false,
  sameSite: "none",
  secure: true,
  path: "/",
  maxAge: 60 * 60 * 1000, // 1 hour
};

export function issueCsrfToken(_req, res) {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf_token", csrfToken, csrfCookieOptions);
  res.json({ csrfToken });
}

export function verifyCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.get("x-csrf-token");
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    res.status(403).json({ message: "CSRF token validation failed." });
    return;
  }
  next();
}
