export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { broadcastAuditPublishChange } from "@/app/lib/audit-review/auditPublishHub";
import { reportDeptKeyFromRouteOrApi } from "@/app/lib/audit-review/auditDeptKeys";
import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";
import { DEPT_KEY_TO_API_PATH } from "@/app/lib/audit-review/auditDeptKeys";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year =
      Number(body.reportYear) ||
      Number(body.year) ||
      Number(body.auditYear) ||
      new Date().getFullYear();
    const deptKey = reportDeptKeyFromRouteOrApi(body.deptKey, body.apiPath);
    const apiPath = body.apiPath || DEPT_KEY_TO_API_PATH[deptKey] || deptKey;

    let isLocked = body.isLocked === true;
    if (body.isLocked === undefined || body.isLocked === null) {
      const state = await getAuditReviewPublishStateForReport(apiPath, year);
      isLocked = state.isPublished === true;
    }

    const payload = {
      year,
      deptKey,
      apiPath,
      isLocked,
    };

    broadcastAuditPublishChange(payload);

    return NextResponse.json({ success: true, ...payload });
  } catch (err) {
    console.error("POST /api/audit-review/publish-notify:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
