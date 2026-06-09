export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta } from "@/app/lib/report/documentStore";
import { createReportSession } from "@/app/lib/report/reportService";
import { sharedReportSessionId } from "@/app/lib/report/onlyOfficeDocxGuard";
import { buildDocxPayloadFromHtmlPreview } from "@/app/lib/report/buildFullDocxPayloadFromDb";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Rebuild shared DOCX from HTML Preview snapshot (+ optional live overlay from client).
 * POST { year, overlay?: object }
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

    const overlay =
      body.overlay && typeof body.overlay === "object" ? body.overlay : {};
    const payload = await buildDocxPayloadFromHtmlPreview(year, overlay);
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No HTML preview export for this year. Open HTML Preview and click Create Word & Open OnlyOffice.",
        },
        { status: 400 },
      );
    }

    const sessionId = sharedReportSessionId(year);
    const existingMeta = (await readMeta(sessionId)) || {};
    const user = session.user;

    const result = await createReportSession(
      {
        ...payload,
        source: "html-preview",
        deptFindingNarratives: [],
        userFindingsFreeHtml: "",
        wordFindingsHtml: "",
        /** Audit grid already paginated in findingPages — avoid duplicate detail pages. */
        findingDetailPages: [],
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
        bumpPreviewDocxRevision: true,
      },
    );

    const meta = (await readMeta(sessionId)) || {};

    return NextResponse.json({
      success: true,
      year,
      sessionId: result.sessionId,
      editorPath: result.editorPath,
      editorEnabled: result.editorEnabled ?? isOnlyOfficeEnabled(),
      onlyOfficeReachable: result.onlyOfficeReachable,
      onlyOfficeDetail: result.onlyOfficeDetail,
      previewSnapshotHash: meta.previewSnapshotHash ?? null,
      previousPreviewSnapshotHash: existingMeta.previewSnapshotHash ?? null,
      version: meta.version ?? null,
      previewDocxRevision: meta.previewDocxRevision ?? null,
      conclusionPageCount: payload.conclusionPages?.length ?? 0,
      appendixPageCount: payload.appendixPages?.length ?? 0,
      rebuiltFromPreview: true,
    });
  } catch (err) {
    console.error("POST /api/report/session/sync-from-preview:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
