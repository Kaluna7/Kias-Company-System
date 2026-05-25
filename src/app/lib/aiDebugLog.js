/** Backend console debug for OpenAI / extract-steps. Set OPENAI_DEBUG=true in .env */
export function isAiDebugEnabled() {
  const v = (process.env.OPENAI_DEBUG || "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return process.env.NODE_ENV !== "production";
}

function safeJson(value, maxLen = 2000) {
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…[truncated]` : s;
  } catch {
    return String(value);
  }
}

/**
 * @param {string} scope e.g. extract-steps | openai-responses
 * @param {string} step
 * @param {Record<string, unknown>} [data]
 */
export function aiDebugLog(scope, step, data) {
  if (!isAiDebugEnabled()) return;
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[KIAS AI][${scope}][${ts}] ${step}`, safeJson(data));
  } else {
    console.log(`[KIAS AI][${scope}][${ts}] ${step}`);
  }
}

/** Always printed (even when OPENAI_DEBUG=false) — for production troubleshooting. */
export function aiLogAlways(scope, step, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[KIAS AI][${scope}][${ts}] ${step}`, safeJson(data));
  } else {
    console.log(`[KIAS AI][${scope}][${ts}] ${step}`);
  }
}

export function aiDebugError(scope, step, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.error(`[KIAS AI][${scope}][${ts}] ${step}`, safeJson(data));
  } else {
    console.error(`[KIAS AI][${scope}][${ts}] ${step}`);
  }
}
