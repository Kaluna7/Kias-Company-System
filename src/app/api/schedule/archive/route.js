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

const ALLOWED_MODULES = new Set(["sop-review", "worksheet", "audit-finding", "evidence"]);
const ALL_MODULE_KEYS = ["sop-review", "worksheet", "audit-finding", "evidence"];

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schedule_archive (
      id SERIAL PRIMARY KEY,
      module_key VARCHAR(32) NOT NULL,
      department_id VARCHAR(20),
      scope VARCHAR(16) NOT NULL DEFAULT 'department', -- 'module' or 'department'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(module_key, department_id)
    );
  `);

  // Ensure uniqueness for module scope even when department_id is NULL (Postgres allows multiple NULLs in UNIQUE)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS schedule_archive_module_unique
    ON public.schedule_archive (module_key)
    WHERE scope = 'module';
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS schedule_archive_department_unique
    ON public.schedule_archive (module_key, department_id)
    WHERE scope = 'department';
  `);
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const moduleKey = String(url.searchParams.get("module") || "").trim();

    const client = await pool.connect();
    try {
      const reg = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_archive"]);
      if (!reg?.rows?.[0]?.t) return NextResponse.json({ success: true, rows: [] }, { status: 200 });

      const where = [];
      const vals = [];
      if (moduleKey) {
        if (!ALLOWED_MODULES.has(moduleKey)) {
          return NextResponse.json({ success: false, error: "Invalid module" }, { status: 400 });
        }
        vals.push(moduleKey);
        where.push(`module_key = $${vals.length}`);
      }
      const q = `
        SELECT id, module_key, department_id, scope, created_at
        FROM public.schedule_archive
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY created_at DESC
      `;
      const r = await client.query(q, vals);
      return NextResponse.json({ success: true, rows: r.rows || [] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/schedule/archive error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const module_key = String(body?.module_key || "").trim();
    const scope = String(body?.scope || "module").trim(); // default module archive
    const department_id = body?.department_id ? String(body.department_id).trim() : null;

    if (!ALLOWED_MODULES.has(module_key)) {
      return NextResponse.json({ success: false, error: "Invalid module_key" }, { status: 400 });
    }
    if (scope !== "module" && scope !== "department") {
      return NextResponse.json({ success: false, error: "Invalid scope" }, { status: 400 });
    }
    if (scope === "department" && !department_id) {
      return NextResponse.json({ success: false, error: "department_id required for scope=department" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await ensureTable(client);

      let r;
      if (scope === "module") {
        // Archive the module
        r = await client.query(
          `
          INSERT INTO public.schedule_archive (module_key, department_id, scope)
          VALUES ($1, NULL, 'module')
          ON CONFLICT (module_key) WHERE scope = 'module'
          DO UPDATE SET scope = EXCLUDED.scope
          RETURNING id, module_key, department_id, scope, created_at
          `,
          [module_key]
        );
        
        // Delete all schedule_module_feedback entries for this module
        const moduleTableCheck = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_module_feedback"]);
        if (moduleTableCheck?.rows?.[0]?.t) {
          await client.query(
            `DELETE FROM public.schedule_module_feedback WHERE module_key = $1`,
            [module_key]
          );
          console.log(`Deleted all schedule_module_feedback entries for module: ${module_key}`);
        }
        
        // Remove module from all schedule_main entries (remove from incharge_modules and module_dates)
        const mainTableCheck = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_main"]);
        if (mainTableCheck?.rows?.[0]?.t) {
          // Get all main schedule entries
          const mainRows = await client.query(`SELECT department_name, incharge_modules, module_dates FROM public.schedule_main`);
          
          for (const row of mainRows.rows || []) {
            let inchargeModules = Array.isArray(row.incharge_modules)
              ? row.incharge_modules
              : typeof row.incharge_modules === "string"
                ? (() => { try { return JSON.parse(row.incharge_modules); } catch { return []; } })()
                : [];
            
            // Remove module from incharge_modules.
            // If "all" is selected, convert it into explicit remaining modules except the archived one.
            if (inchargeModules.includes("all")) {
              inchargeModules = ALL_MODULE_KEYS.filter((m) => m !== module_key);
            } else {
              inchargeModules = inchargeModules.filter((m) => m !== module_key);
            }
            
            // Remove module from module_dates (always remove, even if "all" is selected)
            let moduleDates = {};
            if (row.module_dates) {
              try {
                const parsed = typeof row.module_dates === "string" ? JSON.parse(row.module_dates) : row.module_dates;
                if (parsed && typeof parsed === "object") {
                  for (const [key, value] of Object.entries(parsed)) {
                    if (key !== module_key) {
                      moduleDates[key] = value;
                    }
                  }
                }
              } catch (e) {
                console.error("Error parsing module_dates:", e);
              }
            }
            
            // Update schedule_main
            await client.query(
              `UPDATE public.schedule_main
               SET incharge_modules = $1::jsonb,
                   module_dates = $2::jsonb,
                   updated_at = NOW()
               WHERE department_name = $3`,
              [JSON.stringify(inchargeModules), JSON.stringify(moduleDates), row.department_name]
            );
          }
          console.log(`Removed module ${module_key} from all schedule_main entries`);
        }
      } else {
        r = await client.query(
          `
          INSERT INTO public.schedule_archive (module_key, department_id, scope)
          VALUES ($1, $2, 'department')
          ON CONFLICT (module_key, department_id) WHERE scope = 'department'
          DO UPDATE SET scope = EXCLUDED.scope
          RETURNING id, module_key, department_id, scope, created_at
          `,
          [module_key, department_id]
        );
      }
      return NextResponse.json({ success: true, row: r.rows?.[0] ?? null }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /api/schedule/archive error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


