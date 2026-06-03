export const runtime = "nodejs";

import {
  extractDocumentAccessToken,
  serveReportDocument,
} from "@/app/lib/report/onlyoffice/serveDocument";

/**
 * Document URL for OnlyOffice Document Server.
 * Auth: ?token=... and/or header X-Kias-Document-Token (OnlyOffice document.headers).
 */
export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const sessionId = p?.sessionId;
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const token = extractDocumentAccessToken(req, searchParams);
    return serveReportDocument(sessionId, token, req);
  } catch (err) {
    console.error("GET /api/report/documents/[sessionId]/file error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

/** OnlyOffice may preflight from another origin (8082). */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "X-Kias-Document-Token, Content-Type",
    },
  });
}
