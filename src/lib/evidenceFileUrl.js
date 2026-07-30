/**
 * Helpers for evidence attachment URLs (legacy /uploads and MinIO proxy).
 */

export const EVIDENCE_STORAGE_PREFIX = "/api/evidence/storage/";
export const EVIDENCE_UPLOADS_PREFIX = "/uploads/";

/** Standard base64 → base64url (no padding). Works in browser + Node. */
function toBase64Url(str) {
  const input = String(str);
  let base64 = "";

  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(input, "utf8").toString("base64");
  } else if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    base64 = btoa(binary);
  } else {
    return "";
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Build a same-origin download URL that forces attachment and encodes path safely. */
export function buildEvidenceDownloadHref(fileUrl, fileName = "") {
  const raw = String(fileUrl || "").trim();
  if (!raw || raw.startsWith("[{") || raw.startsWith("[")) return "";

  const name = String(fileName || "").trim();
  const params = new URLSearchParams();
  // Prefer base64url payload so &, ?, spaces cannot break the query string
  const encoded = toBase64Url(raw);
  if (encoded) params.set("p", encoded);
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
