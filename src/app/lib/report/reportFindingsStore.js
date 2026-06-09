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
const TABLE = "report_findings";

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      audit_year INTEGER NOT NULL,
      department TEXT NOT NULL,
      finding_html TEXT NOT NULL DEFAULT '',
      recommendation_html TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT,
      UNIQUE (audit_year, department)
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_report_findings_year
    ON ${TABLE} (audit_year);
  `);
}

/**
 * @param {number} auditYear
 * @returns {Promise<Record<string, { findingHtml: string, recommendationHtml: string }>>}
 */
export async function readReportFindingsByDept(auditYear) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const result = await client.query(
      `SELECT department, finding_html, recommendation_html
       FROM ${TABLE} WHERE audit_year = $1 ORDER BY department`,
      [auditYear],
    );
    const out = {};
    for (const row of result.rows) {
      out[row.department] = {
        findingHtml: row.finding_html || "",
        recommendationHtml: row.recommendation_html || "",
      };
    }
    return out;
  } finally {
    client.release();
  }
}

/**
 * @param {number} auditYear
 * @param {Array<{ department: string, findingHtml?: string, recommendationHtml?: string }>} rows
 * @param {string} [updatedBy]
 */
export async function upsertReportFindings(auditYear, rows, updatedBy = null) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const client = await pool.connect();
  try {
    await ensureTable(client);
    for (const row of rows) {
      const department = String(row.department || "").trim();
      if (!department) continue;
      await client.query(
        `
        INSERT INTO ${TABLE} (audit_year, department, finding_html, recommendation_html, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (audit_year, department) DO UPDATE SET
          finding_html = EXCLUDED.finding_html,
          recommendation_html = EXCLUDED.recommendation_html,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        `,
        [
          auditYear,
          department,
          String(row.findingHtml ?? ""),
          String(row.recommendationHtml ?? ""),
          updatedBy,
        ],
      );
    }
  } finally {
    client.release();
  }
}

/** @param {number} auditYear */
export async function deleteReportFindingsByYear(auditYear) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    await client.query(`DELETE FROM ${TABLE} WHERE audit_year = $1`, [auditYear]);
  } finally {
    client.release();
  }
}
