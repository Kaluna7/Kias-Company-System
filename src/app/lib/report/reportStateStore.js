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

const TABLE = "consolidated_report_state";

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      audit_year INTEGER PRIMARY KEY,
      state_json TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT
    );
  `);
}

/**
 * @param {number} auditYear
 * @returns {Promise<object|null>}
 */
export async function readReportState(auditYear) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const result = await client.query(
      `SELECT state_json FROM ${TABLE} WHERE audit_year = $1`,
      [auditYear],
    );
    if (!result.rows[0]?.state_json) return null;
    try {
      const parsed = JSON.parse(result.rows[0].state_json);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  } finally {
    client.release();
  }
}

/**
 * @param {number} auditYear
 * @param {object} state
 * @param {string} [updatedBy]
 */
export async function writeReportState(auditYear, state, updatedBy = null) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const json = JSON.stringify(state ?? {});
    await client.query(
      `
        INSERT INTO ${TABLE} (audit_year, state_json, updated_at, updated_by)
        VALUES ($1, $2, NOW(), $3)
        ON CONFLICT (audit_year) DO UPDATE SET
          state_json = EXCLUDED.state_json,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
      `,
      [auditYear, json, updatedBy],
    );
  } finally {
    client.release();
  }
}

/** @param {number} auditYear */
export async function deleteReportState(auditYear) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    await client.query(`DELETE FROM ${TABLE} WHERE audit_year = $1`, [auditYear]);
  } finally {
    client.release();
  }
}

/** Fields persisted from report preview edits */
export function pickReportStatePayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  return {
    appendices: raw.appendices ?? null,
    executiveSummaryHtml: raw.executiveSummaryHtml ?? "",
    auditObjectivesScopeHtml: raw.auditObjectivesScopeHtml ?? "",
    auditApproachMethodologyHtml: raw.auditApproachMethodologyHtml ?? "",
    conclusionValues:
      raw.conclusionValues && typeof raw.conclusionValues === "object"
        ? raw.conclusionValues
        : {},
    findingSections: Array.isArray(raw.findingSections) ? raw.findingSections : [],
    hiddenAuditFindingEdits:
      raw.hiddenAuditFindingEdits && typeof raw.hiddenAuditFindingEdits === "object"
        ? raw.hiddenAuditFindingEdits
        : {},
    auditVisibleByDept:
      raw.auditVisibleByDept && typeof raw.auditVisibleByDept === "object"
        ? raw.auditVisibleByDept
        : {},
    onlyOfficeSyncedAt: raw.onlyOfficeSyncedAt ?? null,
    onlyOfficeSyncRevision: Number(raw.onlyOfficeSyncRevision) || 0,
    onlyOfficeSessionId: raw.onlyOfficeSessionId ?? null,
    moduleTablesRevision: Number(raw.moduleTablesRevision) || 0,
    moduleTablesSyncedAt: raw.moduleTablesSyncedAt ?? null,
    hubRevision: Number(raw.hubRevision) || 0,
    hubSyncedAt: raw.hubSyncedAt ?? null,
    wordFindingsHtml: raw.wordFindingsHtml ?? "",
    wordAppendicesHtml: raw.wordAppendicesHtml ?? "",
    reportBlocks:
      raw.reportBlocks && typeof raw.reportBlocks === "object" ? raw.reportBlocks : null,
    userNotes: Array.isArray(raw.userNotes) ? raw.userNotes : [],
    userFindingsFreeHtml: raw.userFindingsFreeHtml ?? "",
    wordFrontMatterHtml: raw.wordFrontMatterHtml ?? "",
    reportPapers:
      raw.reportPapers && typeof raw.reportPapers === "object" ? raw.reportPapers : {},
    findingsPaperRevision: Number(raw.findingsPaperRevision) || 0,
    findingsPaperResetAt: raw.findingsPaperResetAt ?? null,
    lastChangedPaperIds: Array.isArray(raw.lastChangedPaperIds) ? raw.lastChangedPaperIds : [],
    auditTeam: Array.isArray(raw.auditTeam) ? raw.auditTeam : [],
    preparedBy: Array.isArray(raw.preparedBy) ? raw.preparedBy : [],
    auditCommitteeName:
      typeof raw.auditCommitteeName === "string" ? raw.auditCommitteeName : "",
    auditCommitteeDate:
      typeof raw.auditCommitteeDate === "string" ? raw.auditCommitteeDate : "",
    presidentDirectorName:
      typeof raw.presidentDirectorName === "string" ? raw.presidentDirectorName : "",
    presidentDirectorDate:
      typeof raw.presidentDirectorDate === "string" ? raw.presidentDirectorDate : "",
    periodStart: typeof raw.periodStart === "string" ? raw.periodStart : "",
    periodEnd: typeof raw.periodEnd === "string" ? raw.periodEnd : "",
    auditCoverage: typeof raw.auditCoverage === "string" ? raw.auditCoverage : "",
    departmentCoverage:
      typeof raw.departmentCoverage === "string" ? raw.departmentCoverage : "",
    area: typeof raw.area === "string" ? raw.area : "",
  };
}
