import { getOnlyOfficeInternalUrl, getOnlyOfficePublicUrl } from "./jwt";

const HEALTH_TIMEOUT_MS = 8000;

/**
 * @returns {Promise<{ ok: boolean, internalUrl: string, publicUrl: string, detail?: string }>}
 */
export async function checkOnlyOfficeDocumentServer() {
  const internalUrl = getOnlyOfficeInternalUrl();
  const publicUrl = getOnlyOfficePublicUrl();
  const healthUrl = `${internalUrl}/healthcheck`;

  try {
    const res = await fetch(healthUrl, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.text()).trim();
    if (res.ok && body === "true") {
      return { ok: true, internalUrl, publicUrl };
    }
    return {
      ok: false,
      internalUrl,
      publicUrl,
      detail: `Health check returned HTTP ${res.status} (${body || "empty"})`,
    };
  } catch (err) {
    const msg = err?.cause?.code || err?.code || err?.message || String(err);
    const refused =
      /ECONNREFUSED|fetch failed|ENOTFOUND|ETIMEDOUT|aborted/i.test(String(msg));
    return {
      ok: false,
      internalUrl,
      publicUrl,
      detail: refused
        ? "Cannot connect — is Docker Desktop running and OnlyOffice started on port 8082?"
        : msg,
    };
  }
}

export function getOnlyOfficeLocalStartHint() {
  return [
    "1. Start Docker Desktop (wait until it shows Running).",
    "2. In the project folder run:",
    "   docker compose -f docker-compose.onlyoffice.local.yml up -d",
    "3. Wait 1–3 minutes, then open http://localhost:8082/healthcheck (should show true).",
    "4. Restart pnpm dev. NEXT_PUBLIC_ONLYOFFICE_URL must be http://localhost:8082 (not /onlyoffice-proxy).",
  ].join("\n");
}
