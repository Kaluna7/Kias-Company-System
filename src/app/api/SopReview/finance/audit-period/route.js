export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pkg from "pg";
const { Pool } = pkg;

// Reuse global pool to avoid too many clients in dev/serverless
if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}
const pool = global._pgPool;

const SELECT_COLUMNS = [
  "id",
  "department_name",
  "audit_period_start",
  "audit_period_end",
  "created_at",
  "updated_at",
].join(", ");

// GET: retrieve audit period data
export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Check if table exists, if not return empty
      const checkTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'audit_period_finance'
        );
      `);
      
      if (!checkTable.rows[0].exists) {
        return NextResponse.json({ success: true, rows: [] }, { status: 200 });
      }

      const q = `SELECT ${SELECT_COLUMNS} FROM audit_period_finance ORDER BY id DESC LIMIT 1`;
      const r = await client.query(q);
      return NextResponse.json({ success: true, rows: r.rows }, { status: 200 });
    } catch (dbErr) {
      console.error("DB error SELECT audit_period_finance:", dbErr);
      return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Connection error GET /api/SopReview/finance/audit-period:", err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}

// POST: insert or update audit period data
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      audit_period_start,
      audit_period_end,
    } = body || {};

    if (!audit_period_start || !audit_period_end) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: audit_period_start, audit_period_end" },
        { status: 400 }
      );
    }

    if (new Date(audit_period_start) > new Date(audit_period_end)) {
      return NextResponse.json(
        { success: false, error: "Start date must be before end date" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Create table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_period_finance (
          id SERIAL PRIMARY KEY,
          department_name VARCHAR(255) DEFAULT 'Finance',
          audit_period_start DATE NOT NULL,
          audit_period_end DATE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Check if record exists
      const checkQ = `SELECT id FROM audit_period_finance WHERE department_name = 'Finance' LIMIT 1`;
      const checkR = await client.query(checkQ);

      let result;
      if (checkR.rows.length > 0) {
        // Update existing record
        const updateQ = `
          UPDATE audit_period_finance 
          SET audit_period_start = $1, audit_period_end = $2, updated_at = NOW()
          WHERE department_name = 'Finance'
          RETURNING ${SELECT_COLUMNS}
        `;
        const updateR = await client.query(updateQ, [audit_period_start, audit_period_end]);
        result = updateR.rows[0];
      } else {
        // Insert new record
        const insertQ = `
          INSERT INTO audit_period_finance 
            (department_name, audit_period_start, audit_period_end, updated_at)
          VALUES 
            ('Finance', $1, $2, NOW())
          RETURNING ${SELECT_COLUMNS}
        `;
        const insertR = await client.query(insertQ, [audit_period_start, audit_period_end]);
        result = insertR.rows[0];
      }

      return NextResponse.json({ success: true, inserted: result }, { status: 200 });
    } catch (dbErr) {
      console.error("DB insert/update audit_period_finance failed:", dbErr);
      return NextResponse.json({ success: false, error: "DB insert/update failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Unexpected error POST /api/SopReview/finance/audit-period:", err);
    return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
  }
}

