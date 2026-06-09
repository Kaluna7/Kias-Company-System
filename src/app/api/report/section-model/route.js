export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readReportState } from "@/app/lib/report/reportStateStore";
import { buildReportSectionModel } from "@/app/lib/report/reportSectionModel";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Model section sebelum DOCX — USER vs SYSTEM (debug lock/unlock).
 * GET /api/report/section-model?year=2026
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

    const state = (await readReportState(year)) || {};
    const model = buildReportSectionModel(state);

    return NextResponse.json(
      { success: true, year, model, state: { auditVisibleByDept: state.auditVisibleByDept } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("GET /api/report/section-model:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
