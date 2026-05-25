/**
 * Client helper — SOP PDF pipeline API
 * Upload PDF → PDF Parser → OCR Fallback → Merge → GPT → JSON
 */

/**
 * @param {{ file: File, debug?: boolean }} payload
 */
export async function callExtractStepsFromPdf(payload) {
  const form = new FormData();
  form.append("pdf", payload.file, payload.file.name || "document.pdf");
  if (payload.debug) form.append("debug", "true");

  const res = await fetch("/api/Ai/extract-steps", {
    method: "POST",
    body: form,
  });

  if (res.status === 404) {
    return {
      success: false,
      error:
        "API /api/Ai/extract-steps tidak ditemukan (404). Jalankan: pnpm build && pnpm start",
      debug: { step: "api_404" },
    };
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: json.error || `AI API error (${res.status})`,
      debug: json.debug,
      pipeline: json.pipeline,
      mergedText: json.mergedText,
      ...json,
    };
  }

  return json;
}

/**
 * Legacy: teks saja (tanpa upload PDF ke server pipeline)
 * @param {{ text: string, debug?: boolean }} payload
 */
export async function callExtractStepsApi(payload) {
  const res = await fetch("/api/Ai/extract-steps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: payload.text,
      debug: Boolean(payload.debug),
    }),
  });

  if (res.status === 404) {
    return {
      success: false,
      error:
        "API /api/Ai/extract-steps tidak ditemukan (404). Jalankan: pnpm build && pnpm start",
      debug: { step: "api_404" },
    };
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: json.error || `AI API error (${res.status})`,
      debug: json.debug,
      ...json,
    };
  }

  return json;
}
