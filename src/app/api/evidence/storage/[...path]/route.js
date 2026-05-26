export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getObjectStream, guessContentType, isMinioEnabled } from "@/app/lib/minio";

export async function GET(req, { params }) {
  try {
    if (!isMinioEnabled()) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const resolved = await params;
    const segments = resolved?.path;
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const objectKey = segments.map((s) => decodeURIComponent(s)).join("/");
    const result = await getObjectStream(objectKey);
    const fileName = objectKey.split("/").pop() || "file";

    const headers = new Headers();
    headers.set("Content-Type", result.ContentType || guessContentType(fileName));
    if (result.ContentLength != null) {
      headers.set("Content-Length", String(result.ContentLength));
    }
    headers.set("Content-Disposition", `inline; filename="${fileName.replace(/"/g, "")}"`);

    const body = result.Body;
    if (!body) {
      return NextResponse.json({ error: "Empty object" }, { status: 404 });
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    console.error("GET /api/evidence/storage:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
