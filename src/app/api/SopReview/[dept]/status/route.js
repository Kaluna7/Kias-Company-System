export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { resolveSopDept } from "@/app/api/SopReview/_shared/dept";

async function hasRows(tableName) {
  const client = await pool.connect();
  try {
    const reg = await client.query("SELECT to_regclass($1) AS t", [`public.${tableName}`]);
    if (!reg?.rows?.[0]?.t) return false;
    const r = await client.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return (r?.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const resolved = resolveSopDept(dept);
    if (!resolved) return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });

    const stepsTable = `sops_${resolved.slug}`;
    const available = await hasRows(stepsTable);
    return NextResponse.json(
      { success: true, status: available ? "AVAILABLE" : "Not Available" },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/SopReview/[dept]/status error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


