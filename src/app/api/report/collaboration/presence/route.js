export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { docxExists, readMeta } from "@/app/lib/report/documentStore";
import { getSharedReportSessionId } from "@/app/lib/report/reportProgressStorage";
import {
  listLivePresence,
  getOnlyOfficeLiveSession,
} from "@/app/lib/report/collabPresenceStore";

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

    const participants = await listLivePresence(year);
    const onlyOfficeParticipants = participants.filter((p) => p.location === "onlyoffice");
    const liveSession = await getOnlyOfficeLiveSession(year);
    const sessionId = getSharedReportSessionId(year);
    const hasDocx = await docxExists(sessionId);
    const meta = hasDocx ? await readMeta(sessionId) : null;

    const editorPathFromPresence = onlyOfficeParticipants.find((p) => p.editorPath)?.editorPath;
    const editorPath =
      editorPathFromPresence ||
      liveSession?.editor_path ||
      (hasDocx
        ? `/Page/report/editor?session=${encodeURIComponent(sessionId)}`
        : null);

    const onlyOfficeLive = onlyOfficeParticipants.length > 0;
    /** Only true when someone is actively in the editor — not a stale DB invite. */
    const onlyOfficeOpen = onlyOfficeLive;

    const myUserKey = String(session.user.email || session.user.id || "")
      .trim()
      .toLowerCase();
    const onlyOfficeTeammateParticipants = onlyOfficeParticipants.filter((p) => {
      const peerKey = String(p.email || p.userId || "").trim().toLowerCase();
      return peerKey && peerKey !== myUserKey;
    });
    const onlyOfficeTeammateLive = onlyOfficeTeammateParticipants.length > 0;

    return NextResponse.json({
      success: true,
      year,
      participants,
      onlyOfficeOpen,
      onlyOfficeParticipantCount: onlyOfficeParticipants.length,
      onlyOfficeLive,
      onlyOfficeTeammateLive,
      onlyOfficeTeammateCount: onlyOfficeTeammateParticipants.length,
      onlyOfficeSessionRecent: Boolean(liveSession?.editor_path),
      previewOpen: participants.some(
        (p) => p.location === "preview" || p.location === "report",
      ),
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
