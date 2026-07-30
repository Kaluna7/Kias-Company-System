export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { join, normalize } from "path";
import { Readable } from "node:stream";
import { getObjectStream, guessContentType, isMinioEnabled, resolveExistingMinioKey } from "@/app/lib/minio";

function toWebStream(body) {
  if (!body) return null;
  if (typeof body.transformToWebStream === "function") {
    return body.transformToWebStream();
  }
  if (body instanceof ReadableStream) return body;
  if (body instanceof Readable) return Readable.toWeb(body);
  return body;
}

function tryLocalEvidenceFile(objectKey) {
  const parts = String(objectKey || "")
    .split("/")
    .filter(Boolean);
  if (parts.length === 0 || parts.some((p) => p === ".." || p === ".")) return null;
  const full = normalize(join(process.cwd(), "public", "uploads", "evidence", ...parts));
  const root = normalize(join(process.cwd(), "public", "uploads", "evidence"));
  if (!full.startsWith(root)) return null;
  if (!existsSync(full)) return null;
  return full;
}

export async function GET(req, { params }) {
  try {
    const resolved = await params;
    const segments = resolved?.path;
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const objectKeyRaw = segments.map((s) => decodeURIComponent(s)).join("/");
    const preferredName = new URL(req.url).searchParams.get("name") || "";
    let objectKey = objectKeyRaw;
    if (isMinioEnabled()) {
      try {
        objectKey = await resolveExistingMinioKey(
          `/api/evidence/storage/${objectKeyRaw
            .split("/")
            .map((s) => encodeURIComponent(s))
            .join("/")}`,
          preferredName,
        );
      } catch {
        objectKey = objectKeyRaw;
      }
    }
    const fileName = objectKey.split("/").pop() || "file";
    const forceDownload = new URL(req.url).searchParams.get("download") === "1";
    const disposition = `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`;

    if (isMinioEnabled()) {
      try {
        const result = await getObjectStream(objectKey);
        const webBody = toWebStream(result.Body);
        if (!webBody) {
          return NextResponse.json({ error: "Empty object" }, { status: 404 });
        }

        const headers = new Headers();
        headers.set("Content-Type", result.ContentType || guessContentType(fileName));
        if (result.ContentLength != null) {
          headers.set("Content-Length", String(result.ContentLength));
        }
        headers.set("Content-Disposition", disposition);

        return new NextResponse(webBody, { status: 200, headers });
      } catch (minioErr) {
        // Fall through to local disk for mixed environments
        console.warn("MinIO get failed, trying local uploads:", minioErr?.message || minioErr);
      }
    }

    const localPath = tryLocalEvidenceFile(objectKey);
    if (localPath) {
      const stat = statSync(localPath);
      const headers = new Headers();
      headers.set("Content-Type", guessContentType(fileName));
      headers.set("Content-Length", String(stat.size));
      headers.set("Content-Disposition", disposition);
      return new NextResponse(Readable.toWeb(createReadStream(localPath)), {
        status: 200,
        headers,
      });
    }

    if (!isMinioEnabled()) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    console.error("GET /api/evidence/storage:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
