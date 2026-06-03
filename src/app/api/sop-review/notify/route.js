export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { broadcastSopReviewDataChange } from "@/app/lib/sop-review/sopReviewDataHub";
import { reportDeptKeyFromRouteOrApi } from "@/app/lib/audit-review/auditDeptKeys";

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
      new Date().getFullYear();
    const deptKey = reportDeptKeyFromRouteOrApi(body.deptKey, body.apiPath);

    const payload = {
      year,
      deptKey,
      apiPath: body.apiPath || null,
      action: body.action || "update",
    };

    broadcastSopReviewDataChange(payload);

    return NextResponse.json({ success: true, ...payload });
  } catch (err) {
    console.error("POST /api/sop-review/notify:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
