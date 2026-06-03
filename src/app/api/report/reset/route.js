export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteReportSession } from "@/app/lib/report/documentStore";
import { deleteReportState } from "@/app/lib/report/reportStateStore";
import { getSharedReportSessionId } from "@/app/lib/report/reportProgressStorage";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year);
    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const sessionId = getSharedReportSessionId(year);
    const removed = await deleteReportSession(sessionId);
    await deleteReportState(year);

    return NextResponse.json({
      success: true,
      year,
      sessionId,
      serverSessionCleared: removed,
      reportStateCleared: true,
      message:
        "Report progress reset. Draft text in this browser will clear after you confirm reset on the page.",
    });
  } catch (err) {
    console.error("POST /api/report/reset:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
