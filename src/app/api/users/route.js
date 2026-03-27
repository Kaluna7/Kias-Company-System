export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import pool from "@/app/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
      `SELECT id, name, email, role, COALESCE(avatar_url, '') AS avatar_url
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

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin only" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const name = (body?.name || "").trim();
    const email = (body?.email || "").toLowerCase().trim();
    const password = String(body?.password || "");
    const rawRole = (body?.role || "user").toLowerCase().trim();
    const allowedRoles = new Set(["user", "reviewer"]);
    const userRole = allowedRoles.has(rawRole) ? rawRole : "user";

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "name, email, and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const exists = await pool.query(
      `SELECT id FROM public.users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );
    if (exists.rows?.length) {
      return NextResponse.json(
        { success: false, error: "Email already exists" },
        { status: 409 }
      );
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await pool.query(
      `INSERT INTO public.users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, COALESCE(avatar_url, '') AS avatar_url`,
      [name, email, passwordHash, userRole]
    );

    return NextResponse.json(
      { success: true, user: created.rows?.[0] || null },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin only" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const id = Number(body?.id || 0);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid user id is required" },
        { status: 400 }
      );
    }

    // Safety: never delete admin account from this endpoint.
    const target = await pool.query(
      `SELECT id, LOWER(COALESCE(role, '')) AS role FROM public.users WHERE id = $1 LIMIT 1`,
      [id]
    );
    const targetUser = target.rows?.[0];
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }
    if (targetUser.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Cannot delete admin user" },
        { status: 403 }
      );
    }

    await pool.query(`DELETE FROM public.users WHERE id = $1`, [id]);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/users error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

