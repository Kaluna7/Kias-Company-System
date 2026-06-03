export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";

export async function GET(req, { params }) {
  try {
    const p = await params;
    const dept = p?.dept;
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : null;
    const reportYear = Number.isInteger(year) ? year : null;

    const state = await getAuditReviewPublishStateForReport(dept, reportYear);

    return NextResponse.json({
      success: true,
      isPublished: state.isPublished,
      isLocked: state.isPublished,
      auditYear: state.auditYear,
      row: state.row,
    });
  } catch (err) {
    console.error("GET /api/audit-review/[dept]/publish-status:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
