import { NextResponse } from "next/server";
import { readDocx, docxExists } from "@/app/lib/report/documentStore";
import { verifyDocumentAccessToken } from "./accessToken";

const DOC_TOKEN_HEADER = "x-kias-document-token";

/** 7 days — OnlyOffice may retry / reopen the same config. */
export const DOCUMENT_ACCESS_TTL_SECONDS = 86400 * 7;

export function extractDocumentAccessToken(req, searchParams) {
  return (
    searchParams?.get("token") ||
    req.headers.get(DOC_TOKEN_HEADER) ||
    req.headers.get("X-Kias-Document-Token") ||
    null
  );
}

export async function serveReportDocument(sessionId, token, req) {
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const insecureDev =
    process.env.NODE_ENV === "development" &&
    String(process.env.ONLYOFFICE_INSECURE_DOC_ACCESS ?? "true").toLowerCase() === "true";

  if (!verifyDocumentAccessToken(sessionId, token)) {
    if (!(insecureDev && (await docxExists(sessionId)))) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[report/doc/file] 403 invalid token", {
          sessionId,
          hasToken: Boolean(token),
          tokenPreview: token ? String(token).slice(0, 12) : null,
          userAgent: req.headers.get("user-agent")?.slice(0, 100),
        });
      }
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[report/doc/file] dev insecure access (no valid token)", sessionId);
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[report/doc/file] serve docx",
      sessionId,
      req.headers.get("user-agent")?.slice(0, 80),
    );
  }

  if (!(await docxExists(sessionId))) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const buffer = await readDocx(sessionId);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="report-${sessionId}.docx"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export { DOC_TOKEN_HEADER };
