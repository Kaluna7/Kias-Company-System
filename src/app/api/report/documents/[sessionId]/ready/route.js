export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { docxExists, getDocxPath } from "@/app/lib/report/documentStore";
import fs from "fs";

/**
 * Poll until shared DOCX is fully written (for OnlyOffice auto-join).
 * GET /api/report/documents/:sessionId/ready
 */
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = String(params?.sessionId || "").trim();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    if (!(await docxExists(sessionId))) {
      return NextResponse.json(
        { success: true, ready: false, sessionId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    let size = 0;
    try {
      const stat = await fs.promises.stat(getDocxPath(sessionId));
      size = Number(stat.size) || 0;
    } catch {
      return NextResponse.json(
        { success: true, ready: false, sessionId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        success: true,
        ready: size > 512,
        sessionId,
        size,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("GET /api/report/documents/[sessionId]/ready:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
