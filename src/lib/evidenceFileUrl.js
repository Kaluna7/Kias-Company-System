/**
 * Helpers for evidence attachment URLs (legacy /uploads and MinIO proxy).
 */

export const EVIDENCE_STORAGE_PREFIX = "/api/evidence/storage/";
export const EVIDENCE_UPLOADS_PREFIX = "/uploads/";

/** Build a same-origin download URL that forces attachment and encodes & safely. */
export function buildEvidenceDownloadHref(fileUrl, fileName = "") {
  const raw = String(fileUrl || "").trim();
  if (!raw || raw.startsWith("[{") || raw.startsWith("[")) return "";

  const name = String(fileName || "").trim();
  const params = new URLSearchParams();
  params.set("path", raw);
  params.set("download", "1");
  if (name) params.set("name", name);
  return `/api/evidence/file?${params.toString()}`;
}

/** Sanitize Content-Disposition filename. */
export function safeDownloadFileName(name, fallback = "download") {
  const base = String(name || fallback).trim() || fallback;
  return base.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}
