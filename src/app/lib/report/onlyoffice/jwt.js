import crypto from "crypto";

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64url");
}

/**
 * HS256 JWT for OnlyOffice Document Server (no extra dependency).
 */
export function signOnlyOfficeToken(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/** Verify HS256 JWT from OnlyOffice (editor config or save callback). */
export function verifyOnlyOfficeToken(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (expected !== parts[2]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function isOnlyOfficeJwtEnabled() {
  return (
    String(process.env.ONLYOFFICE_JWT_ENABLED ?? "true").toLowerCase() !== "false" &&
    Boolean(getOnlyOfficeJwtSecret())
  );
}

/**
 * Callback body may be JWT-signed (Authorization: Bearer) when Document Server JWT is on.
 */
export async function parseOnlyOfficeCallbackBody(req) {
  const raw = await req.json().catch(() => ({}));
  if (!isOnlyOfficeJwtEnabled()) return raw;

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return raw;

  const decoded = verifyOnlyOfficeToken(bearer, getOnlyOfficeJwtSecret());
  return decoded && typeof decoded === "object" ? decoded : raw;
}

export function getOnlyOfficeJwtSecret() {
  return process.env.ONLYOFFICE_JWT_SECRET || "";
}

export function isOnlyOfficeEnabled() {
  return Boolean(
    process.env.ONLYOFFICE_URL &&
      getOnlyOfficeJwtSecret() &&
      process.env.NEXT_PUBLIC_ONLYOFFICE_URL,
  );
}

export function getOnlyOfficeInternalUrl() {
  return String(process.env.ONLYOFFICE_URL || "").replace(/\/$/, "");
}

export function getOnlyOfficePublicUrl() {
  return String(process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "").replace(/\/$/, "");
}

/**
 * URL OnlyOffice Document Server uses to download/save DOCX (server-side fetch).
 * Local Docker: http://kias-doc-proxy:8888 (see docker-compose.onlyoffice.local.yml)
 */
export function getReportDocumentHostUrl() {
  const explicit = String(process.env.REPORT_DOCUMENT_HOST_URL || "").replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "development") {
    return "http://kias-doc-proxy:8888";
  }
  return (
    String(process.env.INTERNAL_APP_URL || "").replace(/\/$/, "") ||
    String(process.env.NEXTAUTH_URL || "").replace(/\/$/, "")
  );
}
