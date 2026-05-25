import { pool } from "@/app/api/SopReview/_shared/pool";

function qIdent(name) {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}

const deptToSlug = {
  accounting: "accounting",
  finance: "finance",
  hrd: "hrd",
  "g&a": "ga",
  ga: "ga",
  sdp: "sdp",
  tax: "tax",
  "l&p": "lp",
  lp: "lp",
  mis: "mis",
  merch: "merch",
  ops: "ops",
  whs: "whs",
};

const deptToName = {
  accounting: "ACCOUNTING",
  finance: "FINANCE",
  hrd: "HRD",
  "g&a": "G&A",
  ga: "G&A",
  sdp: "STORE DESIGN PLANNER",
  tax: "TAX",
  "l&p": "SECURITY L&P",
  lp: "SECURITY L&P",
  mis: "MIS",
  merch: "MERCHANDISE",
  ops: "OPERATIONAL",
  whs: "WAREHOUSE",
};

const SELECT_COLUMNS = [
  "id",
  "department_name",
  "preparer_status",
  "final_status",
  "finding_result",
  "finding_result_file_name",
  "report_as",
  "prepare",
  "prepare_date",
  "review",
  "review_date",
  "created_at",
  "updated_at",
].join(", ");

/**
 * Server-only: baca meta audit finding tanpa HTTP loopback (hindari hang di Docker).
 * @param {string} dept apiPath, e.g. "finance"
 * @param {number|null} year
 * @returns {Promise<object|null>}
 */
export async function getAuditFindingMetaRecord(dept, year) {
  const slug = deptToSlug[String(dept || "").toLowerCase()];
  const departmentName = deptToName[dept?.toLowerCase()] || dept?.toUpperCase() || "";
  if (!slug) return null;

  const metaTable = qIdent(`audit_finding_meta_${slug}`);
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${metaTable} (
        id SERIAL PRIMARY KEY,
        department_name VARCHAR(255) DEFAULT '${departmentName.replace(/'/g, "''")}',
        preparer_status VARCHAR(50),
        final_status VARCHAR(50),
        finding_result TEXT,
        finding_result_file_name VARCHAR(255),
        report_as VARCHAR(50),
        prepare VARCHAR(255),
        prepare_date DATE,
        review VARCHAR(255),
        review_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const parsedYear = year != null && Number.isFinite(Number(year)) ? Number(year) : null;
    let r;
    if (parsedYear != null) {
      const from = new Date(parsedYear, 0, 1);
      const to = new Date(parsedYear + 1, 0, 1);
      r = await client.query(
        `SELECT ${SELECT_COLUMNS} FROM ${metaTable}
         WHERE created_at >= $1 AND created_at < $2
         ORDER BY id DESC
         LIMIT 1`,
        [from, to],
      );
    } else {
      r = await client.query(
        `SELECT ${SELECT_COLUMNS} FROM ${metaTable} ORDER BY id DESC LIMIT 1`,
      );
    }
    return r.rows[0] || null;
  } finally {
    client.release();
  }
}
