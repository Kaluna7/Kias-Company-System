export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta, docxExists, deleteReportSession } from "@/app/lib/report/documentStore";
import { getReportResetGeneration } from "@/app/lib/report/reportResetGeneration";
import { createReportSession, REPORT_TEMPLATE_VERSION } from "@/app/lib/report/reportService";
import { computeModuleTablesHash } from "@/app/lib/report/moduleTablesHash";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";
import { checkOnlyOfficeDocumentServer } from "@/app/lib/report/onlyoffice/health";
import { buildPayloadFromPapers } from "@/app/lib/report/buildPayloadFromPapers";
import { resetFindingsPaperInHub } from "@/app/lib/report/resetFindingsPaper";
import { regenerateModuleDocxSafe } from "@/app/lib/report/regenerateModuleDocx";
import { broadcastOnlyOfficeSessionOpened } from "@/app/lib/report/previewRealtimeHub";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }
    const meta = await readMeta(sessionId);
    if (!meta) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, sessionId, meta });
  } catch (err) {
    console.error("GET /api/report/session error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const reuseExisting = String(payload.reuseExistingSession ?? "true").toLowerCase() !== "false";
    const resetFindingsOnly = payload.resetFindingsOnly === true;
    const payloadYear = Number(payload.year ?? new Date().getFullYear());
    const sharedSessionId = reuseExisting ? `shared-report-${payloadYear}` : undefined;
    const cookieHeader = req.headers.get("cookie") || "";
    let existingMeta = sharedSessionId ? await readMeta(sharedSessionId) : null;
    const currentResetGen = await getReportResetGeneration(payloadYear);
    if (
      sharedSessionId &&
      existingMeta &&
      Number(existingMeta.resetGeneration || 0) !== currentResetGen
    ) {
      await deleteReportSession(sharedSessionId);
      existingMeta = null;
    }
    /** HTML Preview "Create Word" always rebuilds DOCX from current preview data. */
    const fromHtmlPreview = payload.source === "html-preview";
    const forceRegenerate =
      fromHtmlPreview ||
      String(payload.forceRegenerateSession ?? "false").toLowerCase() === "true";
    const previewHash = String(payload.previewSnapshotHash || "");
    const coverHash = String(payload.coverSnapshotHash || "");
    const previewHashChanged =
      previewHash &&
      String(existingMeta?.previewSnapshotHash || "") !== previewHash;
    const coverHashChanged =
      coverHash &&
      String(existingMeta?.coverSnapshotHash || "") !== coverHash;
    const moduleTablesHash =
      String(payload.moduleTablesHash || "") ||
      computeModuleTablesHash(payload.findingSections || []);
    const moduleTablesHashChanged =
      moduleTablesHash &&
      String(existingMeta?.moduleTablesHash || "") !== moduleTablesHash;
    const templateUpToDate =
      String(existingMeta?.templateVersion || "") === String(REPORT_TEMPLATE_VERSION);
    const hasExistingDocx =
      sharedSessionId && existingMeta && (await docxExists(sharedSessionId));

    if (resetFindingsOnly && sharedSessionId) {
      await resetFindingsPaperInHub(
        payloadYear,
        cookieHeader,
        session.user.email || session.user.name || "create-report",
      );
      const regen = await regenerateModuleDocxSafe(
        payloadYear,
        sharedSessionId,
        {
          id: session.user.id || session.user.email,
          name: session.user.name || session.user.email,
          email: session.user.email,
        },
        { cookieHeader, allowFullRebuild: true },
      );
      if (!regen.ok) {
        return NextResponse.json(
          { success: false, error: regen.error || "Findings reset failed" },
          { status: 500 },
        );
      }
      const meta = await readMeta(sharedSessionId);
      const editorEnabled = isOnlyOfficeEnabled();
      const health = editorEnabled ? await checkOnlyOfficeDocumentServer() : { ok: false };
      return NextResponse.json({
        success: true,
        sessionId: sharedSessionId,
        year: payloadYear,
        editorPath: regen.editorPath,
        resetFindingsOnly: true,
        findingsOnly: true,
        reusedExistingSession: hasExistingDocx,
        editorEnabled,
        onlyOfficeReachable: health.ok,
        onlyOfficeDetail: health.ok ? null : health.detail || null,
        previewSnapshotHash: meta?.previewSnapshotHash ?? null,
      });
    }

    if (
      !fromHtmlPreview &&
      hasExistingDocx &&
      templateUpToDate &&
      !forceRegenerate &&
      !previewHashChanged &&
      !coverHashChanged &&
      !moduleTablesHashChanged
    ) {
      return NextResponse.json({
        success: true,
        sessionId: sharedSessionId,
        year: payloadYear,
        docxEngine: existingMeta.docxEngine || null,
        editorEnabled: isOnlyOfficeEnabled(),
        onlyOfficeReachable: true,
        onlyOfficeDetail: null,
        editorPath: `/Page/report/editor?session=${encodeURIComponent(sharedSessionId)}`,
        reusedExistingSession: true,
        collaborationSession: true,
        createdBy: existingMeta?.createdBy ?? null,
        previewSnapshotHash: existingMeta?.previewSnapshotHash ?? null,
      });
    }

    const user = session.user;
    const wantsRegenerate =
      forceRegenerate || previewHashChanged || coverHashChanged || moduleTablesHashChanged;
    const regenerateDocx = fromHtmlPreview || wantsRegenerate;

    let publishPayload = payload;
    if (regenerateDocx) {
      if (payload.source === "html-preview") {
        // Keep HTML preview pages (conclusion, appendix, selected findings) — do not
        // replace with DB payload that injects report_findings narratives into section 5.
        publishPayload = {
          ...payload,
          deptFindingNarratives: [],
          userFindingsFreeHtml: "",
          wordFindingsHtml: "",
        };
      } else {
        const fromDb = await buildPayloadFromPapers(payloadYear);
        if (fromDb) publishPayload = fromDb;
      }
    }

    const result = await createReportSession(
      publishPayload,
      {
        id: user.id || user.email,
        name: user.name || user.email,
        email: user.email,
      },
      {
        sessionId: sharedSessionId,
        regenerateDocx,
        bumpVersion: false,
      },
    );

    if (fromHtmlPreview && result.editorPath) {
      try {
        broadcastOnlyOfficeSessionOpened(result.year ?? payloadYear, {
          sessionId: result.sessionId,
          editorPath: result.editorPath,
          initiatorClientId: payload.initiatorClientId || null,
          openedBy: {
            id: user.id || user.email,
            name: user.name || user.email,
            email: user.email,
          },
        });
      } catch {
        /* ignore broadcast errors */
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      year: result.year,
      docxEngine: result.docxEngine,
      editorEnabled: result.editorEnabled ?? isOnlyOfficeEnabled(),
      onlyOfficeReachable: result.onlyOfficeReachable,
      onlyOfficeDetail: result.onlyOfficeDetail,
      editorPath: result.editorPath,
      reusedExistingSession: false,
      createdNewDocument: true,
      rebuiltFromPreview: fromHtmlPreview,
      collaborationSession: true,
      createdBy: (await readMeta(result.sessionId))?.createdBy ?? null,
    });
  } catch (err) {
    console.error("POST /api/report/session error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
