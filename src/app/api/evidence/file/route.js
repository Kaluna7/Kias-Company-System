export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, normalize, basename } from "path";
import { guessContentType } from "@/app/lib/minio";
import { safeDownloadFileName } from "@/lib/evidenceFileUrl";

const UPLOADS_EVIDENCE_ROOT = join(process.cwd(), "public", "uploads", "evidence");

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
}

/** Map any stored evidence URL to a relative key: dept/filename */
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

  // Bare key: hrd/file.xlsx
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

  // Try alternate folder casing / preferred original filename in same folder
  const parts = String(relativeKey || "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 2) return null;

  const folderName = parts[0];
  const storedFileName = parts.slice(1).join("/");
  const folderPath = resolveUnderEvidenceRoot(folderName);
  if (!folderPath || !existsSync(folderPath)) {
    // try lowercase / uppercase folder
    for (const alt of [folderName.toLowerCase(), folderName.toUpperCase()]) {
      const altFolder = resolveUnderEvidenceRoot(alt);
      if (altFolder && existsSync(altFolder)) {
        const candidate = join(altFolder, storedFileName);
        if (existsSync(candidate)) return candidate;
        const byPreferred = preferredName ? join(altFolder, basename(preferredName)) : null;
        if (byPreferred && existsSync(byPreferred)) return byPreferred;
        // scan folder for closest name match
        try {
          const files = readdirSync(altFolder);
          const want = [
            storedFileName.toLowerCase(),
            basename(preferredName || "").toLowerCase(),
          ].filter(Boolean);
          const hit = files.find((f) => {
            const lower = f.toLowerCase();
            return want.some((w) => w && (lower === w || lower.includes(w) || w.includes(lower)));
          });
          if (hit) return join(altFolder, hit);
        } catch {
          // ignore
        }
      }
    }
    return null;
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

  return null;
}

function fileResponse(buffer, fileName, forceDownload) {
  const headers = new Headers();
  headers.set("Content-Type", guessContentType(fileName));
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

/**
 * Evidence download from local disk only (public/uploads/evidence).
 * Does NOT use MinIO — published legacy files live on disk.
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

    // Absolute http(s) that is actually our uploads path
    let normalizedPath = pathParam;
    if (/^https?:\/\//i.test(pathParam)) {
      try {
        normalizedPath = new URL(pathParam).pathname;
      } catch {
        return NextResponse.json(
          { error: "External URL download is disabled for evidence files." },
          { status: 400 },
        );
      }
    }

    const relativeKey = evidenceRelativeKeyFromPath(normalizedPath);
    if (!relativeKey) {
      return NextResponse.json(
        {
          error:
            "Unsupported evidence file path. Expected /uploads/evidence/... or /api/evidence/storage/...",
        },
        { status: 400 },
      );
    }

    const fullPath = findLocalEvidenceFile(relativeKey, preferredName);
    if (!fullPath || !existsSync(fullPath)) {
      return NextResponse.json(
        {
          error: `File not found on disk (uploads/evidence/${relativeKey}). Re-upload the file if it was never saved locally.`,
        },
        { status: 404 },
      );
    }

    const fileName = safeDownloadFileName(
      preferredName || basename(fullPath) || "download",
    );
    return fileResponse(readFileSync(fullPath), fileName, forceDownload);
  } catch (error) {
    console.error("GET /api/evidence/file:", error);
    return NextResponse.json(
      { error: error?.message || "File not found" },
      { status: 404 },
    );
  }
}
