export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta, docxExists } from "@/app/lib/report/documentStore";
import {
  buildOnlyOfficeEditorConfig,
  buildDocumentFileUrl,
  buildDocumentFileHeaders,
} from "@/app/lib/report/onlyoffice/buildEditorConfig";
import { isOnlyOfficeEnabled, getOnlyOfficePublicUrl } from "@/app/lib/report/onlyoffice/jwt";
import {
  checkOnlyOfficeDocumentServer,
  getOnlyOfficeLocalStartHint,
} from "@/app/lib/report/onlyoffice/health";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!isOnlyOfficeEnabled()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OnlyOffice is not configured. Set ONLYOFFICE_URL, NEXT_PUBLIC_ONLYOFFICE_URL, and ONLYOFFICE_JWT_SECRET.",
        },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const sessionId = searchParams.get("sessionId");
    const mode = searchParams.get("mode") === "view" ? "view" : "edit";

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    const health = await checkOnlyOfficeDocumentServer();
    if (!health.ok) {
      console.warn(
        "[onlyoffice/config] 503:",
        health.publicUrl,
        health.detail,
      );
      return NextResponse.json(
        {
          success: false,
          error: `OnlyOffice Document Server is not reachable at ${health.publicUrl}. ${health.detail || ""}`.trim(),
          documentServerUrl: health.publicUrl,
          setupHint: getOnlyOfficeLocalStartHint(),
        },
        { status: 503 },
      );
    }

    if (!(await docxExists(sessionId))) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    const meta = await readMeta(sessionId);
    const editorConfig = buildOnlyOfficeEditorConfig({
      sessionId,
      meta,
      user: session.user,
      mode,
    });

    const usesJwtToken = Boolean(editorConfig?.token);
    const resolvedUserDebug = editorConfig?.editorConfig?.user || null;
    const documentKeyDebug = editorConfig?.document?.key || null;

    return NextResponse.json(
      {
        success: true,
        documentServerUrl: getOnlyOfficePublicUrl(),
        editorConfig,
        editorUsesJwt: usesJwtToken,
        sessionId,
        meta,
        ...(process.env.NODE_ENV === "development"
          ? {
              debugResolvedUser: resolvedUserDebug,
              debugDocumentKey: documentKeyDebug,
            }
          : {}),
        ...(process.env.NODE_ENV === "development"
          ? {
              documentFileUrl: buildDocumentFileUrl(sessionId),
              documentFileHeaders: buildDocumentFileHeaders(sessionId),
            }
          : {}),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/report/onlyoffice/config error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
