/**
 * Helpers for evidence attachment URLs (legacy /uploads and MinIO proxy).
 */

export const EVIDENCE_STORAGE_PREFIX = "/api/evidence/storage/";
export const EVIDENCE_UPLOADS_PREFIX = "/uploads/";

function toBase64Url(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(String(str), "utf8").toString("base64url");
  }
  // Browser fallback
  const bytes = new TextEncoder().encode(String(str));
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Build a same-origin download URL that forces attachment and encodes path safely. */
export function buildEvidenceDownloadHref(fileUrl, fileName = "") {
  const raw = String(fileUrl || "").trim();
  if (!raw || raw.startsWith("[{") || raw.startsWith("[")) return "";

  const name = String(fileName || "").trim();
  const params = new URLSearchParams();
  // base64url avoids &, ?, #, spaces breaking the query string
  params.set("p", toBase64Url(raw));
  params.set("path", raw); // keep for older servers / debugging
  params.set("download", "1");
  if (name) params.set("name", name);
  return `/api/evidence/file?${params.toString()}`;
}

/** Sanitize Content-Disposition filename. */
export function safeDownloadFileName(name, fallback = "download") {
  const base = String(name || fallback).trim() || fallback;
  return base.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}
