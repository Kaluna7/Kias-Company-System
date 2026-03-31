import { NextResponse } from "next/server";
import pkg from "pg";
const { Pool } = pkg;

// Reuse global pool to avoid too many clients
if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}
const pool = global._pgPool;

// Map department to table name
const deptToTable = {
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

function getTableName(dept) {
  return deptToTable[dept] || null;
}

export async function GET(req, { params }) {
  try {
    const p = await params;
    const dept = p?.dept;
    const tableName = getTableName(dept);
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : null;
    const hasValidYear = Number.isInteger(year);
    
    if (!tableName) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Check if table exists, if not return null
      const checkTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      if (!checkTable.rows[0].exists) {
        return NextResponse.json({ success: true, data: null }, { status: 200 });
      }

      await client.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS audit_year INTEGER
      `);

      const result = hasValidYear
        ? await client.query(
            `SELECT * FROM ${tableName} WHERE audit_year = $1 ORDER BY id DESC LIMIT 1`,
            [year],
          )
        : await client.query(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 1`);

      return NextResponse.json({ 
        success: true, 
        data: result.rows[0] || null 
      }, { status: 200 });
    } catch (dbErr) {
      console.error(`DB error GET ${tableName}:`, dbErr);
      return NextResponse.json({ success: false, error: "DB error", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`GET /api/audit-review/[dept]/executive-summary error:`, err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 }
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
    const client = await pool.connect();
    
    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          audit_year INTEGER,
          objective_of_audit TEXT,
          scope_areas_covered TEXT,
          scope_methodology TEXT,
          scope_timeframe_audit_period TEXT,
          scope_timeframe_fieldwork_dates TEXT,
          limitations_scope TEXT,
          limitations_time TEXT,
          limitations_resource TEXT,
          internal_audit_team TEXT,
          is_locked BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE
      `);
      await client.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS audit_year INTEGER
      `);
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${tableName}_audit_year_unique ON ${tableName}(audit_year)`
      );

      // Check if record exists for this audit year
      const existing = await client.query(
        `SELECT id FROM ${tableName} WHERE audit_year = $1 ORDER BY id DESC LIMIT 1`,
        [auditYear],
      );
      
      if (existing.rows.length > 0) {
        // Update existing record
        await client.query(`
          UPDATE ${tableName} SET
            audit_year = $1,
            objective_of_audit = $2,
            scope_areas_covered = $3,
            scope_methodology = $4,
            scope_timeframe_audit_period = $5,
            scope_timeframe_fieldwork_dates = $6,
            limitations_scope = $7,
            limitations_time = $8,
            limitations_resource = $9,
            internal_audit_team = $10,
            is_locked = $11,
            updated_at = NOW()
          WHERE id = $12
        `, [
          auditYear,
          body.objectiveOfAudit || null,
          body.scopeAreasCovered || null,
          body.scopeMethodology || null,
          body.scopeTimeframeAuditPeriod || null,
          body.scopeTimeframeFieldworkDates || null,
          body.limitationsScope || null,
          body.limitationsTime || null,
          body.limitationsResource || null,
          body.internalAuditTeam || null,
          body.isLocked === true,
          existing.rows[0].id,
        ]);
        
        const updated = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [existing.rows[0].id]);
        return NextResponse.json({ success: true, data: updated.rows[0] }, { status: 200 });
      } else {
        // Create new record
        const result = await client.query(`
          INSERT INTO ${tableName} (
            audit_year,
            objective_of_audit,
            scope_areas_covered,
            scope_methodology,
            scope_timeframe_audit_period,
            scope_timeframe_fieldwork_dates,
            limitations_scope,
            limitations_time,
            limitations_resource,
            internal_audit_team,
            is_locked
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `, [
          auditYear,
          body.objectiveOfAudit || null,
          body.scopeAreasCovered || null,
          body.scopeMethodology || null,
          body.scopeTimeframeAuditPeriod || null,
          body.scopeTimeframeFieldworkDates || null,
          body.limitationsScope || null,
          body.limitationsTime || null,
          body.limitationsResource || null,
          body.internalAuditTeam || null,
          body.isLocked === true,
        ]);
        
        return NextResponse.json({ success: true, data: result.rows[0] }, { status: 200 });
      }
    } catch (dbErr) {
      console.error(`DB error POST ${tableName}:`, dbErr);
      return NextResponse.json({ success: false, error: "DB error", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`POST /api/audit-review/[dept]/executive-summary error:`, err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

