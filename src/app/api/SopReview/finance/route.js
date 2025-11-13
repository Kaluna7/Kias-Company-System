// app/api/SopReview/finance/route.js
import { NextResponse } from "next/server";
import pkg from "pg";
const { Pool } = pkg;

// global pool to avoid too many clients in serverless env
if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}
const pool = global._pgPool;

export async function POST(req) {
  try {
    const text = await req.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      console.error("POST /api/SopReview/finance: JSON parse error. Raw body:", text);
      return NextResponse.json({ success: false, error: "Invalid JSON", raw: text }, { status: 400 });
    }

    let sopsArray = null;
    if (Array.isArray(body)) sopsArray = body;
    else if (Array.isArray(body?.sops)) sopsArray = body.sops;
    else if (body && typeof body === "object" && (body.sop_related || body.name)) sopsArray = [body];

    if (!sopsArray) {
      console.error("POST /api/SopReview/finance: unexpected payload shape:", body);
      return NextResponse.json(
        { success: false, error: "Invalid payload shape. Send array or { sops: [...] } or single item with sop_related." },
        { status: 400 }
      );
    }

    if (sopsArray.length === 0) {
      return NextResponse.json({ success: false, error: "Empty array provided" }, { status: 400 });
    }

    for (const it of sopsArray) {
      if (!it.sop_related && !it.name) {
        return NextResponse.json({ success: false, error: "Each item must have sop_related (or name)." }, { status: 400 });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = [];
      for (const item of sopsArray) {
        const q = `INSERT INTO sops_finance (no, sop_related, status, comment, reviewer)
                   VALUES ($1,$2,$3,$4,$5) RETURNING *`;
        const vals = [item.no ?? null, (item.sop_related ?? item.name ?? "").trim(), item.status ?? "DRAFT", item.comment ?? "", item.reviewer ?? ""];
        const r = await client.query(q, vals);
        inserted.push(r.rows[0]);
      }
      await client.query("COMMIT");
      return NextResponse.json({ success: true, inserted });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      console.error("DB error inserting sops_finance:", dbErr);
      return NextResponse.json({ success: false, error: "DB insert failed" }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Unexpected error POST /api/SopReview/finance:", err);
    return NextResponse.json({ success: false, error: "Unexpected server error" }, { status: 500 });
  }
}
