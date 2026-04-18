import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  await pool.query(schemaSql);
  console.log("Database schema initialized.");
  await pool.end();
}

main().catch(async (error) => {
  console.error("Failed to initialize database schema", error);
  await pool.end();
  process.exit(1);
});
