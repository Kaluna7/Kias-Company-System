export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildDocxPayloadFromHtmlPreview } from "@/app/lib/report/buildFullDocxPayloadFromDb";
import { createReportSession } from "@/app/lib/report/reportService";
import { sharedReportSessionId } from "@/app/lib/report/onlyOfficeDocxGuard";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";
import { broadcastReportStateChange } from "@/app/lib/report/reportStateHub";
import { getHubRevision } from "@/app/lib/report/reportPreviewHub";
import { readReportState } from "@/app/lib/report/reportStateStore";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Full DOCX regenerate dari DB — tanpa patch/merge Word.
 * POST /api/report/refresh-docx  { year: 2026 }
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

    const payload = await buildDocxPayloadFromHtmlPreview(year);
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No saved HTML preview snapshot. Regenerate from HTML Preview (Create Word).",
        },
        { status: 400 },
      );
    }

    const sessionId = sharedReportSessionId(year);
    const user = session.user;
    const result = await createReportSession(
      {
        ...payload,
        source: "html-preview",
        deptFindingNarratives: [],
        userFindingsFreeHtml: "",
        wordFindingsHtml: "",
      },
      {
        id: user.id || user.email,
        name: user.name || user.email,
        email: user.email,
      },
      {
        sessionId,
        regenerateDocx: true,
        bumpVersion: false,
      },
    );

    const state = (await readReportState(year)) || {};
    broadcastReportStateChange({
      year,
      revision: Number(state.onlyOfficeSyncRevision) || 0,
      hubRevision: getHubRevision(state),
      moduleTablesRevision: state.moduleTablesRevision,
      source: "refresh-docx",
    });

    return NextResponse.json({
      success: true,
      year,
      sessionId: result.sessionId,
      editorPath: result.editorPath,
      patchMode: "full-regenerate-from-html-preview",
      narrativeSource: "html-preview",
      rebuiltFromPreview: true,
      onlyOfficeEnabled: isOnlyOfficeEnabled(),
    });
  } catch (err) {
    console.error("POST /api/report/refresh-docx:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
