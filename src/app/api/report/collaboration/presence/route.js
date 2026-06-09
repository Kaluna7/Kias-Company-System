export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { docxExists, readMeta } from "@/app/lib/report/documentStore";
import { getSharedReportSessionId } from "@/app/lib/report/reportProgressStorage";
import {
  getPresenceForYear,
  hasOnlyOfficeParticipants,
  isOnlyOfficeActiveForOpenReport,
  isOnlyOfficeSessionRecentlyOpened,
  getOnlyOfficeSessionForYear,
} from "@/app/lib/report/previewRealtimeHub";

/**
 * Live collaboration presence — who is in HTML preview vs OnlyOffice right now.
 * GET /api/report/collaboration/presence?year=2025
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseInt(String(searchParams.get("year") || ""), 10);
    if (!Number.isFinite(year)) {
      return NextResponse.json({ success: false, error: "Invalid year" }, { status: 400 });
    }

    const participants = getPresenceForYear(year);
    const onlyOfficeParticipants = participants.filter((p) => p.location === "onlyoffice");
    const onlyOfficeLive = isOnlyOfficeActiveForOpenReport(year);
    const onlyOfficeOpen = onlyOfficeLive;
    const markedSession = getOnlyOfficeSessionForYear(year);

    const sessionId = getSharedReportSessionId(year);
    const hasDocx = await docxExists(sessionId);
    const meta = hasDocx ? await readMeta(sessionId) : null;
    const editorPath =
      markedSession?.editorPath ||
      (hasDocx
        ? `/Page/report/editor?session=${encodeURIComponent(sessionId)}`
        : null);

    return NextResponse.json({
      success: true,
      year,
      participants,
      onlyOfficeOpen,
      onlyOfficeParticipantCount: onlyOfficeParticipants.length,
      onlyOfficeLive,
      onlyOfficeSessionRecent: isOnlyOfficeSessionRecentlyOpened(year),
      previewOpen: participants.some((p) => p.location === "preview"),
      hasDocxSession: hasDocx,
      editorPath,
      createdBy: meta?.createdBy ?? null,
    });
  } catch (err) {
    console.error("GET /api/report/collaboration/presence:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
