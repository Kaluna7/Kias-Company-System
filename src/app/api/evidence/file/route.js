export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join, normalize } from "path";
import {
  getObjectStream,
  guessContentType,
  isMinioEnabled,
  objectKeyFromFileUrl,
} from "@/app/lib/minio";
import { safeDownloadFileName } from "@/lib/evidenceFileUrl";

function resolveLocalUploadPath(urlPath) {
  const raw = String(urlPath || "").trim();
  if (!raw.startsWith("/uploads/")) return null;

  const rel = raw.replace(/^\/uploads\//, "");
  const parts = rel.split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (parts.length === 0) return null;
  if (parts.some((p) => p === ".." || p === ".")) return null;

  const full = normalize(join(process.cwd(), "public", "uploads", ...parts));
  const root = normalize(join(process.cwd(), "public", "uploads"));
  if (!full.startsWith(root)) return null;
  return full;
}

function fileResponse(buffer, fileName, contentType, forceDownload) {
  const headers = new Headers();
  headers.set("Content-Type", contentType || guessContentType(fileName));
  headers.set("Content-Length", String(buffer.length));
  headers.set(
    "Content-Disposition",
    `${forceDownload ? "attachment" : "inline"}; filename="${String(fileName).replace(/"/g, "")}"`,
  );
  headers.set("Cache-Control", "private, no-store");
  return new NextResponse(buffer, { status: 200, headers });
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

    // Absolute remote URL — proxy fetch (same-origin download UX)
    if (/^https?:\/\//i.test(pathParam)) {
      const upstream = await fetch(pathParam);
      if (!upstream.ok) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const fileName = safeDownloadFileName(
        preferredName || pathParam.split("/").pop() || "download",
      );
      return fileResponse(
        buf,
        fileName,
        upstream.headers.get("content-type") || guessContentType(fileName),
        forceDownload,
      );
    }

    // --- Legacy local uploads ---
    if (pathParam.startsWith("/uploads/")) {
      const fullPath = resolveLocalUploadPath(pathParam);
      if (!fullPath || !existsSync(fullPath)) {
        // Also try storage-style key under uploads/evidence/
        const asKey = pathParam.replace(/^\/uploads\/evidence\//i, "");
        const alt = resolveLocalUploadPath(`/uploads/evidence/${asKey}`);
        if (!alt || !existsSync(alt)) {
          return NextResponse.json(
            { error: "File not found on server disk" },
            { status: 404 },
          );
        }
        const fileName = safeDownloadFileName(
          preferredName || alt.split(/[/\\]/).pop() || "download",
        );
        return fileResponse(
          readFileSync(alt),
          fileName,
          guessContentType(fileName),
          forceDownload,
        );
      }

      const fileName = safeDownloadFileName(
        preferredName || fullPath.split(/[/\\]/).pop() || "download",
      );
      return fileResponse(
        readFileSync(fullPath),
        fileName,
        guessContentType(fileName),
        forceDownload,
      );
    }

    // --- MinIO / storage proxy URLs ---
    const objectKey =
      objectKeyFromFileUrl(pathParam) ||
      (pathParam.startsWith("/") ? null : pathParam);

    if (!objectKey) {
      return NextResponse.json({ error: "Unsupported file path" }, { status: 400 });
    }

    const localFallback = resolveLocalUploadPath(`/uploads/evidence/${objectKey}`);
    if (localFallback && existsSync(localFallback)) {
      const fileName = safeDownloadFileName(
        preferredName || localFallback.split(/[/\\]/).pop() || "download",
      );
      return fileResponse(
        readFileSync(localFallback),
        fileName,
        guessContentType(fileName),
        forceDownload,
      );
    }

    if (!isMinioEnabled()) {
      return NextResponse.json(
        {
          error:
            "Storage (MinIO) is not configured on this server, and the file was not found under /uploads.",
        },
        { status: 503 },
      );
    }

    const result = await getObjectStream(objectKey);
    const fileName = safeDownloadFileName(
      preferredName || objectKey.split("/").pop() || "download",
    );

    let buffer;
    if (result.Body && typeof result.Body.transformToByteArray === "function") {
      buffer = Buffer.from(await result.Body.transformToByteArray());
    } else if (result.Body && typeof result.Body.transformToString === "function") {
      buffer = Buffer.from(await result.Body.transformToByteArray());
    } else {
      return NextResponse.json({ error: "Empty object" }, { status: 404 });
    }

    return fileResponse(
      buffer,
      fileName,
      result.ContentType || guessContentType(fileName),
      forceDownload,
    );
  } catch (error) {
    console.error("GET /api/evidence/file:", error);
    return NextResponse.json(
      { error: error?.message || "File not found" },
      { status: 404 },
    );
  }
}
