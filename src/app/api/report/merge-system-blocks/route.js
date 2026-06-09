export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sharedReportSessionId } from "@/app/lib/report/onlyOfficeDocxGuard";
import { ensureLatestDocxOnDisk } from "@/app/lib/report/ensureLatestDocxOnDisk";
import { refreshHubModulesForRegen } from "@/app/lib/report/refreshHubModulesForRegen";
import { docxExists, readDocx } from "@/app/lib/report/documentStore";
import {
  runReportMergeJob,
  MERGE_JOB_SOURCE,
} from "@/app/lib/report/reportMergeWorker";
import { finalizeFindingsBlockSync } from "@/app/lib/report/regenerateFindingsPaper";
import { docxNeedsLegacyVisibilityPatch } from "@/app/lib/report/patchLegacyDeptVisibilityDocx";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * POST /api/report/merge-system-blocks
 * Body: { year: 2026, source?: "module-tables" | "manual" }
 *
 * Merge worker: baca DOCX OnlyOffice terakhir → patch SYSTEM blocks → bump key.
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
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const sessionId = sharedReportSessionId(year);
    if (!(await docxExists(sessionId))) {
      return NextResponse.json(
        { success: false, error: "No DOCX for this year. Create Report first." },
        { status: 404 },
      );
    }

    const cookieHeader = req.headers.get("cookie") || "";
    const userLabel = session.user?.email || session.user?.name || "merge-worker";

    const filePrep = await ensureLatestDocxOnDisk(sessionId, { syncBy: "merge-worker" });
    const refreshed = await refreshHubModulesForRegen(year, cookieHeader, userLabel);
    if (!refreshed.ok) {
      return NextResponse.json(
        { success: false, error: refreshed.error || "Could not refresh hub modules" },
        { status: 500 },
      );
    }

    const saved = refreshed.saved;
    let blockSync = refreshed.blockSync;
    const docxBuffer = await readDocx(sessionId);

    if (docxNeedsLegacyVisibilityPatch(docxBuffer)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        patched: false,
        patchMode: "hub-only",
        wordUnchanged: true,
        reason:
          "DOCX legacy tanpa marker KIASBLOCK. Jalankan Create Report sekali; setelah itu merge worker akan patch SYSTEM saja.",
        sessionId,
        year,
      });
    }

    blockSync = finalizeFindingsBlockSync(docxBuffer, blockSync);
    const mergeSource =
      body.source === MERGE_JOB_SOURCE.VISIBILITY
        ? MERGE_JOB_SOURCE.VISIBILITY
        : MERGE_JOB_SOURCE.MODULE_TABLES;

    const result = await runReportMergeJob({
      year,
      sessionId,
      blockSync,
      saved,
      source: mergeSource,
      docxBuffer,
      skipUnsafeWithoutMarkers: mergeSource === MERGE_JOB_SOURCE.MODULE_TABLES,
      fileBefore: filePrep?.ready,
    });

    return NextResponse.json({
      success: result.ok !== false,
      sessionId,
      year,
      editorRefresh: result.patched === true,
      saveCount: result.saveCount,
      ...result,
    });
  } catch (err) {
    console.error("POST /api/report/merge-system-blocks:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
