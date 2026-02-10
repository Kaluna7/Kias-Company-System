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
  "department_name",
  "incharge_modules",
  "start_date",
  "end_date",
  "days",
  "module_dates",
  "created_at",
  "updated_at",
].join(", ");

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schedule_main (
      department_name VARCHAR(255) PRIMARY KEY,
      incharge_modules JSONB DEFAULT '[]'::jsonb,
      start_date DATE,
      end_date DATE,
      days INTEGER,
      module_dates JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Backward-compatible
  await client.query(`ALTER TABLE schedule_main ADD COLUMN IF NOT EXISTS incharge_modules JSONB DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE schedule_main ADD COLUMN IF NOT EXISTS module_dates JSONB DEFAULT '{}'::jsonb;`);
  // Make start_date and end_date nullable to allow "Not Set" state
  await client.query(`ALTER TABLE schedule_main ALTER COLUMN start_date DROP NOT NULL;`);
  await client.query(`ALTER TABLE schedule_main ALTER COLUMN end_date DROP NOT NULL;`);
}

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // If table doesn't exist, return empty
      const checkTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'schedule_main'
        ) AS exists;
      `);
      if (!checkTable.rows?.[0]?.exists) {
        return NextResponse.json({ success: true, rows: [] }, { status: 200 });
      }

      const r = await client.query(`SELECT ${SELECT_COLUMNS} FROM public.schedule_main ORDER BY department_name ASC`);
      return NextResponse.json({ success: true, rows: r.rows || [] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/schedule/main error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { department_name, incharge_modules, start_date, end_date, module_dates } = body || {};

    if (!department_name) {
      return NextResponse.json(
        { success: false, error: "Missing required field: department_name" },
        { status: 400 }
      );
    }

    // Main schedule can have empty dates (Not Set state)
    // Only validate if both dates are provided
    let days = null;
    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (days < 0) {
        return NextResponse.json({ success: false, error: "End date must be after start date" }, { status: 400 });
      }
    }

    // Validate module_dates if provided
    // Only include modules with valid dates (start_date and end_date both present)
    // Modules without dates will be removed from database
    let moduleDatesJson = "{}";
    if (module_dates && typeof module_dates === "object") {
      const validModuleDates = {};
      // Validate each module date and only include if both dates are present
      for (const [moduleKey, dates] of Object.entries(module_dates)) {
        if (dates && typeof dates === "object" && dates.start_date && dates.end_date) {
          const modStart = new Date(dates.start_date);
          const modEnd = new Date(dates.end_date);
          if (modEnd < modStart) {
            return NextResponse.json(
              { success: false, error: `Module ${moduleKey}: End date must be after start date` },
              { status: 400 }
            );
          }
          // Only include if both dates are valid
          validModuleDates[moduleKey] = dates;
        }
        // If dates are missing or empty, don't include in validModuleDates (will be removed from DB)
      }
      moduleDatesJson = JSON.stringify(validModuleDates);
    }

    const client = await pool.connect();
    try {
      await ensureTable(client);

      // Allow empty array for "not set" state
      const modulesJson = Array.isArray(incharge_modules) ? JSON.stringify(incharge_modules) : JSON.stringify([]);

      const q = `
        INSERT INTO public.schedule_main
          (department_name, incharge_modules, start_date, end_date, days, module_dates, updated_at)
        VALUES
          ($1, $2::jsonb, $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (department_name)
        DO UPDATE SET
          incharge_modules = EXCLUDED.incharge_modules,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          days = EXCLUDED.days,
          module_dates = EXCLUDED.module_dates,
          updated_at = NOW()
        RETURNING ${SELECT_COLUMNS}
      `;

      // Allow null for start_date and end_date (Not Set state)
      const r = await client.query(q, [
        department_name, 
        modulesJson, 
        start_date || null, 
        end_date || null, 
        days, 
        moduleDatesJson
      ]);
      
      // Remove archive for any modules in incharge_modules to allow new schedules to appear in progress
      const archiveCheck = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_archive"]);
      if (archiveCheck?.rows?.[0]?.t && Array.isArray(incharge_modules) && incharge_modules.length > 0) {
        // Remove module-level archive for each module in incharge_modules
        for (const moduleKey of incharge_modules) {
          if (moduleKey !== "all") {
            await client.query(
              `DELETE FROM public.schedule_archive WHERE module_key = $1 AND scope = 'module'`,
              [moduleKey]
            );
            console.log(`Removed archive for module ${moduleKey} to allow new schedule to appear in progress`);
          }
        }
      }
      
      return NextResponse.json({ success: true, row: r.rows?.[0] ?? null }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /api/schedule/main error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { department_name } = body || {};

    if (!department_name) {
      return NextResponse.json(
        { success: false, error: "Missing required field: department_name" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await ensureTable(client);

      // Delete the main schedule entry
      const q = `
        DELETE FROM public.schedule_main
        WHERE department_name = $1
        RETURNING ${SELECT_COLUMNS}
      `;
      const r = await client.query(q, [department_name]);
      
      if (r.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Schedule not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, deleted: true }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DELETE /api/schedule/main error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


