export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { flushOnlyOfficeEditsToDisk } from "@/app/lib/report/onlyoffice/forceSave";
import { syncReportStateFromOnlyOfficeSession } from "@/app/lib/report/syncPreviewFromOnlyOffice";

/**
 * Flush OnlyOffice editor buffer → DOCX on disk (sebelum sync modul).
 * POST /api/report/onlyoffice/forcesave  { sessionId }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId || new URL(req.url || "", "http://localhost").searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    const flush = await flushOnlyOfficeEditsToDisk(sessionId);
    let sync = null;
    if (flush.flushed) {
      try {
        sync = await syncReportStateFromOnlyOfficeSession(sessionId, "forcesave-sync");
      } catch (err) {
        console.warn("[forcesave] sync:", err?.message || err);
      }
    }

    return NextResponse.json({
      success: true,
      flushed: flush.flushed === true,
      mtimeChanged: flush.mtimeChanged === true,
      reason: flush.reason,
      forceSaveError: flush.forceSaveError,
      onlyOfficeSyncRevision: sync?.revision ?? null,
    });
  } catch (err) {
    console.error("POST /api/report/onlyoffice/forcesave:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
