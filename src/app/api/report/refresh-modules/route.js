export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { loadFindingSectionsForPreviewServer } from "@/app/lib/report/loadFindingSectionsServer";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Fresh SOP + Audit module rows for HTML preview (bypasses stale client/DB snapshot).
 * GET /api/report/refresh-modules?year=2025
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseYear(searchParams.get("year"));
    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const cookieHeader = req.headers.get("cookie") || "";
    const { sections, lockedByDept } = await loadFindingSectionsForPreviewServer(year, cookieHeader);

    return NextResponse.json(
      {
        success: true,
        year,
        sections,
        lockedByDept,
        loadedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/report/refresh-modules:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
