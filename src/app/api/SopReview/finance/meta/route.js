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
  "sop_status",
  "preparer_status",
  "preparer_name",
  "preparer_date",
  "reviewer_comment",
  "reviewer_status",
  "reviewer_name",
  "reviewer_date",
].join(", ");

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const q = `SELECT ${SELECT_COLUMNS} FROM sop_finance ORDER BY id DESC LIMIT 10`;
      const r = await client.query(q);
      return NextResponse.json({ success: true, rows: r.rows }, { status: 200 });
    } catch (dbErr) {
      console.error("DB error SELECT sop_finance:", dbErr);
      return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Connection error GET /api/SopReview/finance/meta:", err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      department_name, // Tidak digunakan karena generated column
      sop_status,
      preparer_status,
      preparer_name,
      preparer_date,
      reviewer_comment,
      reviewer_status,
      reviewer_name,
      reviewer_date,
    } = body || {};

    if (!sop_status && !preparer_status && !reviewer_status) {
      return NextResponse.json(
        { success: false, error: "Payload kosong. Sertakan minimal status." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // department_name adalah generated column, jadi tidak di-insert
      // Kolom ini akan otomatis terisi dengan default value "Finance" oleh database
      const q = `
        INSERT INTO sop_finance
          (sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING ${SELECT_COLUMNS}
      `;
      const vals = [
        sop_status || null,
        preparer_status || null,
        preparer_name || null,
        preparer_date || null,
        reviewer_comment || null,
        reviewer_status || null,
        reviewer_name || null,
        reviewer_date || null,
      ];
      const r = await client.query(q, vals);
      return NextResponse.json({ success: true, inserted: r.rows[0] }, { status: 200 });
    } catch (dbErr) {
      console.error("DB insert sop_finance failed:", dbErr);
      return NextResponse.json({ success: false, error: "DB insert failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Unexpected error POST /api/SopReview/finance/meta:", err);
    return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
  }
}

