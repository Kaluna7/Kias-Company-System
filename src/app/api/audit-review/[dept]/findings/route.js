import { NextResponse } from "next/server";
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

const deptToTable = {
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

function getTableName(dept) {
  return deptToTable[dept] || null;
}

function parseRows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req, { params }) {
  try {
    const p = await params;
    const dept = p?.dept;
    const tableName = getTableName(dept);

    if (!tableName) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : null;
    const hasValidYear = Number.isInteger(year);

    const client = await pool.connect();
    try {
      const checkTable = await client.query(
        `
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
          );
        `,
        [tableName],
      );

      if (!checkTable.rows?.[0]?.exists) {
        return NextResponse.json({ success: true, rows: [], data: null }, { status: 200 });
      }

      const result = hasValidYear
        ? await client.query(
            `SELECT * FROM ${tableName} WHERE audit_year = $1 ORDER BY id DESC LIMIT 1`,
            [year],
          )
        : await client.query(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 1`);

      const row = result.rows?.[0] || null;
      return NextResponse.json(
        {
          success: true,
          data: row,
          rows: parseRows(row?.findings_json),
        },
        { status: 200 },
      );
    } catch (dbErr) {
      console.error(`DB error GET ${tableName}:`, dbErr);
      return NextResponse.json(
        { success: false, error: "DB error", details: String(dbErr) },
        { status: 500 },
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/audit-review/[dept]/findings error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    const p = await params;
    const dept = p?.dept;
    const tableName = getTableName(dept);

    if (!tableName) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const body = await req.json();
    const auditYearRaw = body?.auditYear;
    const auditYear = Number.isFinite(Number(auditYearRaw))
      ? parseInt(String(auditYearRaw), 10)
      : new Date().getFullYear();
    const findings = Array.isArray(body?.findings) ? body.findings : [];

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          audit_year INTEGER,
          findings_json TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${tableName}_audit_year_unique ON ${tableName}(audit_year)`,
      );

      const payload = JSON.stringify(findings);
      const existing = await client.query(
        `SELECT id FROM ${tableName} WHERE audit_year = $1 ORDER BY id DESC LIMIT 1`,
        [auditYear],
      );

      if (existing.rows.length > 0) {
        const updated = await client.query(
          `
            UPDATE ${tableName}
            SET findings_json = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
          `,
          [payload, existing.rows[0].id],
        );

        return NextResponse.json(
          {
            success: true,
            data: updated.rows[0],
            rows: findings,
          },
          { status: 200 },
        );
      }

      const inserted = await client.query(
        `
          INSERT INTO ${tableName} (audit_year, findings_json)
          VALUES ($1, $2)
          RETURNING *
        `,
        [auditYear, payload],
      );

      return NextResponse.json(
        {
          success: true,
          data: inserted.rows[0],
          rows: findings,
        },
        { status: 200 },
      );
    } catch (dbErr) {
      console.error(`DB error POST ${tableName}:`, dbErr);
      return NextResponse.json(
        { success: false, error: "DB error", details: String(dbErr) },
        { status: 500 },
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /api/audit-review/[dept]/findings error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
