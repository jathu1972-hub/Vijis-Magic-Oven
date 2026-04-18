import pg from "pg";

import { env } from "../config/env.js";

const { Pool, types } = pg;

types.setTypeParser(1700, (value) => Number(value));

export const pool = new Pool({
  connectionString: env.dbUrl,
  ssl: env.isProduction ? { rejectUnauthorized: false } : false
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error", error);
});
