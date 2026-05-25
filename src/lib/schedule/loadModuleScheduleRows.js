import { pool } from "@/app/api/SopReview/_shared/pool";
import { buildWindowFromSchedule, dateToLocalYmd } from "@/lib/scheduleYearWindow";

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
  await client.query(
    `ALTER TABLE public.schedule_module_feedback ADD COLUMN IF NOT EXISTS is_configured BOOLEAN NOT NULL DEFAULT FALSE;`,
  );
}

async function migrateFromLegacyIfNeeded(client) {
  const regLegacy = await client.query("SELECT to_regclass($1) AS t", [
    "public.schedule_preparer_feedback",
  ]);
  if (!regLegacy?.rows?.[0]?.t) return;

  await ensureModuleTable(client);

  const hasSop = await client.query(
    `SELECT 1 FROM public.schedule_module_feedback WHERE module_key='sop-review' LIMIT 1`,
  );
  if ((hasSop?.rowCount ?? 0) > 0) return;

  const legacy = await client.query(
    `SELECT department_id, department_name, user_id, user_name, incharge_modules, start_date, end_date, days
     FROM public.schedule_preparer_feedback`,
  );

  for (const row of legacy.rows || []) {
    let modules = row.incharge_modules;
    if (typeof modules === "string") {
      try {
        modules = JSON.parse(modules);
      } catch {
        modules = ["all"];
      }
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
      ],
    );
  }
}

/**
 * Server-only: jadwal modul (tanpa HTTP loopback).
 * @param {string} moduleKey
 * @param {number|null} filterYear
 * @returns {Promise<object[]>}
 */
export async function loadModuleScheduleRows(moduleKey, filterYear) {
  const client = await pool.connect();
  try {
    await migrateFromLegacyIfNeeded(client);

    const reg = await client.query("SELECT to_regclass($1) AS t", [
      "public.schedule_module_feedback",
    ]);
    if (!reg?.rows?.[0]?.t) return [];

    const r = await client.query(
      `SELECT ${SELECT_COLUMNS} FROM public.schedule_module_feedback WHERE module_key=$1 ORDER BY department_id, id DESC`,
      [moduleKey],
    );

    let formattedRows = (r.rows || []).map((row) => {
      const formatted = { ...row };
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

    const year =
      filterYear != null && Number.isFinite(Number(filterYear)) ? Number(filterYear) : null;
    if (year != null) {
      formattedRows = formattedRows.map((row) => {
        if (!row.is_configured || !row.start_date || !row.end_date) return row;
        const win = buildWindowFromSchedule(
          { start_date: row.start_date, end_date: row.end_date },
          year,
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

    return formattedRows;
  } finally {
    client.release();
  }
}
