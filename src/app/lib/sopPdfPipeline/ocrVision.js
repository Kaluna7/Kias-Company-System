import { aiDebugError, aiDebugLog } from "@/app/lib/aiDebugLog";
import { resolveOpenAIModel } from "@/app/lib/openaiChat";

const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const RESPONSES_URL = `${BASE_URL}/responses`;
const OCR_MODEL = process.env.OPENAI_OCR_MODEL || process.env.OPENAI_EXTRACT_STEPS_MODEL || "gpt-5.4";

/**
 * OCR satu halaman (gambar PNG/JPEG base64) via OpenAI Vision Responses API.
 * @param {string} imageBase64 - tanpa prefix data:
 * @param {number} pageNum
 * @param {string} [mime] image/png atau image/jpeg
 */
export async function ocrPageImageWithVision(imageBase64, pageNum, mime = "image/png") {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY missing", text: "" };
  }

  const model = resolveOpenAIModel(OCR_MODEL);
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mime};base64,${imageBase64}`;

  const body = {
    model,
    instructions:
      "Extract ALL visible text from SOP procedure tables and images. Include row numbers (1, 2, 3), every cell, lists under images, and captions. Plain text only, preserve row order. No commentary.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Extract all visible text from this SOP document page (page ${pageNum}). Return plain text only.`,
          },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
    reasoning: { effort: "low" },
    max_output_tokens: 8000,
  };

  aiDebugLog("sop-pipeline", "ocr_vision start", { page: pageNum, model });

  try {
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err =
        data?.error?.message || data?.message || raw.slice(0, 300) || `OCR failed ${res.status}`;
      aiDebugError("sop-pipeline", "ocr_vision failed", { page: pageNum, err });
      return { ok: false, error: err, text: "" };
    }

    const text =
      data?.output_text ||
      (data?.output || [])
        .flatMap((o) => o.content || [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text)
        .join("\n") ||
      "";

    aiDebugLog("sop-pipeline", "ocr_vision ok", { page: pageNum, textLen: text.length });
    return { ok: true, text: text.trim() };
  } catch (err) {
    aiDebugError("sop-pipeline", "ocr_vision exception", { page: pageNum, error: String(err) });
    return { ok: false, error: String(err), text: "" };
  }
}
