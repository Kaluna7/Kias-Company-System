/**
 * Local seed: create or reset the super admin account.
 *
 * Usage:
 *   pnpm seed:admin
 *
 * Optional env overrides (.env):
 *   SEED_SUPER_ADMIN_EMAIL=superadmin@kias.local
 *   SEED_SUPER_ADMIN_PASSWORD=SuperAdmin123!
 *   SEED_SUPER_ADMIN_NAME=Super Admin
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPER_ADMIN = {
  name: process.env.SEED_SUPER_ADMIN_NAME || "Super Admin",
  email: (process.env.SEED_SUPER_ADMIN_EMAIL || "superadmin@kias.local").toLowerCase().trim(),
  password: process.env.SEED_SUPER_ADMIN_PASSWORD || "SuperAdmin123!",
  role: "super_admin",
};

async function ensureUsersTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS temp_password_hash TEXT,
      ADD COLUMN IF NOT EXISTS temp_password_created_at TIMESTAMPTZ;
  `);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add it to .env first.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await ensureUsersTable(client);

    const hash = await bcrypt.hash(SUPER_ADMIN.password, 10);

    const result = await client.query(
      `INSERT INTO public.users (name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         temp_password_hash = NULL,
         temp_password_created_at = NULL,
         updated_at = NOW()
       RETURNING id, email, role, (xmax = 0) AS inserted;`,
      [SUPER_ADMIN.name, SUPER_ADMIN.email, hash, SUPER_ADMIN.role],
    );

    const row = result.rows[0];
    const action = row?.inserted ? "Created" : "Updated";

    console.log("");
    console.log(`${action} super admin account:`);
    console.log(`  Email   : ${SUPER_ADMIN.email}`);
    console.log(`  Password: ${SUPER_ADMIN.password}`);
    console.log(`  Role    : ${SUPER_ADMIN.role}`);
    console.log(`  User ID : ${row?.id || "(unknown)"}`);
    console.log("");
    console.log("Login at: http://localhost:3000/Page/auth");
    console.log("");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
