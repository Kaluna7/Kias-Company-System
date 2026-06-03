export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { docxExists } from "@/app/lib/report/documentStore";
import { exportStoredSession } from "@/app/lib/report/reportService";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const p = await Promise.resolve(params);
    const sessionId = p?.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (!(await docxExists(sessionId))) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const format = (searchParams.get("format") || "docx").toLowerCase();
    const fmt = format === "pdf" ? "pdf" : "docx";
    const { buffer, contentType, year } = await exportStoredSession(sessionId, fmt);
    const ext = fmt === "pdf" ? "pdf" : "docx";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="KIAS-Consolidated-Report-${year}.${ext}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/report/documents/[sessionId]/download error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
