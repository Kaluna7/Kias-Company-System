export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta, docxExists } from "@/app/lib/report/documentStore";
import { getSharedReportSessionId } from "@/app/lib/report/reportProgressStorage";
import { getOnlyOfficeNarrativeRevision } from "@/app/lib/report/onlyOfficeDocxGuard";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";

/**
 * Join the shared OnlyOffice session for a year (creator opens first; others reuse same DOCX).
 * GET /api/report/session/active?year=2025
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

    const sessionId = getSharedReportSessionId(year);
    const hasDocx = await docxExists(sessionId);
    if (!hasDocx) {
      return NextResponse.json({
        success: false,
        error: "NO_ACTIVE_SESSION",
        message:
          "Belum ada dokumen laporan untuk tahun ini. User pertama harus membuat report dari preview terlebih dahulu.",
        year,
      });
    }

    const meta = await readMeta(sessionId);
    const dbOnlyOfficeRev = await getOnlyOfficeNarrativeRevision(year);
    const onlyOfficeSyncRevision = Math.max(
      dbOnlyOfficeRev,
      Number(meta?.onlyOfficeSyncRevision) || 0,
    );
    return NextResponse.json({
      success: true,
      sessionId,
      year,
      editorPath: `/Page/report/editor?session=${encodeURIComponent(sessionId)}`,
      collaborationSession: true,
      editorEnabled: isOnlyOfficeEnabled(),
      onlyOfficeSyncRevision,
      meta: {
        createdBy: meta?.createdBy ?? null,
        createdAt: meta?.createdAt ?? null,
        updatedAt: meta?.updatedAt ?? null,
        previewSnapshotHash: meta?.previewSnapshotHash ?? null,
        moduleTablesHash: meta?.moduleTablesHash ?? null,
        onlyOfficeSyncRevision,
      },
    });
  } catch (err) {
    console.error("GET /api/report/session/active:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
