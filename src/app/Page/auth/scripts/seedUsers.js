require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

/** @deprecated Use `pnpm seed:admin` (scripts/seed-super-admin.js) instead. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const users = [
    { name: "Super Admin", email: "superadmin@example.com", password: "superpass", role: "super_admin" },
    { name: "Rian Reviewer", email: "reviewer@example.com", password: "reviewerpass", role: "reviewer" },
    { name: "Budi User", email: "user@example.com", password: "userpass", role: "user" },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO public.users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())
       ON CONFLICT (email) DO NOTHING;`,
      [u.name, u.email.toLowerCase(), hash, u.role]
    );
    console.log("Upserted:", u.email);
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
