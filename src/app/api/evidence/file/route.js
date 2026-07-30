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
  resolveExistingMinioKey,
} from "@/app/lib/minio";
import { safeDownloadFileName } from "@/lib/evidenceFileUrl";

function resolveLocalUploadPath(urlPath) {
  const raw = String(urlPath || "").trim();
  if (!raw.startsWith("/uploads/")) return null;

  const rel = raw.replace(/^\/uploads\//, "");
  const parts = rel
    .split("/")
    .filter(Boolean)
    .map((p) => {
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

async function readMinioBuffer(objectKey) {
  const result = await getObjectStream(objectKey);
  if (result.Body && typeof result.Body.transformToByteArray === "function") {
    return {
      buffer: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType || null,
    };
  }
  return null;
}

/**
 * Universal evidence file download.
 * Query: path=...  (or p=base64url)  download=1  name=original.pdf
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    let pathParam = String(searchParams.get("path") || "").trim();
    const b64 = String(searchParams.get("p") || "").trim();
    if (!pathParam && b64) {
      try {
        pathParam = Buffer.from(b64, "base64url").toString("utf8").trim();
      } catch {
        pathParam = "";
      }
    }

    const forceDownload = searchParams.get("download") !== "0";
    const preferredName = String(searchParams.get("name") || "").trim();

    if (!pathParam) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    // Absolute remote URL — proxy fetch
    if (/^https?:\/\//i.test(pathParam)) {
      // Prefer MinIO key extraction when it's our public MinIO URL
      if (isMinioEnabled() && objectKeyFromFileUrl(pathParam)) {
        try {
          const key = await resolveExistingMinioKey(pathParam, preferredName);
          const loaded = await readMinioBuffer(key);
          if (loaded) {
            const fileName = safeDownloadFileName(
              preferredName || key.split("/").pop() || "download",
            );
            return fileResponse(
              loaded.buffer,
              fileName,
              loaded.contentType || guessContentType(fileName),
              forceDownload,
            );
          }
        } catch {
          // fall through to fetch
        }
      }

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
      if (fullPath && existsSync(fullPath)) {
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

      // Same layout may exist in MinIO after migration
      if (isMinioEnabled()) {
        try {
          const key = await resolveExistingMinioKey(pathParam, preferredName);
          const loaded = await readMinioBuffer(key);
          if (loaded) {
            const fileName = safeDownloadFileName(
              preferredName || key.split("/").pop() || "download",
            );
            return fileResponse(
              loaded.buffer,
              fileName,
              loaded.contentType || guessContentType(fileName),
              forceDownload,
            );
          }
        } catch (e) {
          return NextResponse.json(
            { error: e?.message || "File not found in storage" },
            { status: 404 },
          );
        }
      }

      return NextResponse.json(
        { error: "File not found on server disk" },
        { status: 404 },
      );
    }

    // --- MinIO / storage proxy URLs ---
    const localKey = objectKeyFromFileUrl(pathParam);
    const localFallback = localKey
      ? resolveLocalUploadPath(`/uploads/evidence/${localKey}`)
      : null;
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

    const objectKey = await resolveExistingMinioKey(pathParam, preferredName);
    const loaded = await readMinioBuffer(objectKey);
    if (!loaded) {
      return NextResponse.json({ error: "Empty object" }, { status: 404 });
    }

    const fileName = safeDownloadFileName(
      preferredName || objectKey.split("/").pop() || "download",
    );
    return fileResponse(
      loaded.buffer,
      fileName,
      loaded.contentType || guessContentType(fileName),
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
