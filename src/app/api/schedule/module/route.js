export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pkg from "pg";
const { Pool } = pkg;
import prisma from "@/app/lib/prisma";
import { buildWindowFromSchedule, dateToLocalYmd } from "@/lib/scheduleYearWindow";

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

const DEPT_KEY_BY_SCHEDULE_ID = {
  "A1.1": "finance",
  "A1.2": "accounting",
  "A1.3": "hrd",
  "A1.4": "g&a",
  "A1.5": "sdp",
  "A1.6": "tax",
  "A1.7": "l&p",
  "A1.8": "mis",
  "A1.9": "merch",
  "A1.10": "ops",
  "A1.11": "whs",
};

const DEPARTMENTS = [
  { key: "finance", sopSlug: "finance", worksheetDept: "FINANCE", evidenceDept: "FINANCE", auditFindingDept: "finance" },
  { key: "accounting", sopSlug: "accounting", worksheetDept: "ACCOUNTING", evidenceDept: "ACCOUNTING", auditFindingDept: "accounting" },
  { key: "hrd", sopSlug: "hrd", worksheetDept: "HRD", evidenceDept: "HRD", auditFindingDept: "hrd" },
  { key: "g&a", sopSlug: "g_a", worksheetDept: "G&A", evidenceDept: "G&A", auditFindingDept: "g&a" },
  { key: "sdp", sopSlug: "sdp", worksheetDept: "DESIGN STORE PLANNER", evidenceDept: "SDP", auditFindingDept: "sdp" },
  { key: "tax", sopSlug: "tax", worksheetDept: "TAX", evidenceDept: "TAX", auditFindingDept: "tax" },
  { key: "l&p", sopSlug: "l_p", worksheetDept: "SECURITY L&P", evidenceDept: "L&P", auditFindingDept: "l&p" },
  { key: "mis", sopSlug: "mis", worksheetDept: "MIS", evidenceDept: "MIS", auditFindingDept: "mis" },
  { key: "merch", sopSlug: "merch", worksheetDept: "MERCHANDISE", evidenceDept: "MERCHANDISE", auditFindingDept: "merch" },
  { key: "ops", sopSlug: "ops", worksheetDept: "OPERATIONAL", evidenceDept: "OPERATIONAL", auditFindingDept: "ops" },
  { key: "whs", sopSlug: "whs", worksheetDept: "WAREHOUSE", evidenceDept: "WAREHOUSE", auditFindingDept: "whs" },
];

function getDeptKeyFromScheduleId(departmentId) {
  return DEPT_KEY_BY_SCHEDULE_ID[String(departmentId || "").trim()] || null;
}

function getDeptInfo(deptKey) {
  return DEPARTMENTS.find(d => d.key === deptKey) || null;
}

async function resetPublishedDataForDepartment(moduleKey, deptKey, client) {
  const dept = getDeptInfo(deptKey);
  if (!dept) {
    console.log(`resetPublishedDataForDepartment: No dept info found for ${deptKey}`);
    return;
  }

  console.log(`resetPublishedDataForDepartment: Resetting ${moduleKey} for ${deptKey} (${dept.sopSlug || dept.worksheetDept || dept.auditFindingDept || dept.evidenceDept})`);

  try {
    if (moduleKey === "sop-review") {
      // Delete published SOP Review data
      const stepsTable = `sops_report_${dept.sopSlug}`;
      const metaTable = `sop_report_${dept.sopSlug}`;
      
      const stepsCheck = await client.query("SELECT to_regclass($1) AS t", [`public.${stepsTable}`]);
      if (stepsCheck?.rows?.[0]?.t) {
        const beforeCount = await client.query(`SELECT COUNT(*)::int as count FROM ${stepsTable}`);
        await client.query(`TRUNCATE TABLE ${stepsTable} RESTART IDENTITY`);
        console.log(`Reset ${stepsTable} for ${deptKey} (deleted ${beforeCount.rows?.[0]?.count || 0} rows)`);
      } else {
        console.log(`Table ${stepsTable} does not exist`);
      }
      
      const metaCheck = await client.query("SELECT to_regclass($1) AS t", [`public.${metaTable}`]);
      if (metaCheck?.rows?.[0]?.t) {
        const beforeCount = await client.query(`SELECT COUNT(*)::int as count FROM ${metaTable}`);
        await client.query(`TRUNCATE TABLE ${metaTable} RESTART IDENTITY`);
        console.log(`Reset ${metaTable} for ${deptKey} (deleted ${beforeCount.rows?.[0]?.count || 0} rows)`);
      } else {
        console.log(`Table ${metaTable} does not exist`);
      }
    } else if (moduleKey === "worksheet") {
      // Delete published Worksheet data
      try {
        await prisma.worksheet_finance.deleteMany({
          where: { department: dept.worksheetDept },
        });
        console.log(`Reset worksheet_finance for ${deptKey}`);
      } catch (err) {
        console.error(`Error resetting worksheet for ${deptKey}:`, err);
      }
    } else if (moduleKey === "audit-finding") {
      // Delete published Audit Finding data
      try {
        const modelName = `audit_finding_${dept.auditFindingDept}`;
        const model = prisma[modelName];
        if (model) {
          await model.deleteMany({});
          console.log(`Reset ${modelName} for ${deptKey}`);
        }
      } catch (err) {
        console.error(`Error resetting audit finding for ${deptKey}:`, err);
      }
    } else if (moduleKey === "evidence") {
      // Delete published Evidence data
      try {
        await prisma.evidence.deleteMany({
          where: { department: dept.evidenceDept },
        });
        console.log(`Reset evidence for ${deptKey}`);
      } catch (err) {
        console.error(`Error resetting evidence for ${deptKey}:`, err);
      }
    }
  } catch (err) {
    console.error(`Error resetting published data for ${moduleKey} ${deptKey}:`, err);
    // Don't fail the operation if reset fails
  }
}

