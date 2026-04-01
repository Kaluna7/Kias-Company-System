export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { pool } from "@/app/api/SopReview/_shared/pool";
import schedulePool from "@/app/lib/db";
import { buildWindowFromSchedule } from "@/lib/scheduleYearWindow";
import { yearCreatedAtFilter } from "@/app/api/worksheet/_shared/worksheetWhere";

const DEPARTMENTS = [
  {
    key: "finance",
    label: "Finance",
    sopSlug: "finance",
    worksheetDept: "FINANCE",
    evidenceDept: "FINANCE",
    auditFindingDept: "finance",
  },
  {
    key: "accounting",
    label: "Accounting",
    sopSlug: "accounting",
    worksheetDept: "ACCOUNTING",
    evidenceDept: "ACCOUNTING",
    auditFindingDept: "accounting",
  },
  {
    key: "hrd",
    label: "HRD",
    sopSlug: "hrd",
    worksheetDept: "HRD",
    evidenceDept: "HRD",
    auditFindingDept: "hrd",
  },
  {
    key: "g&a",
    label: "General Affair",
    sopSlug: "g_a",
    worksheetDept: "G&A",
    evidenceDept: "G&A",
    auditFindingDept: "g&a",
  },
  {
    key: "sdp",
    label: "Store Design & Planner",
    sopSlug: "sdp",
    worksheetDept: "DESIGN STORE PLANNER",
    evidenceDept: "SDP",
    auditFindingDept: "sdp",
  },
  {
    key: "tax",
    label: "Tax",
    sopSlug: "tax",
    worksheetDept: "TAX",
    evidenceDept: "TAX",
    auditFindingDept: "tax",
  },
  {
    key: "l&p",
    label: "L & P",
    sopSlug: "l_p",
    worksheetDept: "SECURITY L&P",
    evidenceDept: "L&P",
    auditFindingDept: "l&p",
  },
  {
    key: "mis",
    label: "MIS",
    sopSlug: "mis",
    worksheetDept: "MIS",
    evidenceDept: "MIS",
    auditFindingDept: "mis",
  },
  {
    key: "merch",
    label: "Merchandise",
    sopSlug: "merch",
    worksheetDept: "MERCHANDISE",
    evidenceDept: "MERCHANDISE",
    auditFindingDept: "merch",
  },
  {
    key: "ops",
    label: "Operational",
    sopSlug: "ops",
    worksheetDept: "OPERATIONAL",
    evidenceDept: "OPERATIONAL",
    auditFindingDept: "ops",
  },
  {
    key: "whs",
    label: "Warehouse",
    sopSlug: "whs",
    worksheetDept: "WAREHOUSE",
    evidenceDept: "WAREHOUSE",
    auditFindingDept: "whs",
  },
];

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

const SCHEDULE_ID_BY_DEPT_KEY = Object.fromEntries(
  Object.entries(DEPT_KEY_BY_SCHEDULE_ID).map(([scheduleId, deptKey]) => [deptKey, scheduleId])
);

/**
 * Load schedule window (start_date, end_date) per department for sop-review.
 * Returns Map(deptKey -> { start_date, end_date }) for rows where is_configured = true.
 */
