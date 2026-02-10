export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/app/lib/db";

export async function GET() {
  try {
    const r = await pool.query(
      `SELECT id, name, email, role
       FROM public.users
       WHERE role IS NULL OR LOWER(role) <> 'admin'
       ORDER BY name ASC`
    );
    return NextResponse.json({ success: true, users: r.rows || [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


