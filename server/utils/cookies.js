import { env } from "../config/env.js";

function durationToMilliseconds(duration) {
  const match = /^(\d+)([smhd])$/i.exec(duration);
  if (!match) {
    return 12 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return value * multipliers[unit];
}

const baseCookieOptions = {
  sameSite: "none",
  secure: true,
  path: "/"
};

export const csrfCookieOptions = {
  ...baseCookieOptions,
  httpOnly: false,
  maxAge: durationToMilliseconds(env.jwtExpiresIn)
};

export function setAuthCookie(res, token) {
  res.cookie("auth_token", token, {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: durationToMilliseconds(env.jwtExpiresIn)
  });
}

export function clearAuthCookie(res) {
  res.clearCookie("auth_token", {
    ...baseCookieOptions,
    httpOnly: true
  });
}