async function loadSopReviewScheduleByDept() {
  const byDept = new Map();
  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_module_feedback'
     ) AS exists`
  );
  if (!check?.rows?.[0]?.exists) return byDept;

  const r = await schedulePool.query(
    `SELECT department_id, start_date, end_date
     FROM public.schedule_module_feedback
     WHERE module_key = 'sop-review' AND is_configured = true
     ORDER BY department_id`
  );
  for (const row of r.rows || []) {
    const deptKey = DEPT_KEY_BY_SCHEDULE_ID[String(row.department_id || "").trim()];
    if (!deptKey || !row.start_date || !row.end_date) continue;
    byDept.set(deptKey, {
      start_date: row.start_date,
      end_date: row.end_date,
    });
  }
  return byDept;
}

/**
 * Load schedule window (start_date, end_date) per department for a given module.
 * Returns Map(deptKey -> { start_date, end_date }) for rows where is_configured = true.
 */
async function loadModuleScheduleByDept(moduleKey) {
  const byDept = new Map();
  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_module_feedback'
     ) AS exists`
  );
  if (!check?.rows?.[0]?.exists) return byDept;

  const r = await schedulePool.query(
    `SELECT department_id, start_date, end_date,
            TO_CHAR(start_date::date, 'YYYY-MM-DD') AS start_ymd,
            TO_CHAR(end_date::date, 'YYYY-MM-DD') AS end_ymd,
            updated_at AS feedback_updated_at
     FROM public.schedule_module_feedback
     WHERE module_key = $1 AND is_configured = true
     ORDER BY department_id`,
    [moduleKey]
  );
  for (const row of r.rows || []) {
    const deptKey = DEPT_KEY_BY_SCHEDULE_ID[String(row.department_id || "").trim()];
    if (!deptKey || !row.start_date || !row.end_date) continue;
    byDept.set(deptKey, {
      start_date: row.start_date,
      end_date: row.end_date,
      start_ymd: row.start_ymd ? String(row.start_ymd).trim() : null,
      end_ymd: row.end_ymd ? String(row.end_ymd).trim() : null,
      /** Last save of this module row; worksheet progress only counts publishes after this (new cycle after re-schedule). */
      feedbackUpdatedAt: row.feedback_updated_at ?? row.updated_at ?? null,
    });
  }
  return byDept;
}

/** Clip schedule [startYmd, endYmd] to audit calendar year using ISO date string ordering. */
function clipIsoYmdRangeToYear(startYmd, endYmd, year) {
  const s0 = String(startYmd || "").slice(0, 10);
  const e0 = String(endYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s0) || !/^\d{4}-\d{2}-\d{2}$/.test(e0)) return null;
  if (year == null || !Number.isFinite(year)) {
    if (s0 > e0) return null;
    return { startYmd: s0, endYmd: e0 };
  }
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  const s = s0 > yStart ? s0 : yStart;
  const e = e0 < yEnd ? e0 : yEnd;
  if (s > e) return null;
  return { startYmd: s, endYmd: e };
}

/**
 * SOP Review "Done" = user clicked Publish in that department FOR THE CURRENT SCHEDULE only.
 * We require a publish whose published_at falls within the department's schedule window (start_date..end_date).
 * So: hanya setelah user click Publish di module/department yang dipilih di schedule, baru dianggap Done.
 */
async function getSopReviewDoneSet(scheduleByDept, year) {
  const client = await pool.connect();
  try {
    const promises = [];
    const deptByIndex = [];
    for (const d of DEPARTMENTS) {
      const metaTable = `sop_report_${d.sopSlug}`;
      deptByIndex.push(d.key);
      const schedule = scheduleByDept?.get(d.key);
      const window = buildWindowFromSchedule(schedule, year);
      if (!window) {
        promises.push(Promise.resolve(false));
        continue;
      }
      promises.push(
        client
          .query(
            `SELECT 1 FROM public.${metaTable}
             WHERE published_at IS NOT NULL
               AND published_at::date >= $1::date
               AND published_at::date <= $2::date
             LIMIT 1`,
            [window.start, window.end]
          )
          .then((r) => (r?.rowCount ?? 0) > 0)
          .catch(() => false)
      );
    }
    const results = await Promise.all(promises);
    const done = new Set();
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      if (results[i]) done.add(deptByIndex[i]);
    }
    return done;
  } finally {
    client.release();
  }
}

