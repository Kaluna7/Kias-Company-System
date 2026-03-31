/**
 * Helpers untuk kartu dashboard (SOP Review, Evidence, Worksheet, Audit Finding):
 * jendela tanggal dari GET /api/schedule/module?module=...
 */

export const SCHEDULE_ID_TO_DEPT_KEY = {
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

/** Sama dengan nama department di worksheet / evidence (huruf besar). */
export const SCHEDULE_ID_TO_UPPER_DEPT_NAME = {
  "A1.1": "FINANCE",
  "A1.2": "ACCOUNTING",
  "A1.3": "HRD",
  "A1.4": "G&A",
  "A1.5": "DESIGN STORE PLANNER",
  "A1.6": "TAX",
  "A1.7": "SECURITY L&P",
  "A1.8": "MIS",
  "A1.9": "MERCHANDISE",
  "A1.10": "OPERATIONAL",
  "A1.11": "WAREHOUSE",
};

export function formatScheduleDateLabel(iso) {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return "";
  const d = new Date(`${iso.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatScheduleRange(startIso, endIso) {
  const a = formatScheduleDateLabel(startIso || "");
  const b = formatScheduleDateLabel(endIso || "");
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return "";
}

/** Satu entri per dept key (baris configured terbaru per department_id). */
export function buildScheduleWindowsByDeptKey(rows) {
  const out = {};
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row?.is_configured) continue;
    const id = String(row.department_id || "").trim();
    const k = SCHEDULE_ID_TO_DEPT_KEY[id];
    if (!k || out[k] != null) continue;
    out[k] = {
      start: row.start_date ? String(row.start_date).trim() : "",
      end: row.end_date ? String(row.end_date).trim() : "",
    };
  }
  return out;
}

/** Satu entri per nama department (FINANCE, …) seperti di worksheet/evidence. */
export function buildScheduleWindowsByUpperDeptName(rows) {
  const out = {};
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row?.is_configured) continue;
    const id = String(row.department_id || "").trim();
    const d = SCHEDULE_ID_TO_UPPER_DEPT_NAME[id];
    if (!d || out[d] != null) continue;
    out[d] = {
      start: row.start_date ? String(row.start_date).trim() : "",
      end: row.end_date ? String(row.end_date).trim() : "",
    };
  }
  return out;
}
