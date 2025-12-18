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
  "department_id",
  "department_name",
  "user_name",
  "start_date",
  "end_date",
  "days",
  "created_at",
  "updated_at",
].join(", ");

// GET: retrieve schedule data
export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Check if table exists, if not return empty array
      const checkTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schedule_preparer_feedback'
        );
      `);
      
      if (!checkTable.rows[0].exists) {
        return NextResponse.json({ success: true, rows: [] }, { status: 200 });
      }

      const q = `SELECT ${SELECT_COLUMNS} FROM schedule_preparer_feedback ORDER BY department_id, id DESC`;
      const r = await client.query(q);
      return NextResponse.json({ success: true, rows: r.rows }, { status: 200 });
    } catch (dbErr) {
      console.error("DB error SELECT schedule_preparer_feedback:", dbErr);
      return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Connection error GET /api/schedule:", err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}

// POST: insert or update schedule data
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      department_id,
      department_name,
      user_name,
      start_date,
      end_date,
    } = body || {};

    if (!department_id || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: department_id, start_date, end_date" },
        { status: 400 }
      );
    }

    // Calculate days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (days < 0) {
      return NextResponse.json(
        { success: false, error: "End date must be after start date" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Create table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS schedule_preparer_feedback (
          id SERIAL PRIMARY KEY,
          department_id VARCHAR(20) NOT NULL,
          department_name VARCHAR(255),
          user_name VARCHAR(255),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          days INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(department_id)
        );
      `);

      // Upsert (insert or update)
      const q = `
        INSERT INTO schedule_preparer_feedback 
          (department_id, department_name, user_name, start_date, end_date, days, updated_at)
        VALUES 
          ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (department_id) 
        DO UPDATE SET
          department_name = EXCLUDED.department_name,
          user_name = EXCLUDED.user_name,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          days = EXCLUDED.days,
          updated_at = NOW()
        RETURNING ${SELECT_COLUMNS}
      `;
      const vals = [
        department_id,
        department_name || null,
        user_name || null,
        start_date,
        end_date,
        days,
      ];
      const r = await client.query(q, vals);
      return NextResponse.json({ success: true, inserted: r.rows[0] }, { status: 200 });
    } catch (dbErr) {
      console.error("DB insert/update schedule_preparer_feedback failed:", dbErr);
      return NextResponse.json({ success: false, error: "DB insert/update failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Unexpected error POST /api/schedule:", err);
    return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
  }
}

