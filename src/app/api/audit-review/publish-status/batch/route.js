export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";
import {
  DEPT_KEY_TO_API_PATH,
  REPORT_DEPT_KEYS,
} from "@/app/lib/audit-review/auditDeptKeys";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseInt(String(searchParams.get("year") || ""), 10);
    const reportYear = Number.isFinite(year) ? year : new Date().getFullYear();

    const byDept = {};
    await Promise.all(
      REPORT_DEPT_KEYS.map(async (deptKey) => {
        const apiPath = DEPT_KEY_TO_API_PATH[deptKey];
        const state = await getAuditReviewPublishStateForReport(apiPath, reportYear);
        byDept[deptKey] = {
          isLocked: state.isPublished === true,
          isPublished: state.isPublished === true,
          auditYear: state.auditYear ?? reportYear,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      year: reportYear,
      byDept,
      serverTime: Date.now(),
    });
  } catch (err) {
    console.error("GET /api/audit-review/publish-status/batch:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
