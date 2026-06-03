export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exportReportDirect } from "@/app/lib/report/reportService";

function sanitizeFilename(name) {
  return String(name || "report").replace(/[^\w.-]+/g, "_");
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const format = (searchParams.get("format") || "docx").toLowerCase();

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (format !== "docx" && format !== "pdf") {
      return NextResponse.json(
        { success: false, error: "Invalid format. Use docx or pdf." },
        { status: 400 },
      );
    }

    const fmt = format === "pdf" ? "pdf" : "docx";
    const { buffer, contentType, year } = await exportReportDirect(payload, fmt);
    const ext = fmt === "pdf" ? "pdf" : "docx";
    const filename = sanitizeFilename(`KIAS-Consolidated-Report-${year}.${ext}`);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("POST /api/report/export error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
