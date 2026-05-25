import { callOpenAIForExtractSteps, GPT54_MODEL } from "@/app/lib/openaiChat";
import {
  extractProcedureSection,
  normalizeExtractedSteps,
} from "@/app/utils/sopProcedureText";

const AI_INSTRUCTIONS =
  'Extract SOP procedure steps verbatim. Respond with JSON only: {"steps":[{"step":1,"text":"..."}]}.';

const MAX_PROMPT_CHARS = Number(process.env.OPENAI_MAX_PROMPT_CHARS || 0) || Infinity;

function normalizeRawSteps(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return [];

  return parsed
    .map((item, idx) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { step: idx + 1, text, instruction: text } : null;
      }
      if (!item || typeof item !== "object") return null;
      const stepNum =
        typeof item.step === "number"
          ? item.step
          : typeof item.no === "number"
            ? item.no
            : idx + 1;
      const stepText =
        item.text ||
        item.Text ||
        item.instruction ||
        item.content ||
        item.sop_related ||
        "";
      const text = String(stepText).trim();
      if (!text) return null;
      return { step: stepNum, text, instruction: text };
    })
    .filter(Boolean)
    .filter((s) => s.text.length >= 2);
}

export function tryParseStepsPayload(s) {
  if (!s || typeof s !== "string") return null;
  const cleaned = s.replace(/^\uFEFF/, "").trim();

  try {
    const p = JSON.parse(cleaned);
    if (Array.isArray(p)) return normalizeRawSteps(p);
    if (Array.isArray(p?.steps)) return normalizeRawSteps(p.steps);
  } catch {
    /* continue */
  }

  const stepsMatch = cleaned.match(/"steps"\s*:\s*(\[[\s\S]*\])/i);
  if (stepsMatch?.[1]) {
    try {
      const norm = normalizeRawSteps(JSON.parse(stepsMatch[1]));
      if (norm.length) return norm;
    } catch {
      /* continue */
    }
  }

  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    try {
      const p = JSON.parse(cleaned.slice(objStart, objEnd + 1));
      if (Array.isArray(p?.steps)) return normalizeRawSteps(p.steps);
    } catch {
      /* continue */
    }
  }

  return null;
}

function buildExtractStepsPrompt(procedureText) {
  const raw = procedureText || "";
  const textPreview =
    Number.isFinite(MAX_PROMPT_CHARS) && raw.length > MAX_PROMPT_CHARS
      ? raw.slice(0, MAX_PROMPT_CHARS)
      : raw;

  return [
    "Anda adalah extractor SOP. Ambil langkah prosedur dari teks (termasuk hasil OCR jika ada).",
    "",
    "ATURAN (WAJIB):",
    "1) JANGAN parafrase, ringkas, atau terjemahkan — salin verbatim.",
    "2) Pertahankan angka, nama, dokumen, kondisi, istilah.",
    "3) Format: {\"steps\":[{\"step\":1,\"text\":\"...\"}]} saja.",
    "4) Tabel prosedur: satu nomor baris (1, 2, 3, …) = satu langkah lengkap. Jangan potong di tengah kalimat.",
    "5) Jangan gabungkan dua nomor baris berbeda dalam satu step.",
    "6) Abaikan header tabel (NO, PROSEDUR KERJA, ALUR KERJA) dan judul kolom tengah yang berulang.",
    "7) Teks satu paragraf rapi per langkah (tanpa enter berlebihan).",
    "",
    "Teks prosedur:",
    textPreview,
  ].join("\n");
}

/**
 * GPT detect SOP structure → steps JSON
 * @param {string} mergedFullText
 */
export async function detectSopStructureWithGpt(mergedFullText) {
  const procedureText = extractProcedureSection(mergedFullText);
  const prompt = buildExtractStepsPrompt(procedureText);
  const aiRes = await callOpenAIForExtractSteps(prompt, AI_INSTRUCTIONS);

  if (!aiRes.ok) {
    return {
      success: false,
      error: aiRes.error || `AI error ${aiRes.status}`,
      steps: [],
      model: aiRes.model,
      procedureChars: procedureText.length,
    };
  }

  const rawSteps = tryParseStepsPayload(aiRes.generated || "");
  const steps = normalizeExtractedSteps(rawSteps, mergedFullText);
  if (!steps?.length) {
    return {
      success: false,
      error: "GPT tidak mengembalikan struktur langkah JSON yang valid.",
      steps: [],
      model: aiRes.model || GPT54_MODEL,
      procedureChars: procedureText.length,
      generatedPreview: aiRes.generated?.slice(0, 500),
    };
  }

  return {
    success: true,
    steps,
    model: aiRes.model || GPT54_MODEL,
    procedureChars: procedureText.length,
  };
}
