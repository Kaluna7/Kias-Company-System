export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import { join, normalize, basename } from "path";
import { Readable } from "node:stream";
import {
  getObjectStream,
  guessContentType,
  isMinioEnabled,
  resolveExistingMinioKey,
} from "@/app/lib/minio";

const UPLOADS_EVIDENCE_ROOT = join(process.cwd(), "public", "uploads", "evidence");

function toWebStream(body) {
  if (!body) return null;
  if (typeof body.transformToWebStream === "function") {
    return body.transformToWebStream();
  }
  if (body instanceof ReadableStream) return body;
  if (body instanceof Readable) return Readable.toWeb(body);
  return body;
}

function tryLocalEvidenceFile(objectKey, preferredName = "") {
  const parts = String(objectKey || "")
    .split("/")
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  if (parts.length === 0 || parts.some((p) => p === ".." || p === ".")) return null;

  const full = normalize(join(UPLOADS_EVIDENCE_ROOT, ...parts));
  const root = normalize(UPLOADS_EVIDENCE_ROOT);
  if (!full.startsWith(root)) return null;
  if (existsSync(full)) return full;

  const folder = parts[0];
  const folderPath = normalize(join(UPLOADS_EVIDENCE_ROOT, folder));
  if (!folderPath.startsWith(root) || !existsSync(folderPath)) return null;

  if (preferredName) {
    const byName = join(folderPath, basename(preferredName));
    if (existsSync(byName)) return byName;
  }

  try {
    const storedName = parts.slice(1).join("/").toLowerCase();
    const wantPreferred = basename(preferredName || "").toLowerCase();
    const files = readdirSync(folderPath);
    const hit = files.find((f) => {
      const lower = f.toLowerCase();
      return (
        (storedName && (lower === storedName || lower.includes(storedName))) ||
        (wantPreferred && (lower === wantPreferred || lower.includes(wantPreferred)))
      );
    });
    if (hit) return join(folderPath, hit);
  } catch {
    // ignore
  }

  return null;
}

/**
 * Serve evidence: local disk first, then MinIO.
 */
export async function GET(req, { params }) {
  try {
    const resolved = await params;
    const segments = resolved?.path;
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const objectKeyRaw = segments.map((s) => decodeURIComponent(s)).join("/");
    const preferredName = new URL(req.url).searchParams.get("name") || "";
    const forceDownload = new URL(req.url).searchParams.get("download") === "1";

    const localPath = tryLocalEvidenceFile(objectKeyRaw, preferredName);
    if (localPath) {
      const fileName = basename(localPath) || "file";
      const stat = statSync(localPath);
      const headers = new Headers();
      headers.set("Content-Type", guessContentType(fileName));
      headers.set("Content-Length", String(stat.size));
      headers.set(
        "Content-Disposition",
        `${forceDownload ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
      );
      return new NextResponse(Readable.toWeb(createReadStream(localPath)), {
        status: 200,
        headers,
      });
    }

    if (isMinioEnabled()) {
      try {
        const objectKey = await resolveExistingMinioKey(
          `/api/evidence/storage/${objectKeyRaw
            .split("/")
            .map((s) => encodeURIComponent(s))
            .join("/")}`,
          preferredName,
        );
        const result = await getObjectStream(objectKey);
        const webBody = toWebStream(result.Body);
        if (!webBody) {
          return NextResponse.json({ error: "Empty object" }, { status: 404 });
        }
        const fileName = objectKey.split("/").pop() || "file";
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
      } catch (e) {
        return NextResponse.json(
          { error: e?.message || `File not found (uploads or MinIO: ${objectKeyRaw})` },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      { error: `File not found on disk (uploads/evidence/${objectKeyRaw})` },
      { status: 404 },
    );
  } catch (error) {
    console.error("GET /api/evidence/storage:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
