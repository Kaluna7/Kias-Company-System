import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isSuperAdmin } from "@/lib/roles";

function toIntSafe(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

// Evidence report built langsung dari tabel `evidence`:
// hanya record yang punya file + overall_status = COMPLETE,
// dengan filter tahun berdasarkan updated_at (tahun publish).
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const deptParam = url.searchParams.get("department"); // optional single department

    const year = yearParam ? parseInt(yearParam, 10) : null;
    const hasValidYear = !Number.isNaN(year) && !!year;

    const where = {
      file_url: { not: null },
      overall_status: {
        equals: "COMPLETE",
        mode: "insensitive",
      },
    };

    if (deptParam) {
      where.department = String(deptParam).toUpperCase();
    }

    if (hasValidYear) {
      const from = new Date(year, 0, 1);
      const to = new Date(year + 1, 0, 1);
      where.updated_at = { gte: from, lt: to };
    }

    const page = Math.max(1, toIntSafe(url.searchParams.get("page"), 1));
    const pageSize = Math.max(1, Math.min(500, toIntSafe(url.searchParams.get("pageSize"), 100)));
    const skip = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        orderBy: { updated_at: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.evidence.count({ where }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: rows,
        meta: { total, page, pageSize },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/evidence/report error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** Super admin only — update one evidence row from the report UI. */
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdmin(session?.user?.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: super admin only" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid evidence id is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.evidence.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Evidence not found" }, { status: 404 });
    }

    const data = {};
    if (body.ap_code !== undefined) {
      data.ap_code = String(body.ap_code || "").trim() || null;
    }
    if (body.substantive_test !== undefined) {
      data.substantive_test = String(body.substantive_test || "").trim() || null;
    }
    if (body.preparer !== undefined) {
      data.preparer = String(body.preparer || "").trim() || null;
    }
    if (body.overall_status !== undefined) {
      const status = String(body.overall_status || "").toUpperCase().trim();
      const allowed = new Set(["COMPLETE", "INCOMPLETE", "IN PROGRESS"]);
      if (!allowed.has(status)) {
        return NextResponse.json(
          { success: false, error: "Invalid overall_status" },
          { status: 400 },
        );
      }
      data.overall_status = status;
    }
    if (body.status !== undefined) {
      data.status = String(body.status || "").trim() || existing.status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    data.updated_at = new Date();

    const updated = await prisma.evidence.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/evidence/report error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** Super admin only — delete one evidence row (and best-effort remove files). */
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdmin(session?.user?.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: super admin only" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid evidence id is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.evidence.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Evidence not found" }, { status: 404 });
    }

    // Best-effort cleanup of stored files
    try {
      const { objectKeyFromFileUrl, deleteMinioObject } = await import("@/app/lib/minio");
      const { unlink } = await import("fs/promises");
      const { join } = await import("path");
      const { existsSync } = await import("fs");
      let attachments = [];
      try {
        const parsed = JSON.parse(existing.file_url || "[]");
        if (Array.isArray(parsed)) attachments = parsed;
      } catch {
        if (existing.file_url) attachments = [{ url: existing.file_url }];
      }
      for (const att of attachments) {
        const url = String(att?.url || "");
        if (!url) continue;
        const key = objectKeyFromFileUrl(url);
        if (key) {
          await deleteMinioObject(key).catch(() => {});
        } else if (url.startsWith("/uploads/")) {
          const full = join(process.cwd(), "public", url.replace(/^\//, ""));
          if (existsSync(full)) await unlink(full).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Evidence file cleanup failed:", e);
    }

    await prisma.evidence.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/evidence/report error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
