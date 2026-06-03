import pkg from "pg";

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

const deptToSummaryTable = {
  accounting: "audit_review_executive_summary_accounting",
  finance: "audit_review_executive_summary_finance",
  hrd: "audit_review_executive_summary_hrd",
  "g&a": "audit_review_executive_summary_ga",
  ga: "audit_review_executive_summary_ga",
  sdp: "audit_review_executive_summary_sdp",
  tax: "audit_review_executive_summary_tax",
  "l&p": "audit_review_executive_summary_lp",
  lp: "audit_review_executive_summary_lp",
  mis: "audit_review_executive_summary_mis",
  merch: "audit_review_executive_summary_merch",
  ops: "audit_review_executive_summary_ops",
  whs: "audit_review_executive_summary_whs",
};

export function parseAuditReviewIsLocked(value) {
  if (value === false || value === "f" || value === "false" || value === 0) return false;
  return value === true || value === "t" || value === "true" || value === 1;
}

async function readLatestSummaryRow(client, tableName) {
  const result = await client.query(
    `SELECT * FROM ${tableName} ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`,
  );
  return result.rows[0] || null;
}

/** Same rule as GET /executive-summary?year= — lock state is per audit_year. */
async function readSummaryRowForReportYear(client, tableName, reportYear) {
  if (!Number.isInteger(reportYear)) {
    return readLatestSummaryRow(client, tableName);
  }
  const byYear = await client.query(
    `SELECT * FROM ${tableName} WHERE audit_year = $1 ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`,
    [reportYear],
  );
  return byYear.rows[0] || null;
}

/**
 * Same rule as Audit Review UI: the most recently updated executive-summary row
 * controls whether findings appear in the consolidated report.
 */
export async function getAuditReviewPublishStateForReport(dept, reportYear = null) {
  const tableName = deptToSummaryTable[dept];
  if (!tableName) {
    return { isPublished: false, row: null, auditYear: reportYear };
  }

  const client = await pool.connect();
  try {
    const checkTable = await client.query(
      `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        );
      `,
      [tableName],
    );
    if (!checkTable.rows[0]?.exists) {
      return { isPublished: false, row: null, auditYear: reportYear };
    }

    const latestRow = await readSummaryRowForReportYear(client, tableName, reportYear);
    if (!latestRow) {
      return { isPublished: false, row: null, auditYear: reportYear };
    }

    const locked = parseAuditReviewIsLocked(latestRow.is_locked);
    const rowYear =
      latestRow.audit_year != null ? Number(latestRow.audit_year) : null;
    const auditYear = Number.isInteger(rowYear) ? rowYear : reportYear;

    return {
      isPublished: locked,
      row: locked ? latestRow : null,
      auditYear: Number.isInteger(auditYear) ? auditYear : reportYear,
    };
  } catch (err) {
    console.warn("[reportPublishLock]", dept, err);
    return { isPublished: false, row: null, auditYear: reportYear };
  } finally {
    client.release();
  }
}

/** @deprecated use getAuditReviewPublishStateForReport */
export async function isAuditReviewPublishedForReport(dept, auditYear = null) {
  const state = await getAuditReviewPublishStateForReport(dept, auditYear);
  return state.isPublished;
}
