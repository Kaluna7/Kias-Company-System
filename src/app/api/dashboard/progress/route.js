export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { pool } from "@/app/api/SopReview/_shared/pool";
import schedulePool from "@/app/lib/db";

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
 * SOP Review "Done" = user clicked Publish in that department FOR THE CURRENT SCHEDULE only.
 * We require a publish whose published_at falls within the department's schedule window (start_date..end_date).
 * So: hanya setelah user click Publish di module/department yang dipilih di schedule, baru dianggap Done.
 */
async function getSopReviewDoneSet(scheduleByDept) {
  const client = await pool.connect();
  try {
    const promises = [];
    const deptByIndex = [];
    for (const d of DEPARTMENTS) {
      const metaTable = `sop_report_${d.sopSlug}`;
      deptByIndex.push(d.key);
      const schedule = scheduleByDept?.get(d.key);
      if (!schedule?.start_date || !schedule?.end_date) {
        promises.push(Promise.resolve(false));
        continue;
      }
      const startDate = schedule.start_date instanceof Date ? schedule.start_date : new Date(schedule.start_date);
      const endDate = schedule.end_date instanceof Date ? schedule.end_date : new Date(schedule.end_date);
      promises.push(
        client
          .query(
            `SELECT 1 FROM public.${metaTable}
             WHERE published_at IS NOT NULL
               AND published_at::date >= $1::date
               AND published_at::date <= $2::date
             LIMIT 1`,
            [startDate, endDate]
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

async function getWorksheetDoneSet() {
  // "Finish" = has at least 1 saved row with uploaded file
  const rows = await prisma.worksheet_finance.findMany({
    where: {
      file_path: { not: null },
    },
    distinct: ["department"],
    select: { department: true },
  });
  const doneDept = new Set((rows || []).map((r) => String(r.department || "").toUpperCase()));

  const done = new Set();
  for (const d of DEPARTMENTS) {
    if (doneDept.has(String(d.worksheetDept).toUpperCase())) done.add(d.key);
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

async function getAuditFindingDoneSet() {
  // "Done" = has at least 1 finding that has been published.
  // Data publish finding disimpan sebagai COMPLETED.
  const counts = await Promise.all(
    DEPARTMENTS.map((d) => {
      const model = auditFindingModelByDept[d.auditFindingDept];
      const delegate = model ? prisma[model] : null;
      if (!delegate) return Promise.resolve({ key: d.key, count: 0 });
      return delegate
        .count({
          where: {
            completion_status: {
              in: ["COMPLETED", "COMPLETE"],
              mode: "insensitive",
            },
          },
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

async function getEvidenceDoneSet(year) {
  // "Done" = has at least 1 evidence row with file AND overall_status = COMPLETE (published)
  const where = {
    file_url: { not: null },
    overall_status: { equals: "COMPLETE", mode: "insensitive" },
  };
  if (year) {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    // Gunakan updated_at sebagai tahun publish (bukan created_at),
    // supaya progress mengikuti tahun ketika evidence dipublish.
    where.updated_at = { gte: from, lt: to };
  }
  const rows = await prisma.evidence.findMany({
    where,
    distinct: ["department"],
    select: { department: true },
  });
  const doneDept = new Set((rows || []).map((r) => String(r.department || "").toUpperCase()));

  const done = new Set();
  for (const d of DEPARTMENTS) {
    if (doneDept.has(String(d.evidenceDept).toUpperCase())) done.add(d.key);
  }
  return done;
}

async function loadConfiguredModules() {
  // Returns Map(moduleKey -> Set(deptKey)) for all modules that have is_configured = true
  const configuredByModule = new Map();

  // If schedule table doesn't exist yet, return empty map
  const check = await schedulePool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema='public' AND table_name='schedule_module_feedback'
     ) AS exists`
  );
  if (!check?.rows?.[0]?.exists) return configuredByModule;

  // Get all modules that are configured (is_configured = true)
  const r = await schedulePool.query(
    `SELECT module_key, department_id
     FROM public.schedule_module_feedback
     WHERE is_configured = true
     ORDER BY module_key, department_id`
  );

  for (const row of r.rows || []) {
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

async function loadAssignmentsByUser(userName) {
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
    `SELECT module_key, department_id, user_name
     FROM public.schedule_module_feedback
     WHERE is_configured = true`
  );

  const allowedDeptKeys = new Set();
  const allowedByModule = new Map(); // moduleKey -> Set(deptKey)

  const target = String(userName || "").trim().toLowerCase();

  for (const row of r.rows || []) {
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
    const year = yearParam ? parseInt(yearParam, 10) : null;

    const [assignments, archive, configuredByModule, sopScheduleByDept, worksheetDone, auditFindingDone, evidenceDone] = await Promise.all([
      loadAssignmentsByUser(userName || null),
      loadArchive(),
      loadConfiguredModules(),
      loadSopReviewScheduleByDept(),
      getWorksheetDoneSet(),
      getAuditFindingDoneSet(),
      getEvidenceDoneSet(year),
    ]);
    const sopDone = await getSopReviewDoneSet(sopScheduleByDept);

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


