export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { saveDocx, recordDocumentSave } from "@/app/lib/report/documentStore";
import { parseOnlyOfficeCallbackBody } from "@/app/lib/report/onlyoffice/jwt";
import { syncReportStateFromOnlyOfficeSession } from "@/app/lib/report/syncPreviewFromOnlyOffice";

/**
 * OnlyOffice Document Server save callback.
 * Keeps document.key stable (no version bump) so co-editing sessions stay in sync.
 * @see https://api.onlyoffice.com/editors/callback
 */
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: 1, message: "Missing sessionId" });
    }

    const body = await parseOnlyOfficeCallbackBody(req);
    const status = Number(body.status);

    // 6 = force-save while editing (co-edit); 2 = last editor closed — then advance key for next open
    if ((status === 2 || status === 6) && body.url) {
      const fileRes = await fetch(body.url);
      if (!fileRes.ok) {
        console.error("OnlyOffice callback: failed to fetch saved file", fileRes.status);
        return NextResponse.json({ error: 1 });
      }
      const arrayBuffer = await fileRes.arrayBuffer();
      await saveDocx(sessionId, Buffer.from(arrayBuffer));
      if (status === 2) {
        await recordDocumentSave(sessionId);
      }
      await syncReportStateFromOnlyOfficeSession(sessionId);
    }

    return NextResponse.json({ error: 0 });
  } catch (err) {
    console.error("POST /api/report/onlyoffice/callback error:", err);
    return NextResponse.json({ error: 1 });
  }
}
