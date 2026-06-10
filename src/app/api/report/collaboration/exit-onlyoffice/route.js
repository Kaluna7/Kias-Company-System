export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  upsertLivePresence,
  clearOnlyOfficeLiveSessionIfNoEditors,
} from "@/app/lib/report/collabPresenceStore";
import { clearOnlyOfficeSessionForYear } from "@/app/lib/report/previewRealtimeHub";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * User left OnlyOffice editor — update presence and clear invite signal if room is empty.
 * POST { year, tabId, location?: "report"|"preview" }
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

    const loc = body.location === "preview" ? "preview" : "report";
    await upsertLivePresence({
      year,
      tabId,
      location: loc,
      user: session.user,
      sessionId: null,
      editorPath: null,
    });
    await clearOnlyOfficeLiveSessionIfNoEditors(year);
    clearOnlyOfficeSessionForYear(year);

    return NextResponse.json({ success: true, year });
  } catch (err) {
    console.error("POST /api/report/collaboration/exit-onlyoffice:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
