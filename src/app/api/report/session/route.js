export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta, docxExists } from "@/app/lib/report/documentStore";
import { createReportSession, REPORT_TEMPLATE_VERSION } from "@/app/lib/report/reportService";
import { computeModuleTablesHash } from "@/app/lib/report/moduleTablesHash";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";
import { buildModuleSyncRegeneratePayload } from "@/app/lib/report/onlyOfficeDocxGuard";

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
    const payloadYear = Number(payload.year ?? new Date().getFullYear());
    const sharedSessionId = reuseExisting ? `shared-report-${payloadYear}` : undefined;
    const existingMeta = sharedSessionId ? await readMeta(sharedSessionId) : null;
    const forceRegenerate = String(payload.forceRegenerateSession ?? "false").toLowerCase() === "true";
    const previewHash = String(payload.previewSnapshotHash || "");
    const previewHashChanged =
      previewHash &&
      String(existingMeta?.previewSnapshotHash || "") !== previewHash;
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

    if (
      hasExistingDocx &&
      templateUpToDate &&
      !forceRegenerate &&
      !previewHashChanged &&
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
      forceRegenerate || previewHashChanged || moduleTablesHashChanged;
    const regenerateDocx = wantsRegenerate;

    let publishPayload = payload;
    if (regenerateDocx) {
      const fromDb = await buildModuleSyncRegeneratePayload(payloadYear);
      if (fromDb) publishPayload = fromDb;
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
      },
    );

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
