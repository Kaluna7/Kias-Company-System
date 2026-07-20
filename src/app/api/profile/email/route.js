export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/app/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getCurrentUser(session) {
  const email = (session?.user?.email || "").toLowerCase();
  if (!email) return null;
  const res = await pool.query(
    `SELECT id, email, password_hash
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
    const newEmail = String(body?.newEmail || "").toLowerCase().trim();
    const password = String(body?.password || "");

    if (!newEmail || !password) {
      return NextResponse.json(
        { success: false, error: "New email and password are required." },
        { status: 400 },
      );
    }
    if (!EMAIL_RE.test(newEmail)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const user = await getCurrentUser(session);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (newEmail === String(user.email || "").toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "New email must be different from your current email." },
        { status: 400 },
      );
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, user.password_hash || "");
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Incorrect password." },
        { status: 401 },
      );
    }

    const exists = await pool.query(
      `SELECT id FROM public.users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1`,
      [newEmail, user.id],
    );
    if (exists.rows?.length) {
      return NextResponse.json(
        { success: false, error: "Email already in use." },
        { status: 409 },
      );
    }

    await pool.query(`UPDATE public.users SET email = $1 WHERE id = $2`, [newEmail, user.id]);

    return NextResponse.json({
      success: true,
      message: "Email has been changed.",
      email: newEmail,
    });
  } catch (err) {
    console.error("POST /api/profile/email error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
