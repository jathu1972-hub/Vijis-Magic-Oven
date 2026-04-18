import bcrypt from "bcrypt";

import { pool } from "./pool.js";

const OWNER_NAME = process.env.OWNER_NAME;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

async function main() {
  if (!OWNER_NAME || !OWNER_EMAIL || !OWNER_PASSWORD) {
    throw new Error("OWNER_NAME, OWNER_EMAIL, and OWNER_PASSWORD must be set before seeding the owner account.");
  }

  const existingOwner = await pool.query(
    "SELECT id, email FROM users WHERE role = 'OWNER' LIMIT 1"
  );

  if (existingOwner.rowCount > 0) {
    console.log(`Owner already exists: ${existingOwner.rows[0].email}`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);

  await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, LOWER($2), $3, 'OWNER')
    `,
    [OWNER_NAME.trim(), OWNER_EMAIL.trim(), passwordHash]
  );

  console.log(`Owner account seeded for ${OWNER_EMAIL}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error("Failed to seed owner account", error);
  await pool.end();
  process.exit(1);
});
