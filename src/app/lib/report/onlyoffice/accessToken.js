import crypto from "crypto";
import { getOnlyOfficeJwtSecret } from "./jwt";

const PURPOSE = "report-doc-access";

function getSecret() {
  return getOnlyOfficeJwtSecret() || process.env.NEXTAUTH_SECRET || "kias-report-doc-fallback";
}

export function createDocumentAccessToken(sessionId, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${PURPOSE}:${sessionId}:${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyDocumentAccessToken(sessionId, token) {
  if (!token || !sessionId) return false;
  const [expStr, sig] = String(token).split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${PURPOSE}:${sessionId}:${exp}`;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