async function getWorksheetDoneSet(scheduleByDept, year) {
  // Done = published row + file in the selected audit year (same idea as GET /api/worksheet/*/ year filter).
  // Also require worksheet.created_at >= schedule_module_feedback.updated_at for this dept+module so that
  // after "finish" + a new worksheet schedule save, old published rows from the previous cycle do not count
  // until someone publishes again (saving the schedule bumps updated_at via UPSERT).
  const checks = await Promise.all(
    DEPARTMENTS.map(async (d) => {
      const sched = scheduleByDept?.get(d.key);
      if (!sched?.start_date || !sched?.end_date) return { key: d.key, done: false };

      const cutoffRaw = sched.feedbackUpdatedAt;
      const cutoff =
        cutoffRaw != null ? new Date(cutoffRaw) : null;
      const cutoffOk = cutoff && !Number.isNaN(cutoff.getTime());

      const yf = yearCreatedAtFilter(year);
      const andParts = [
        { file_path: { not: null } },
        { NOT: { file_path: "" } },
      ];
      if (cutoffOk) {
        andParts.push({ created_at: { gte: cutoff } });
      }

      if (yf) {
        andParts.push({
          OR: [
            { created_at: { gte: yf.gte, lt: yf.lt } },
            { updated_at: { gte: yf.gte, lt: yf.lt } },
          ],
        });
      } else {
        const startYmd =
          sched.start_ymd ||
          (typeof sched.start_date === "string"
            ? sched.start_date.slice(0, 10)
            : null) ||
          (sched.start_date instanceof Date && !Number.isNaN(sched.start_date.getTime())
            ? sched.start_date.toISOString().slice(0, 10)
            : null);
        const endYmd =
          sched.end_ymd ||
          (typeof sched.end_date === "string"
            ? sched.end_date.slice(0, 10)
            : null) ||
          (sched.end_date instanceof Date && !Number.isNaN(sched.end_date.getTime())
            ? sched.end_date.toISOString().slice(0, 10)
            : null);
        const bounds = clipIsoYmdRangeToYear(startYmd, endYmd, null);
        if (!bounds) return { key: d.key, done: false };
        const startTs = new Date(`${bounds.startYmd}T00:00:00.000Z`);
        const endTs = new Date(`${bounds.endYmd}T23:59:59.999Z`);
        andParts.push({
          OR: [
            { created_at: { gte: startTs, lte: endTs } },
            { updated_at: { gte: startTs, lte: endTs } },
          ],
        });
      }

      const count = await prisma.worksheet_finance.count({
        where: {
          department: d.worksheetDept,
          published_to_report: true,
          AND: andParts,
        },
      });

      return { key: d.key, done: count > 0 };
    })
  );
  const done = new Set();
  for (const row of checks) {
    if (row.done) done.add(row.key);
  }
  return done;
}

const auditFindingModelByDept = {
  accounting: "audit_finding_accounting",
  finance: "audit_finding_finance",
  hrd: "audit_finding_hrd",
  "g&a": "audit_finding_ga",
  sdp: "audit_finding_sdp",
  tax: "audit_finding_tax",
  "l&p": "audit_finding_lp",
  mis: "audit_finding_mis",
  merch: "audit_finding_merch",
  ops: "audit_finding_ops",
  whs: "audit_finding_whs",
};

async function getAuditFindingDoneSet(scheduleByDept, year) {
  // "Done" = current scheduled finding has been published (COMPLETED/COMPLETE) in the active schedule window.
  const counts = await Promise.all(
    DEPARTMENTS.map((d) => {
      const model = auditFindingModelByDept[d.auditFindingDept];
      const delegate = model ? prisma[model] : null;
      if (!delegate) return Promise.resolve({ key: d.key, count: 0 });

      const window = buildWindowFromSchedule(scheduleByDept?.get(d.key), year);
      if (!window) return Promise.resolve({ key: d.key, count: 0 });

      const where = {
        completion_status: {
          in: ["COMPLETED", "COMPLETE"],
          mode: "insensitive",
        },
        AND: [
          {
            OR: [
              { completion_date: { gte: window.start, lte: window.end } },
              { updated_at: { gte: window.start, lte: window.end } },
            ],
          },
        ],
      };
      return delegate
        .count({
          where,
        })
        .then((count) => ({ key: d.key, count }));
    })
  );
  const done = new Set();
  for (const { key, count } of counts) {
    if (count > 0) done.add(key);
  }
  return done;
}

async function getEvidenceDoneSet(scheduleByDept, year) {
  // "Done" = current scheduled evidence has been published (COMPLETE + file) in the active schedule window.
  const checks = await Promise.all(
    DEPARTMENTS.map(async (d) => {
      const window = buildWindowFromSchedule(scheduleByDept?.get(d.key), year);
      if (!window) return { key: d.key, done: false };

      const count = await prisma.evidence.count({
        where: {
          department: d.evidenceDept,
          file_url: { not: null },
          overall_status: { equals: "COMPLETE", mode: "insensitive" },
          updated_at: { gte: window.start, lte: window.end },
        },
      });

      return { key: d.key, done: count > 0 };
    })
  );
  const done = new Set();
  for (const row of checks) {
    if (row.done) done.add(row.key);
  }
  return done;
}

