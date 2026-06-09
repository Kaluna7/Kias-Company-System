export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/app/lib/db";

async function getCurrentUser(session) {
  const email = (session?.user?.email || "").toLowerCase();
  if (!email) return null;
  const res = await pool.query(
    `SELECT id, email
     FROM public.users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [email],
  );
  return res.rows?.[0] || null;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const newPassword = String(body?.newPassword || "");
    const confirmPassword = String(body?.confirmPassword || "");

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and confirmation are required." },
        { status: 400 },
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters." },
        { status: 400 },
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and confirmation do not match." },
        { status: 400 },
      );
    }

    const user = await getCurrentUser(session);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE public.users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      user.id,
    ]);

    return NextResponse.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    console.error("POST /api/profile/password error:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
