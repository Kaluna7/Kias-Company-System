import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

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

