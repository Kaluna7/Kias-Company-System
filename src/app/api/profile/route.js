export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import pool from "@/app/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

async function ensureAvatarColumn() {
  // Tambah kolom avatar_url jika belum ada (idempoten)
  await pool.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url'
       ) THEN
         ALTER TABLE public.users ADD COLUMN avatar_url VARCHAR(500);
       END IF;
     END$$;`
  );
}

async function getCurrentUser(session) {
  const email = (session?.user?.email || "").toLowerCase();
  if (!email) return null;
  const res = await pool.query(
    `SELECT id, name, email, role, COALESCE(avatar_url, '') AS avatar_url
     FROM public.users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [email]
  );
  return res.rows?.[0] || null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureAvatarColumn();
    const user = await getCurrentUser(session);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url || "",
      },
    });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureAvatarColumn();

    const user = await getCurrentUser(session);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const nameRaw = formData.get("name");
    const avatarFile = formData.get("avatar");

    const nextName = String(nameRaw || "").trim() || user.name || "";

    let avatarUrl = user.avatar_url || "";

    if (avatarFile && typeof avatarFile === "object" && "arrayBuffer" in avatarFile) {
      const uploadsDir = join(process.cwd(), "public", "uploads", "profile");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const ext = String(avatarFile.name || "avatar.jpg").split(".").pop() || "jpg";
      const safeEmail = String(user.email || "user").replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${safeEmail}_${Date.now()}.${ext}`;
      const filePath = join(uploadsDir, fileName);

      const buf = Buffer.from(await avatarFile.arrayBuffer());
      await writeFile(filePath, buf);

      avatarUrl = `/uploads/profile/${fileName}`;
    }

    await pool.query(
      `UPDATE public.users
       SET name = $1, avatar_url = $2
       WHERE id = $3`,
      [nextName, avatarUrl || null, user.id]
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: nextName,
        email: user.email,
        role: user.role,
        avatarUrl,
      },
    });
  } catch (err) {
    console.error("POST /api/profile error:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

