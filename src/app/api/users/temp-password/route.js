export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import pool from "@/app/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isSuperAdmin } from "@/lib/roles";

async function ensureTempPasswordColumns() {
  await pool.query(`
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS temp_password_hash TEXT,
      ADD COLUMN IF NOT EXISTS temp_password_created_at TIMESTAMPTZ
  `);
}

function normalizeUserId(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

function generateTempPassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Super admin: create/replace a one-time temporary password for a user. */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!isSuperAdmin(session?.user?.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: super admin only" },
        { status: 403 },
      );
    }

    await ensureTempPasswordColumns();

    const body = await req.json().catch(() => null);
    const userId = normalizeUserId(body?.userId);
    let password = String(body?.password || "").trim();
    const autoGenerate = body?.generate === true || !password;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 },
      );
    }

    if (autoGenerate) {
      password = generateTempPassword(10);
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Temporary password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const target = await pool.query(
      `SELECT id::text AS id, name, email, role
       FROM public.users
       WHERE id::text = $1
       LIMIT 1`,
      [userId],
    );
    const targetUser = target.rows?.[0];
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE public.users
       SET temp_password_hash = $1,
           temp_password_created_at = NOW(),
           updated_at = NOW()
       WHERE id::text = $2`,
      [passwordHash, userId],
    );

    return NextResponse.json(
      {
        success: true,
        temporaryPassword: password,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
        message: "Temporary password created. It can be used for one login only.",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/users/temp-password error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

/** Super admin: clear unused temporary password. */
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!isSuperAdmin(session?.user?.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: super admin only" },
        { status: 403 },
      );
    }

    await ensureTempPasswordColumns();

    const body = await req.json().catch(() => null);
    const userId = normalizeUserId(body?.userId);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 },
      );
    }

    await pool.query(
      `UPDATE public.users
       SET temp_password_hash = NULL,
           temp_password_created_at = NULL,
           updated_at = NOW()
       WHERE id::text = $1`,
      [userId],
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/users/temp-password error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
