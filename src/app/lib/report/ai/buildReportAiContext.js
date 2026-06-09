import pkg from "pg";
import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";
import { readReportState } from "@/app/lib/report/reportStateStore";
import { readMeta } from "@/app/lib/report/documentStore";
import { buildDeptExecutiveSummaryFromRow } from "@/app/utils/parseStoredJsonList";
import { REPORT_AI_DEPARTMENTS } from "./reportDepartments";
import { htmlToPlainText } from "./htmlToPlainText";

const { Pool } = pkg;

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

const pool = global._pgPool;

const deptToFindingsTable = {
  accounting: "audit_review_findings_accounting",
  finance: "audit_review_findings_finance",
  hrd: "audit_review_findings_hrd",
  "g&a": "audit_review_findings_ga",
  ga: "audit_review_findings_ga",
  sdp: "audit_review_findings_sdp",
  tax: "audit_review_findings_tax",
  "l&p": "audit_review_findings_lp",
  lp: "audit_review_findings_lp",
  mis: "audit_review_findings_mis",
  merch: "audit_review_findings_merch",
  ops: "audit_review_findings_ops",
  whs: "audit_review_findings_whs",
};

function parseFindingsJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadAuditFindingsRows(apiPath, year) {
  const tableName = deptToFindingsTable[apiPath];
  if (!tableName) return [];

  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      )`,
      [tableName],
    );
    if (!check.rows[0]?.exists) return [];

    const result = await client.query(
      `SELECT findings_json FROM ${tableName} WHERE audit_year = $1 ORDER BY id DESC LIMIT 1`,
      [year],
    );
    return parseFindingsJson(result.rows[0]?.findings_json);
  } catch {
    return [];
  } finally {
    client.release();
  }
}

function summarizeAuditRow(row, index) {
  return {
    no: index + 1,
    riskId: row.riskId ?? row.risk_id ?? "",
    riskLevel: row.riskLevel ?? row.risk ?? "",
    findingDescription: (row.findingDescription ?? row.finding_description ?? "").toString().slice(0, 800),
    recommendation: (row.recommendation ?? "").toString().slice(0, 500),
    findingResult: (row.findingResult ?? row.finding_result ?? "").toString().slice(0, 300),
  };
}

function summarizeSopRow(row, index) {
  return {
    no: row.no ?? index + 1,
    sopRelated: (row.sopRelated || "").toString().slice(0, 600),
    reviewComment: (row.reviewComment || "").toString().slice(0, 500),
    auditeeComment: (row.auditeeComment || "").toString().slice(0, 400),
    followUpDetail: (row.followUpDetail || "").toString().slice(0, 400),
  };
}

function sectionRowsFromSavedOrClient(savedSection, clientSection) {
  const section = clientSection && typeof clientSection === "object" ? clientSection : savedSection;
  if (!section || typeof section !== "object") {
    return { sopRows: [], auditRows: [], executiveSummary: null };
  }
  return {
    sopRows: (section.sopRows || []).slice(0, 50).map(summarizeSopRow),
    auditRows: (section.auditRows || []).slice(0, 40).map(summarizeAuditRow),
    executiveSummary: section.executiveSummary
      ? buildDeptExecutiveSummaryFromRow(section.executiveSummary)
      : null,
  };
}

/**
 * Build structured context for report AI from DB + session (server-only).
 * @param {{ sessionId?: string, year?: number }} options
 */
export async function buildReportAiContext(options = {}) {
  let sessionId = String(options.sessionId || "").trim();
  let year = Number(options.year);

  let meta = {};
  if (sessionId) {
    meta = (await readMeta(sessionId)) || {};
    if (!Number.isFinite(year)) {
      year = Number(meta.year) || new Date().getFullYear();
    }
  } else if (Number.isFinite(year)) {
    sessionId = `shared-report-${year}`;
  } else {
    throw new Error("year or sessionId required");
  }
  const savedState = (await readReportState(year)) || {};

  const departments = [];

  for (const dept of REPORT_AI_DEPARTMENTS) {
    const publish = await getAuditReviewPublishStateForReport(dept.apiPath, year);
    const isPublished = publish.isPublished === true;
    const execSummary = isPublished
      ? buildDeptExecutiveSummaryFromRow(publish.row)
      : null;

    let auditFindings = [];
    if (isPublished) {
      const rows = await loadAuditFindingsRows(dept.apiPath, year);
      auditFindings = rows.slice(0, 40).map(summarizeAuditRow);
    }

    const savedConclusion = (savedState.conclusionValues || {})[dept.key] || "";

    if (!isPublished && auditFindings.length === 0 && !savedConclusion && !execSummary) {
      continue;
    }

    departments.push({
      deptKey: dept.key,
      deptLabel: dept.label,
      isPublishedToReport: isPublished,
      executiveSummary: execSummary,
      auditFindingsCount: auditFindings.length,
      auditFindings,
      savedConclusion: String(savedConclusion).trim().slice(0, 4000),
    });
  }

  return {
    sessionId,
    year,
    reportTitle: meta.title || `KIAS Consolidated Report ${year}`,
    globalExecutiveSummary: htmlToPlainText(savedState.executiveSummaryHtml || "").slice(0, 6000),
    auditObjectivesScope: htmlToPlainText(savedState.auditObjectivesScopeHtml || "").slice(0, 4000),
    auditApproachMethodology: htmlToPlainText(savedState.auditApproachMethodologyHtml || "").slice(0, 4000),
    departments,
  };
}

export function formatReportAiContextForPrompt(context) {
  return JSON.stringify(context, null, 2).slice(0, 120000);
}

/**
 * Focused context for one department conclusion (SOP review + audit findings).
 * @param {{ sessionId?: string, year?: number, deptKey: string, deptSection?: object }} options
 */
export async function buildDeptConclusionAiContext(options = {}) {
  const deptKey = String(options.deptKey || "").trim();
  const dept = REPORT_AI_DEPARTMENTS.find((d) => d.key === deptKey);
  if (!dept) {
    throw new Error(`Unknown department: ${deptKey || "(empty)"}`);
  }

  let sessionId = String(options.sessionId || "").trim();
  let year = Number(options.year);

  let meta = {};
  if (sessionId) {
    meta = (await readMeta(sessionId)) || {};
    if (!Number.isFinite(year)) {
      year = Number(meta.year) || new Date().getFullYear();
    }
  } else if (Number.isFinite(year)) {
    sessionId = `shared-report-${year}`;
  } else {
    throw new Error("year or sessionId required");
  }

  const savedState = (await readReportState(year)) || {};
  const savedSection = (savedState.findingSections || []).find((s) => s.deptKey === deptKey);
  let { sopRows, auditRows, executiveSummary } = sectionRowsFromSavedOrClient(
    savedSection,
    options.deptSection,
  );

  const publish = await getAuditReviewPublishStateForReport(dept.apiPath, year);
  const isPublished = publish.isPublished === true;

  if (!executiveSummary && isPublished) {
    executiveSummary = buildDeptExecutiveSummaryFromRow(publish.row);
  }

  if (auditRows.length === 0 && isPublished) {
    const rows = await loadAuditFindingsRows(dept.apiPath, year);
    auditRows = rows.slice(0, 40).map(summarizeAuditRow);
  }

  const savedConclusion = (savedState.conclusionValues || {})[dept.key] || "";

  return {
    sessionId,
    year,
    reportTitle: meta.title || `KIAS Consolidated Report ${year}`,
    department: {
      deptKey: dept.key,
      deptLabel: dept.label,
      isPublishedToReport: isPublished,
      executiveSummary,
      sopReviewCount: sopRows.length,
      sopReview: sopRows,
      auditFindingsCount: auditRows.length,
      auditFindings: auditRows,
      savedConclusion: String(savedConclusion).trim().slice(0, 4000),
    },
  };
}
