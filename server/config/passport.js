import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "../db/pool.js";
import { env } from "./env.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.googleClientId,
      clientSecret: env.googleClientSecret,
      callbackURL: env.googleCallbackUrl,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        if (!email) return done(new Error("No email from Google"));

        const existing = await pool.query(
          "SELECT * FROM users WHERE email = $1 LIMIT 1",
          [email]
        );

        if (existing.rowCount > 0) {
          return done(null, existing.rows[0]);
        }

        const inserted = await pool.query(
          `INSERT INTO users (name, email, password_hash, role)
           VALUES ($1, $2, $3, 'CUSTOMER')
           RETURNING *`,
          [name, email, "GOOGLE_OAUTH"]
        );

        return done(null, inserted.rows[0]);
      } catch (error) {
        return done(error);
      }
    }
  )
);

export default passport;
