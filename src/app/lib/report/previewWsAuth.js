import { signOnlyOfficeToken, verifyOnlyOfficeToken } from "./onlyoffice/jwt.js";

const TICKET_TTL_SEC = 300;

/**
 * Short-lived ticket for WebSocket upgrade (HTTP session cookie → WS query token).
 * @param {object} user
 * @param {string} secret
 */
export function createPreviewWsTicket(user, secret) {
  if (!user || !secret) return null;
  const exp = Math.floor(Date.now() / 1000) + TICKET_TTL_SEC;
  return signOnlyOfficeToken(
    {
      sub: String(user.id || user.sub || user.email || ""),
      id: String(user.id || user.sub || user.email || ""),
      email: String(user.email || ""),
      name: String(user.name || user.email || "User"),
      purpose: "preview-ws",
      exp,
    },
    secret,
  );
}

/**
 * @param {string} token
 * @param {string} secret
 */
export function verifyPreviewWsTicket(token, secret) {
  const decoded = verifyOnlyOfficeToken(token, secret);
  if (!decoded || decoded.purpose !== "preview-ws") return null;
  if (decoded.exp && Number(decoded.exp) < Math.floor(Date.now() / 1000)) return null;
  return decoded;
}

export const PREVIEW_WS_TICKET_TTL_SEC = TICKET_TTL_SEC;
