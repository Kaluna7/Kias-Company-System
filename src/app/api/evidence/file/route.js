export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { join, normalize } from "path";
import { Readable } from "node:stream";
import {
  getObjectStream,
  guessContentType,
  isMinioEnabled,
  objectKeyFromFileUrl,
} from "@/app/lib/minio";
import { safeDownloadFileName } from "@/lib/evidenceFileUrl";

function toWebStream(body) {
  if (!body) return null;
  if (typeof body.transformToWebStream === "function") {
    return body.transformToWebStream();
  }
  if (body instanceof ReadableStream) return body;
  if (body instanceof Readable) return Readable.toWeb(body);
  return body;
}

function resolveLocalUploadPath(urlPath) {
  const raw = String(urlPath || "").trim();
  if (!raw.startsWith("/uploads/")) return null;

  const rel = raw.replace(/^\/uploads\//, "");
  const parts = rel.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((p) => p === ".." || p === ".")) return null;

  const full = normalize(join(process.cwd(), "public", "uploads", ...parts));
  const root = normalize(join(process.cwd(), "public", "uploads"));
  if (!full.startsWith(root)) return null;
  return full;
}

/**
 * Universal evidence file download.
 * Query: path=/uploads/...|/api/evidence/storage/...  download=1  name=original.pdf
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const pathParam = String(searchParams.get("path") || "").trim();
    const forceDownload = searchParams.get("download") !== "0";
    const preferredName = String(searchParams.get("name") || "").trim();

    if (!pathParam) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    // --- Legacy local uploads ---
    if (pathParam.startsWith("/uploads/")) {
      const fullPath = resolveLocalUploadPath(pathParam);
      if (!fullPath || !existsSync(fullPath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const fileName = safeDownloadFileName(
        preferredName || fullPath.split(/[/\\]/).pop() || "download",
      );
      const stat = statSync(fullPath);
      const headers = new Headers();
      headers.set("Content-Type", guessContentType(fileName));
      headers.set("Content-Length", String(stat.size));
      headers.set(
        "Content-Disposition",
        `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
      );

      const nodeStream = createReadStream(fullPath);
      return new NextResponse(Readable.toWeb(nodeStream), { status: 200, headers });
    }

    // --- MinIO storage proxy URLs ---
    const objectKey =
      objectKeyFromFileUrl(pathParam) ||
      (pathParam.startsWith("/") ? null : pathParam);

    if (!objectKey) {
      return NextResponse.json({ error: "Unsupported file path" }, { status: 400 });
    }

    if (!isMinioEnabled()) {
      // Fallback: treat key as uploads/evidence/{key}
      const fallback = resolveLocalUploadPath(`/uploads/evidence/${objectKey}`);
      if (fallback && existsSync(fallback)) {
        const fileName = safeDownloadFileName(
          preferredName || fallback.split(/[/\\]/).pop() || "download",
        );
        const stat = statSync(fallback);
        const headers = new Headers();
        headers.set("Content-Type", guessContentType(fileName));
        headers.set("Content-Length", String(stat.size));
        headers.set(
          "Content-Disposition",
          `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
        );
        const nodeStream = createReadStream(fallback);
        return new NextResponse(Readable.toWeb(nodeStream), { status: 200, headers });
      }
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const result = await getObjectStream(objectKey);
    const fileName = safeDownloadFileName(
      preferredName || objectKey.split("/").pop() || "download",
    );
    const webBody = toWebStream(result.Body);
    if (!webBody) {
      return NextResponse.json({ error: "Empty object" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", result.ContentType || guessContentType(fileName));
    if (result.ContentLength != null) {
      headers.set("Content-Length", String(result.ContentLength));
    }
    headers.set(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
    );

    return new NextResponse(webBody, { status: 200, headers });
  } catch (error) {
    console.error("GET /api/evidence/file:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
