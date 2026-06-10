export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  upsertLivePresence,
  removeLivePresence,
  listLivePresence,
  clearOnlyOfficeLiveSessionIfNoEditors,
} from "@/app/lib/report/collabPresenceStore";
import { clearOnlyOfficeSessionForYear } from "@/app/lib/report/previewRealtimeHub";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * POST /api/report/collaboration/heartbeat
 * Body: { year, tabId, location?, user?, sessionId?, editorPath?, leave?: boolean }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year);
    const tabId = String(body.tabId || "").trim();
    if (!year || !tabId) {
      return NextResponse.json(
        { success: false, error: "Missing year or tabId" },
        { status: 400 },
      );
    }

    if (body.leave === true) {
      await removeLivePresence(year, tabId);
      await clearOnlyOfficeLiveSessionIfNoEditors(year);
      clearOnlyOfficeSessionForYear(year);
    } else {
      const user = body.user && typeof body.user === "object" ? body.user : session.user;
      await upsertLivePresence({
        year,
        tabId,
        location: body.location || "preview",
        sessionId: body.sessionId || null,
        editorPath: body.editorPath || null,
        user: {
          id: user.id || user.email,
          email: user.email || "",
          name: user.name || user.email || "User",
          image: user.image || "",
        },
      });
    }

    const participants = await listLivePresence(year);
    return NextResponse.json({
      success: true,
      year,
      participants,
      participantCount: participants.length,
    });
  } catch (err) {
    console.error("POST /api/report/collaboration/heartbeat:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
