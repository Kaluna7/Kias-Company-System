export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSharedReportSessionId } from "@/app/lib/report/reportProgressStorage";
import { broadcastOnlyOfficeSessionOpened } from "@/app/lib/report/previewRealtimeHub";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Mark OnlyOffice as open and notify all HTML preview tabs to join.
 * POST /api/report/collaboration/onlyoffice-opened
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year);
    if (!year) {
      return NextResponse.json({ success: false, error: "Invalid year" }, { status: 400 });
    }

    const sessionId = body.sessionId
      ? String(body.sessionId)
      : getSharedReportSessionId(year);
    const editorPath =
      body.editorPath ||
      `/Page/report/editor?session=${encodeURIComponent(sessionId)}`;

    broadcastOnlyOfficeSessionOpened(year, {
      sessionId,
      editorPath,
      initiatorClientId: body.initiatorClientId || null,
      openedBy: {
        id: session.user.id || session.user.email,
        name: session.user.name || session.user.email,
        email: session.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      year,
      sessionId,
      editorPath,
    });
  } catch (err) {
    console.error("POST /api/report/collaboration/onlyoffice-opened:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
