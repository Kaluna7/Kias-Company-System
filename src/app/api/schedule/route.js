export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pkg from "pg";
const { Pool } = pkg;

// Reuse global pool to avoid too many clients in dev/serverless
if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}
const pool = global._pgPool;

const SELECT_COLUMNS = [
  "id",
  "module_key",
  "department_id",
  "department_name",
  "user_id",
  "user_name",
  "is_configured",
  "start_date",
  "end_date",
  "days",
  "created_at",
  "updated_at",
].join(", ");

async function ensureModuleTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schedule_module_feedback (
      id SERIAL PRIMARY KEY,
      module_key VARCHAR(32) NOT NULL,
      department_id VARCHAR(20) NOT NULL,
      department_name VARCHAR(255),
      user_id VARCHAR(64),
      user_name VARCHAR(255),
      is_configured BOOLEAN NOT NULL DEFAULT FALSE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(module_key, department_id)
    );
  `);
  await client.query(`ALTER TABLE public.schedule_module_feedback ADD COLUMN IF NOT EXISTS is_configured BOOLEAN NOT NULL DEFAULT FALSE;`);
}

async function migrateLegacyIfNeeded(client) {
  const regLegacy = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_preparer_feedback"]);
  if (!regLegacy?.rows?.[0]?.t) return;

  await ensureModuleTable(client);
  const hasSop = await client.query(`SELECT 1 FROM public.schedule_module_feedback WHERE module_key='sop-review' LIMIT 1`);
  if ((hasSop?.rowCount ?? 0) > 0) return;

  const legacy = await client.query(
    `SELECT department_id, department_name, user_id, user_name, incharge_modules, start_date, end_date, days
     FROM public.schedule_preparer_feedback`
  );
  for (const row of legacy.rows || []) {
    let modules = row.incharge_modules;
    if (typeof modules === "string") {
      try { modules = JSON.parse(modules); } catch { modules = ["all"]; }
    }
    const list = Array.isArray(modules) ? modules.map((m) => String(m || "").trim()) : ["all"];
    const allow = list.includes("all") || list.includes("sop-review");
    if (!allow) continue;

    await client.query(
      `
      INSERT INTO public.schedule_module_feedback
        (module_key, department_id, department_name, user_id, user_name, is_configured, start_date, end_date, days, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
      ON CONFLICT (module_key, department_id)
      DO UPDATE SET
        department_name = EXCLUDED.department_name,
        user_id = EXCLUDED.user_id,
        user_name = EXCLUDED.user_name,
        is_configured = public.schedule_module_feedback.is_configured,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        days = EXCLUDED.days,
        updated_at = NOW()
      `,
      [
        "sop-review",
        row.department_id,
        row.department_name || null,
        row.user_id || null,
        row.user_name || null,
        false,
        row.start_date,
        row.end_date,
        row.days,
      ]
    );
  }
}

// GET: retrieve schedule data
export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await migrateLegacyIfNeeded(client);

      // Check if new module table exists, else return empty
      const checkTable = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_module_feedback"]);
      if (!checkTable?.rows?.[0]?.t) {
        return NextResponse.json({ success: true, rows: [] }, { status: 200 });
      }

      // Back-compat: /api/schedule = SOP Review schedule only
      const q = `SELECT ${SELECT_COLUMNS} FROM public.schedule_module_feedback WHERE module_key='sop-review' ORDER BY department_id, id DESC`;
      const r = await client.query(q);
      return NextResponse.json({ success: true, rows: r.rows || [] }, { status: 200 });
    } catch (dbErr) {
      console.error("DB error SELECT schedule_module_feedback:", dbErr);
      return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Connection error GET /api/schedule:", err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}

// POST: insert or update schedule data
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      department_id,
      department_name,
      user_id,
      user_name,
      start_date,
      end_date,
    } = body || {};

    if (!department_id || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: department_id, start_date, end_date" },
        { status: 400 }
      );
    }

    // Calculate days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (days < 0) {
      return NextResponse.json(
        { success: false, error: "End date must be after start date" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await ensureModuleTable(client);

      // Upsert SOP Review schedule only (back-compat)
      const q = `
        INSERT INTO public.schedule_module_feedback 
          (module_key, department_id, department_name, user_id, user_name, is_configured, start_date, end_date, days, updated_at)
        VALUES 
          ('sop-review', $1, $2, $3, $4, TRUE, $5, $6, $7, NOW())
        ON CONFLICT (module_key, department_id) 
        DO UPDATE SET
          department_name = EXCLUDED.department_name,
          user_id = EXCLUDED.user_id,
          user_name = EXCLUDED.user_name,
          is_configured = TRUE,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          days = EXCLUDED.days,
          updated_at = NOW()
        RETURNING ${SELECT_COLUMNS}
      `;
      const vals = [
        department_id,
        department_name || null,
        user_id || null,
        user_name || null,
        start_date,
        end_date,
        days,
      ];
      const r = await client.query(q, vals);
      return NextResponse.json({ success: true, inserted: r.rows[0] }, { status: 200 });
    } catch (dbErr) {
      console.error("DB insert/update schedule_module_feedback failed:", dbErr);
      return NextResponse.json({ success: false, error: "DB insert/update failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Unexpected error POST /api/schedule:", err);
    return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
  }
}