async function loadConfiguredModules(year) {
  // Returns Map(moduleKey -> Set(deptKey)) for modules configured in the selected audit year (or all years if year is null)
  const configuredByModule = new Map();

  // If schedule table doesn't exist yet, return empty map
  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_module_feedback'
     ) AS exists`
  );
  if (!check?.rows?.[0]?.exists) return configuredByModule;

  const r = await schedulePool.query(
    `SELECT module_key, department_id,
            TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
            TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
     FROM public.schedule_module_feedback
     WHERE is_configured = true
     ORDER BY module_key, department_id`
  );

  for (const row of r.rows || []) {
    if (year != null && Number.isFinite(year)) {
      const w = buildWindowFromSchedule(
        { start_date: row.start_date, end_date: row.end_date },
        year
      );
      if (!w) continue;
    }

    const deptId = String(row.department_id || "").trim();
    const deptKey = DEPT_KEY_BY_SCHEDULE_ID[deptId];
    if (!deptKey) continue;

    const moduleKey = String(row.module_key || "").trim();
    if (!moduleKey) continue;
    if (!configuredByModule.has(moduleKey)) configuredByModule.set(moduleKey, new Set());
    configuredByModule.get(moduleKey).add(deptKey);
  }

  return configuredByModule;
}

async function loadAssignmentsByUser(userName, year) {
  if (!userName) return { allowedDeptKeys: null, allowedByModule: null };

  // If schedule table doesn't exist yet, don't filter anything
  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_module_feedback'
     ) AS exists`
  );
  if (!check?.rows?.[0]?.exists) return { allowedDeptKeys: null, allowedByModule: null };

  // schedule_module_feedback menyimpan user_name sebagai satu string,
  // tetapi sekarang bisa berisi beberapa user (dipisah koma).
  // Kita ambil SEMUA baris is_configured=true lalu filter di kode.
  const r = await schedulePool.query(
    `SELECT module_key, department_id, user_name,
            TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
            TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
     FROM public.schedule_module_feedback
     WHERE is_configured = true`
  );

  const allowedDeptKeys = new Set();
  const allowedByModule = new Map(); // moduleKey -> Set(deptKey)

  const target = String(userName || "").trim().toLowerCase();

  for (const row of r.rows || []) {
    if (year != null && Number.isFinite(year)) {
      const w = buildWindowFromSchedule(
        { start_date: row.start_date, end_date: row.end_date },
        year
      );
      if (!w) continue;
    }

    const rawName = String(row.user_name || "").trim();
    if (!rawName) continue;

    // Pecah user_name menjadi list nama, trim, bandingkan case-insensitive
    const names = rawName
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => n.toLowerCase());

    if (!names.includes(target)) continue;

    const deptKey = DEPT_KEY_BY_SCHEDULE_ID[String(row.department_id || "").trim()];
    if (!deptKey) continue;
    allowedDeptKeys.add(deptKey);

    const moduleKey = String(row.module_key || "").trim();
    if (!moduleKey) continue;
    if (!allowedByModule.has(moduleKey)) allowedByModule.set(moduleKey, new Set());
    allowedByModule.get(moduleKey).add(deptKey);
  }

  return { allowedDeptKeys, allowedByModule };
}

