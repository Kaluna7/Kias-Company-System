import schedulePool from "@/app/lib/db";
import { buildWindowFromSchedule } from "@/lib/scheduleYearWindow";

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

const DEPT_NAME_BY_KEY = {
  finance: "Finance",
  accounting: "Accounting",
  hrd: "HRD",
  "g&a": "General Affair",
  sdp: "Store D & P",
  tax: "Tax",
  "l&p": "L & P",
  mis: "MIS",
  merch: "Merchandise",
  ops: "Operational",
  whs: "Warehouse",
};

/**
 * Server-only: penugasan user per modul (tanpa fetch HTTP).
 * @returns {Promise<Array<{ key: string, name: string, department_id: string }>>}
 */
export async function getUserAllowedDepartments(userName, moduleKey, year) {
  const target = String(userName || "").trim().toLowerCase();
  if (!target) return [];

  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_module_feedback'
     ) AS exists`,
  );
  if (!check?.rows?.[0]?.exists) return [];

  const r = await schedulePool.query(
    `SELECT department_id, department_name, user_name,
            TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
            TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
     FROM public.schedule_module_feedback
     WHERE module_key = $1 AND is_configured = true`,
    [moduleKey],
  );

  const parsedYear = year != null && Number.isFinite(Number(year)) ? Number(year) : null;
  const seenDeptIds = new Set();
  const allowedDepartments = [];

  for (const row of r.rows || []) {
    if (parsedYear != null) {
      const w = buildWindowFromSchedule(
        { start_date: row.start_date, end_date: row.end_date },
        parsedYear,
      );
      if (!w) continue;
    }

    const rawName = String(row.user_name || "").trim();
    if (!rawName) continue;

    const names = rawName
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => n.toLowerCase());

    if (!names.includes(target)) continue;

    const deptId = String(row.department_id || "").trim();
    if (seenDeptIds.has(deptId)) continue;
    const deptKey = DEPT_KEY_BY_SCHEDULE_ID[deptId];
    if (!deptKey) continue;

    seenDeptIds.add(deptId);
    allowedDepartments.push({
      key: deptKey,
      name: row.department_name || DEPT_NAME_BY_KEY[deptKey] || deptKey,
      department_id: deptId,
    });
  }

  return allowedDepartments;
}
