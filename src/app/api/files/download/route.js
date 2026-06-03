export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFileBuffer } from "@/app/lib/files/fileStore";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseYear(searchParams.get("year"));
    const folderId = String(searchParams.get("folderId") || "").trim();
    const id = String(searchParams.get("id") || "").trim();

    if (!year || !folderId || !id) {
      return NextResponse.json({ success: false, error: "Missing year, folderId, or id" }, { status: 400 });
    }

    const stored = await getFileBuffer(year, folderId, id);
    if (!stored?.buffer) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const buffer = stored.buffer;
    const downloadName = stored.originalName || "download";
    const headers = new Headers();
    headers.set("Content-Type", stored.mimeType || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
    headers.set("Content-Length", String(buffer.length));

    return new NextResponse(buffer, { status: 200, headers });
  } catch (err) {
    console.error("GET /api/files/download:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