const SELECT_COLUMNS = [
  "id",
  "module_key",
  "department_id",
  "department_name",
  "user_id",
  "user_name",
  "is_configured",
  "TO_CHAR(start_date, 'YYYY-MM-DD') as start_date",
  "TO_CHAR(end_date, 'YYYY-MM-DD') as end_date",
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
      user_id TEXT,
      user_name TEXT,
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
  // Multi-user picker stores comma-separated ids/names; widen legacy VARCHAR(64)/255.
  await client.query(
    `ALTER TABLE public.schedule_module_feedback ALTER COLUMN user_id TYPE TEXT USING (user_id::text)`
  );
  await client.query(
    `ALTER TABLE public.schedule_module_feedback ALTER COLUMN user_name TYPE TEXT USING (user_name::text)`
  );
}

async function migrateFromLegacyIfNeeded(client) {
  // One-time-ish migration: copy sop-review assignments from schedule_preparer_feedback into schedule_module_feedback
  const regLegacy = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_preparer_feedback"]);
  if (!regLegacy?.rows?.[0]?.t) return;

  await ensureModuleTable(client);

  // Only migrate if module table has no sop-review rows yet
  const hasSop = await client.query(
    `SELECT 1 FROM public.schedule_module_feedback WHERE module_key='sop-review' LIMIT 1`
  );
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

function getModuleKey(req) {
  const url = new URL(req.url);
  const moduleKey = String(url.searchParams.get("module") || "").trim();
  return ALLOWED_MODULES.has(moduleKey) ? moduleKey : null;
}

export async function GET(req) {
  try {
    const moduleKey = getModuleKey(req);
    if (!moduleKey) {
      return NextResponse.json({ success: false, error: "Missing/invalid module. Use ?module=sop-review|worksheet|audit-finding|evidence" }, { status: 400 });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const parsedYear = yearParam ? parseInt(yearParam, 10) : null;
    const filterYear = parsedYear != null && Number.isFinite(parsedYear) ? parsedYear : null;

    const client = await pool.connect();
    try {
      await migrateFromLegacyIfNeeded(client);

      // If table still doesn't exist, return empty
      const reg = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_module_feedback"]);
      if (!reg?.rows?.[0]?.t) return NextResponse.json({ success: true, rows: [] }, { status: 200 });

      const r = await client.query(
        `SELECT ${SELECT_COLUMNS} FROM public.schedule_module_feedback WHERE module_key=$1 ORDER BY department_id, id DESC`,
        [moduleKey]
      );
      
      // Dates are already formatted as YYYY-MM-DD strings from PostgreSQL TO_CHAR
      // No need for additional formatting - use them directly
      let formattedRows = (r.rows || []).map(row => {
        const formatted = { ...row };
        // start_date and end_date are already strings in YYYY-MM-DD format from TO_CHAR
        // Just ensure they're trimmed and valid
        if (row.start_date) {
          const dateStr = String(row.start_date).trim();
          formatted.start_date = dateStr.match(/^\d{4}-\d{2}-\d{2}$/) ? dateStr : "";
        }
        if (row.end_date) {
          const dateStr = String(row.end_date).trim();
          formatted.end_date = dateStr.match(/^\d{4}-\d{2}-\d{2}$/) ? dateStr : "";
        }
        return formatted;
      });

      if (filterYear != null) {
        formattedRows = formattedRows.map((row) => {
          if (!row.is_configured || !row.start_date || !row.end_date) return row;
          const win = buildWindowFromSchedule(
            { start_date: row.start_date, end_date: row.end_date },
            filterYear
          );
          if (!win) {
            return { ...row, start_date: "", end_date: "", days: null, is_configured: false };
          }
          const sd = dateToLocalYmd(win.start);
          const ed = dateToLocalYmd(win.end);
          const days = Math.ceil((win.end - win.start) / (1000 * 60 * 60 * 24)) + 1;
          return { ...row, start_date: sd, end_date: ed, days };
        });
      }
      
      console.log(`GET /api/schedule/module?module=${moduleKey}: Returning ${formattedRows.length} rows`);
      if (formattedRows.length > 0) {
        console.log(`GET /api/schedule/module: Rows:`, formattedRows.map(row => ({
          department_id: row.department_id,
          is_configured: row.is_configured,
          start_date: row.start_date,
          end_date: row.end_date,
        })));
      }
      
      return NextResponse.json({ success: true, rows: formattedRows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/schedule/module error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      module_key,
      department_id,
      department_name,
      user_id,
      user_name,
      start_date,
      end_date,
    } = body || {};

    if (!ALLOWED_MODULES.has(String(module_key || "").trim())) {
      return NextResponse.json({ success: false, error: "Invalid module_key" }, { status: 400 });
    }
    if (!department_id || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: module_key, department_id, start_date, end_date" },
        { status: 400 }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (days < 0) {
      return NextResponse.json({ success: false, error: "End date must be after start date" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await ensureModuleTable(client);

      const q = `
        INSERT INTO public.schedule_module_feedback
          (module_key, department_id, department_name, user_id, user_name, is_configured, start_date, end_date, days, updated_at)
        VALUES
          ($1,$2,$3,$4,$5, TRUE, $6,$7,$8, NOW())
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
      const r = await client.query(q, [
        String(module_key).trim(),
        department_id,
        department_name || null,
        user_id || null,
        user_name || null,
        start_date,
        end_date,
        days,
      ]);
      
      const savedRow = r.rows?.[0] ?? null;
      console.log(`POST /api/schedule/module: Saved ${module_key} for ${department_id}:`, {
        is_configured: savedRow?.is_configured,
        start_date: savedRow?.start_date,
        end_date: savedRow?.end_date,
        user_name: savedRow?.user_name,
        department_id: savedRow?.department_id,
      });
      
      // Verify is_configured is TRUE
      if (savedRow && savedRow.is_configured !== true) {
        console.error(`WARNING: is_configured is not TRUE for ${module_key} ${department_id}! Value:`, savedRow.is_configured);
      } else if (savedRow) {
        console.log(`✓ is_configured = TRUE confirmed for ${module_key} ${department_id}`);
      }
      
      // Remove archive for this module if it exists (so new schedule can appear in progress)
      const archiveCheck = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_archive"]);
      if (archiveCheck?.rows?.[0]?.t) {
        // Delete module-level archive (scope = 'module') to allow new schedules to appear
        await client.query(
          `DELETE FROM public.schedule_archive WHERE module_key = $1 AND scope = 'module'`,
          [module_key]
        );
        console.log(`Removed archive for module ${module_key} to allow new schedule to appear in progress`);
      }
      
      // Jangan reset published data - setiap publish harus tetap tersimpan di report
      // (previously: reset would truncate report tables and lose all publish history)

      return NextResponse.json({ success: true, row: savedRow }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /api/schedule/module error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { module_key, department_id } = body || {};

    if (!ALLOWED_MODULES.has(String(module_key || "").trim())) {
      return NextResponse.json({ success: false, error: "Invalid module_key" }, { status: 400 });
    }
    if (!department_id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: department_id" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await ensureModuleTable(client);

      // Delete the module schedule entry to reset the schedule
      const q = `
        DELETE FROM public.schedule_module_feedback
        WHERE module_key = $1 AND department_id = $2
        RETURNING ${SELECT_COLUMNS}
      `;
      const r = await client.query(q, [String(module_key).trim(), department_id]);
      return NextResponse.json({ success: true, deleted: r.rows.length > 0 }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DELETE /api/schedule/module error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

