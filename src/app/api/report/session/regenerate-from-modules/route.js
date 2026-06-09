export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";
import { sharedReportSessionId } from "@/app/lib/report/onlyOfficeDocxGuard";
import { regenerateModuleDocxSafe } from "@/app/lib/report/regenerateModuleDocx";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Rebuild shared DOCX from DB report state (module tables + OnlyOffice narrative).
 * POST /api/report/session/regenerate-from-modules  { year: 2025 }
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

    const sessionId = sharedReportSessionId(year);
    const cookieHeader = req.headers.get("cookie") || "";
    const result = await regenerateModuleDocxSafe(
      year,
      sessionId,
      {
        id: session.user.id || session.user.email,
        name: session.user.name || session.user.email,
        email: session.user.email,
      },
      { cookieHeader },
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || "Regenerate failed" },
        { status: result.error?.includes("No report data") ? 400 : 500 },
      );
    }

    return NextResponse.json({
      success: result.ok !== false,
      sessionId: result.sessionId,
      year: result.year,
      editorPath: result.editorPath,
      error: result.error || null,
      moduleTablesHash: result.moduleTablesHash,
      previewSnapshotHash: result.previewSnapshotHash,
      regenerated: result.regenerated === true,
      patched: result.patched === true,
      noop: result.noop === true,
      selectiveDelete: result.selectiveDelete === true,
      selectiveInsert: result.selectiveInsert === true,
      preservedUserEdits: result.preservedUserEdits === true,
      contentPreservationFailed: result.contentPreservationFailed === true,
      patchMode: result.patchMode || null,
      sourceFile: result.sourceFile || result.filePrep?.ready?.sourceFile || null,
      targetFile: result.targetFile || result.sourceFile || null,
      md5Before: result.md5Before || result.filePrep?.ready?.md5 || null,
      md5After: result.md5After || null,
      saveCount: result.saveCount ?? result.filePrep?.ready?.saveCount ?? null,
      toInsert: result.toInsert || result.insertedBlocks || [],
      toDelete: result.toDelete || result.deletedBlocks || [],
      missingInDocx: result.missingInDocx || [],
      deletedBlocks: result.deletedBlocks,
      insertedBlocks: result.insertedBlocks,
      editorEnabled: isOnlyOfficeEnabled(),
    });
  } catch (err) {
    console.error("POST regenerate-from-modules:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