async function loadArchive() {
  // Returns { archivedModules: Set(moduleKey), archivedByModule: Map(moduleKey -> Set(deptKey)) }
  const archivedModules = new Set();
  const archivedByModule = new Map();

  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_archive'
     ) AS exists`
  );
  if (!check?.rows?.[0]?.exists) return { archivedModules, archivedByModule };

  const r = await schedulePool.query(
    `SELECT module_key, department_id, scope
     FROM public.schedule_archive`
  );

  for (const row of r.rows || []) {
    const moduleKey = String(row.module_key || "").trim();
    if (!moduleKey) continue;

    const scope = String(row.scope || "").trim();
    if (scope === "module") {
      archivedModules.add(moduleKey);
      continue;
    }

    const deptKey = DEPT_KEY_BY_SCHEDULE_ID[String(row.department_id || "").trim()];
    if (!deptKey) continue;
    if (!archivedByModule.has(moduleKey)) archivedByModule.set(moduleKey, new Set());
    archivedByModule.get(moduleKey).add(deptKey);
  }

  return { archivedModules, archivedByModule };
}

function formatModule({ key, label, doneSet }) {
  const total = DEPARTMENTS.length;
  const doneCount = DEPARTMENTS.filter((d) => doneSet.has(d.key)).length;
  const departments = DEPARTMENTS.map((d) => ({
    key: d.key,
    label: d.label,
    status: doneSet.has(d.key) ? "finish" : "pending",
  }));
  return { key, label, done: doneCount, total, departments };
}

function formatModuleFiltered({ key, label, doneSet, allowedDeptKeys, archive }) {
  if (archive?.archivedModules?.has(key)) {
    return { key, label, done: 0, total: 0, departments: [] };
  }
  const archivedDept = archive?.archivedByModule?.get(key) || new Set();

  const list = allowedDeptKeys
    ? DEPARTMENTS.filter((d) => allowedDeptKeys.has(d.key))
    : DEPARTMENTS;

  const visible = list.filter((d) => !archivedDept.has(d.key));

  const total = visible.length;
  const doneCount = visible.filter((d) => doneSet.has(d.key)).length;
  const departments = visible.map((d) => ({
    key: d.key,
    label: d.label,
    status: doneSet.has(d.key) ? "finish" : "pending",
    department_id: SCHEDULE_ID_BY_DEPT_KEY[d.key] || null,
  }));
  return { key, label, done: doneCount, total, departments };
}

function buildAllowedForModule({ moduleKey, allowedDeptKeys, allowedByModule, configuredByModule }) {
  const configuredDepts = configuredByModule?.get(moduleKey) || new Set();
  if (configuredDepts.size === 0) return new Set();

  if (allowedDeptKeys && allowedByModule) {
    const out = new Set();
    const sMod = allowedByModule.get(moduleKey) || new Set();
    for (const k of allowedDeptKeys) {
      if (sMod.has(k) && configuredDepts.has(k)) out.add(k);
    }
    return out;
  }
  return configuredDepts;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userName = (url.searchParams.get("userName") || "").trim();
    const yearParam = url.searchParams.get("year");
    const parsedYear = yearParam ? parseInt(yearParam, 10) : null;
    const year = parsedYear != null && Number.isFinite(parsedYear) ? parsedYear : null;

    const [assignments, archive, configuredByModule, sopScheduleByDept, worksheetScheduleByDept, auditFindingScheduleByDept, evidenceScheduleByDept] = await Promise.all([
      loadAssignmentsByUser(userName || null, year),
      loadArchive(),
      loadConfiguredModules(year),
      loadSopReviewScheduleByDept(),
      loadModuleScheduleByDept("worksheet"),
      loadModuleScheduleByDept("audit-finding"),
      loadModuleScheduleByDept("evidence"),
    ]);
    const sopDone = await getSopReviewDoneSet(sopScheduleByDept, year);
    const [worksheetDone, auditFindingDone, evidenceDone] = await Promise.all([
      getWorksheetDoneSet(worksheetScheduleByDept, year),
      getAuditFindingDoneSet(auditFindingScheduleByDept, year),
      getEvidenceDoneSet(evidenceScheduleByDept, year),
    ]);

    const sopAllowed = buildAllowedForModule({ moduleKey: "sop-review", ...assignments, configuredByModule });
    const wsAllowed = buildAllowedForModule({ moduleKey: "worksheet", ...assignments, configuredByModule });
    const afAllowed = buildAllowedForModule({ moduleKey: "audit-finding", ...assignments, configuredByModule });
    const evAllowed = buildAllowedForModule({ moduleKey: "evidence", ...assignments, configuredByModule });

    const modules = [
      formatModuleFiltered({ key: "sop-review", label: "SOP Review", doneSet: sopDone, allowedDeptKeys: sopAllowed, archive }),
      formatModuleFiltered({ key: "worksheet", label: "Worksheet", doneSet: worksheetDone, allowedDeptKeys: wsAllowed, archive }),
      formatModuleFiltered({ key: "audit-finding", label: "Audit Finding", doneSet: auditFindingDone, allowedDeptKeys: afAllowed, archive }),
      formatModuleFiltered({ key: "evidence", label: "Evidence", doneSet: evidenceDone, allowedDeptKeys: evAllowed, archive }),
    ].filter((m) => (m.total ?? 0) > 0);

    return NextResponse.json({ success: true, modules }, { status: 200 });
  } catch (err) {
    console.error("GET /api/dashboard/progress error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


