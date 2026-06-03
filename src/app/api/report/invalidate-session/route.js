export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteReportSession } from "@/app/lib/report/documentStore";
import { getSharedReportSessionId } from "@/app/lib/report/reportProgressStorage";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/** Drop cached DOCX so next Create report reflects Unlock/Lock. */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year) ?? new Date().getFullYear();
    const sessionId = getSharedReportSessionId(year);
    const removed = await deleteReportSession(sessionId);

    return NextResponse.json({
      success: true,
      year,
      sessionId,
      removed,
    });
  } catch (err) {
    console.error("POST /api/report/invalidate-session:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
