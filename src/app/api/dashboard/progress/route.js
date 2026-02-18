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

async function getSopReviewDoneSet() {
  // "Finish" = already published into report tables; use one connection and parallel checks
  const client = await pool.connect();
  try {
    const promises = [];
    const deptByIndex = [];
    for (const d of DEPARTMENTS) {
      const stepsTable = `sops_report_${d.sopSlug}`;
      const metaTable = `sop_report_${d.sopSlug}`;
      deptByIndex.push(d.key);
      promises.push(
        client.query(`SELECT 1 FROM public.${metaTable} LIMIT 1`).then((r) => (r?.rowCount ?? 0) > 0).catch(() => false)
      );
      promises.push(
        client.query(`SELECT 1 FROM public.${stepsTable} LIMIT 1`).then((r) => (r?.rowCount ?? 0) > 0).catch(() => false)
      );
    }
    const results = await Promise.all(promises);
    const done = new Set();
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      const has = results[i * 2] || results[i * 2 + 1];
      if (has) done.add(deptByIndex[i]);
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
  const counts = await Promise.all(
    DEPARTMENTS.map((d) => {
      const model = auditFindingModelByDept[d.auditFindingDept];
      const delegate = model ? prisma[model] : null;
      if (!delegate) return Promise.resolve({ key: d.key, count: 0 });
      return delegate.count().then((count) => ({ key: d.key, count }));
    })
  );
  const done = new Set();
  for (const { key, count } of counts) {
    if (count > 0) done.add(key);
  }
  return done;
}

async function getEvidenceDoneSet() {
  // "Finish" = has at least 1 uploaded evidence file
  const rows = await prisma.evidence.findMany({
    where: { file_url: { not: null } },
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

  // schedule_module_feedback stores: module_key, department_id, user_name
  // Only get assignments that are configured (is_configured = true)
  const r = await schedulePool.query(
    `SELECT module_key, department_id
     FROM public.schedule_module_feedback
     WHERE user_name = $1 AND is_configured = true`,
    [userName]
  );

  const allowedDeptKeys = new Set();
  const allowedByModule = new Map(); // moduleKey -> Set(deptKey)

  for (const row of r.rows || []) {
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

    const [assignments, archive, configuredByModule, sopDone, worksheetDone, auditFindingDone, evidenceDone] = await Promise.all([
      loadAssignmentsByUser(userName || null),
      loadArchive(),
      loadConfiguredModules(),
      getSopReviewDoneSet(),
      getWorksheetDoneSet(),
      getAuditFindingDoneSet(),
      getEvidenceDoneSet(),
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


