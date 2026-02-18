export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/app/lib/db";

function toIntSafe(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export async function GET(req) {
  try {
    const url = req?.url ? new URL(req.url) : null;
    const page = url ? Math.max(1, toIntSafe(url.searchParams.get("page"), 1)) : 1;
    const pageSize = url ? Math.max(1, Math.min(100, toIntSafe(url.searchParams.get("pageSize"), 50))) : 50;
    const offset = (page - 1) * pageSize;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.users WHERE role IS NULL OR LOWER(role) <> 'admin'`
    );
    const total = countRes.rows?.[0]?.total ?? 0;

    const r = await pool.query(
      `SELECT id, name, email, role
       FROM public.users
       WHERE role IS NULL OR LOWER(role) <> 'admin'
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    const users = r.rows || [];
    return NextResponse.json(
      { success: true, users, meta: { total, page, pageSize } },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


