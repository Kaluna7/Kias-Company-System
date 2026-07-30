export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, normalize, basename } from "path";
import {
  getObjectStream,
  guessContentType,
  isMinioEnabled,
  resolveExistingMinioKey,
} from "@/app/lib/minio";
import { safeDownloadFileName } from "@/lib/evidenceFileUrl";

const UPLOADS_EVIDENCE_ROOT = join(process.cwd(), "public", "uploads", "evidence");

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
}

/** Map stored URL → relative key dept/filename */
function evidenceRelativeKeyFromPath(pathParam) {
  let url = String(pathParam || "").trim().split("?")[0].split("#")[0];
  if (!url) return null;

  try {
    if (/^https?:\/\//i.test(url)) {
      url = new URL(url).pathname;
    }
  } catch {
    // keep
  }

  const storagePrefix = "/api/evidence/storage/";
  if (url.startsWith(storagePrefix)) {
    return url
      .slice(storagePrefix.length)
      .split("/")
      .filter(Boolean)
      .map(safeDecode)
      .join("/");
  }

  const uploadsPrefix = "/uploads/evidence/";
  if (url.startsWith(uploadsPrefix)) {
    return url
      .slice(uploadsPrefix.length)
      .split("/")
      .filter(Boolean)
      .map(safeDecode)
      .join("/");
  }

  if (url.startsWith("/uploads/")) {
    const rest = url.slice("/uploads/".length);
    if (rest.toLowerCase().startsWith("evidence/")) {
      return rest
        .slice("evidence/".length)
        .split("/")
        .filter(Boolean)
        .map(safeDecode)
        .join("/");
    }
  }

  if (!url.startsWith("/") && url.includes("/")) {
    return url
      .split("/")
      .filter(Boolean)
      .map(safeDecode)
      .join("/");
  }

  return null;
}

function resolveUnderEvidenceRoot(relativeKey) {
  const parts = String(relativeKey || "")
    .split("/")
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((p) => p === ".." || p === ".")) return null;

  const full = normalize(join(UPLOADS_EVIDENCE_ROOT, ...parts));
  const root = normalize(UPLOADS_EVIDENCE_ROOT);
  if (!full.startsWith(root)) return null;
  return full;
}

function findLocalEvidenceFile(relativeKey, preferredName = "") {
  const exact = resolveUnderEvidenceRoot(relativeKey);
  if (exact && existsSync(exact)) return exact;

  const parts = String(relativeKey || "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 1) return null;

  const folderName = parts[0];
  const storedFileName = parts.slice(1).join("/");

  for (const alt of [folderName, folderName.toLowerCase(), folderName.toUpperCase()]) {
    const folderPath = resolveUnderEvidenceRoot(alt);
    if (!folderPath || !existsSync(folderPath)) continue;

    if (storedFileName) {
      const candidate = join(folderPath, storedFileName);
      if (existsSync(candidate)) return candidate;
    }
    if (preferredName) {
      const byPreferred = join(folderPath, basename(preferredName));
      if (existsSync(byPreferred)) return byPreferred;
    }
    try {
      const files = readdirSync(folderPath);
      const want = [
        storedFileName.toLowerCase(),
        basename(preferredName || "").toLowerCase(),
      ].filter(Boolean);
      const hit = files.find((f) => {
        const lower = f.toLowerCase();
        return want.some((w) => w && (lower === w || lower.includes(w) || w.includes(lower)));
      });
      if (hit) return join(folderPath, hit);
    } catch {
      // ignore
    }
  }

  return null;
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

function decodePathParam(searchParams) {
  let pathParam = String(searchParams.get("path") || "").trim();
  const b64 = String(searchParams.get("p") || "").trim();
  if (b64) {
    try {
      const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
      const pad =
        normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
      const fromP = Buffer.from(normalized + pad, "base64").toString("utf8").trim();
      if (fromP) pathParam = fromP;
    } catch {
      // keep path
    }
  }
  return pathParam;
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
 * Evidence download:
 * 1) local disk public/uploads/evidence (legacy)
 * 2) MinIO bucket (current production files)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const pathParam = decodePathParam(searchParams);
    const forceDownload = searchParams.get("download") !== "0";
    const preferredName = String(searchParams.get("name") || "").trim();

    if (!pathParam) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    let normalizedPath = pathParam;
    if (/^https?:\/\//i.test(pathParam)) {
      try {
        normalizedPath = new URL(pathParam).pathname;
      } catch {
        normalizedPath = pathParam;
      }
    }

    const relativeKey = evidenceRelativeKeyFromPath(normalizedPath);

    // 1) Local disk first
    if (relativeKey) {
      const fullPath = findLocalEvidenceFile(relativeKey, preferredName);
      if (fullPath && existsSync(fullPath)) {
        const fileName = safeDownloadFileName(
          preferredName || basename(fullPath) || "download",
        );
        return fileResponse(
          readFileSync(fullPath),
          fileName,
          guessContentType(fileName),
          forceDownload,
        );
      }
    }

    // 2) MinIO
    if (isMinioEnabled()) {
      try {
        const objectKey = await resolveExistingMinioKey(
          normalizedPath.startsWith("/") ? normalizedPath : `/api/evidence/storage/${relativeKey || normalizedPath}`,
          preferredName,
        );
        const loaded = await readMinioBuffer(objectKey);
        if (loaded) {
          const fileName = safeDownloadFileName(
            preferredName || objectKey.split("/").pop() || "download",
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
          {
            error:
              e?.message ||
              `File not found on disk or MinIO${relativeKey ? ` (key: ${relativeKey})` : ""}.`,
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      {
        error: relativeKey
          ? `File not found on disk (uploads/evidence/${relativeKey}) and MinIO is not available.`
          : "Unsupported evidence file path.",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("GET /api/evidence/file:", error);
    return NextResponse.json(
      { error: error?.message || "File not found" },
      { status: 404 },
    );
  }
}
