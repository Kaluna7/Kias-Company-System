// app/api/ai/extract-steps/route.js
import { NextResponse } from "next/server";

/**
 * Server-side proxy to Google Generative API.
 * Expects JSON body: { text: "procText..." , maxSteps?: number }
 *
 * MUST set env var: GOOGLE_API_KEY
 *
 * NOTE: adjust MODEL and URL if Google API version in your account differs.
 */

const API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyCt45GfaaJzw_r33Nc_PGIDn_KcmO4wVIU";
if (!API_KEY) {
  console.warn("No GOOGLE_API_KEY configured for /api/ai/extract-steps");
}

// Model and base URL — adjust if your Google product docs differ.
// Commonly: generativelanguage.googleapis.com v1beta2 or v1
const MODEL = "models/text-bison-001"; // or the model name you chose in AI Studio
const GOOGLE_URL = `https://generativelanguage.googleapis.com/v1beta2/${MODEL}:generateText?key=${API_KEY}`;

// Build prompt for the model
function buildPrompt(procText, maxSteps = 200) {
  return `
You are a helpful assistant specialized in extracting procedural steps from Indonesian-language SOP documents.
Input text (may have line breaks or corrupted spacing) is below between DELIM markers.
Your task:
1) Extract the PROCEDURE steps only (ignore headers like Tujuan, Ruang Lingkup, Definisi, Catatan, Revisi).
2) Output a JSON array only (no extra commentary) of objects with keys:
   - "step": integer (1..N in order)
   - "text": the cleaned Indonesian sentence for that step (no leading numbers, trimmed).
3) Preserve the original order. Merge fragments belonging to the same step.
4) Remove bullets, stray punctuation artifacts such as ") .", " . ", duplicated spaces.
5) If there are numbered substeps (e.g. 1.1) include them as separate items but keep numbering order.
6) Output at most ${maxSteps} steps.

Input:
DELIM
${procText}
DELIM

Return only a JSON array, for example:
[
  {"step":1,"text":"Karyawan mengisi Formulir Lembur (F - FIN - 01) secara lengkap."},
  {"step":2,"text":"Formulir ditandatangani oleh Atasan Langsung (Preparer)."},
  {"step":3,"text":"Formulir dikirim ke HRD (Reviewer) untuk proses verifikasi dan persetujuan."}
]
`;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const procText = body?.text || "";
    const maxSteps = body?.maxSteps || 200;

    if (!procText || procText.trim().length < 20) {
      return NextResponse.json({ success: false, error: "No text provided or text too short." }, { status: 400 });
    }

    const prompt = buildPrompt(procText, maxSteps);

    // Request body for Google Generative models differs by API version.
    // Here we use a common pattern for generativelanguage generateText.
    const payload = {
      prompt: {
        text: prompt
      },
      temperature: 0.0,
      candidateCount: 1
    };

    const res = await fetch(GOOGLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    // NOTE: shape of response depends on API version.
    // Try to extract text from a few possible fields.
    let generatedText = "";
    if (data && data.candidates && data.candidates.length > 0) {
      generatedText = data.candidates[0].content || data.candidates[0].output || "";
    } else if (data && data.output && Array.isArray(data.output)) {
      // some versions return output array
      const first = data.output.find(o => o.type === "text");
      generatedText = first ? first.text : (data.output[0].content || "");
    } else if (typeof data?.text === "string") {
      generatedText = data.text;
    } else if (typeof data?.outputText === "string") {
      generatedText = data.outputText;
    } else {
      // fallback: attempt raw stringify
      generatedText = JSON.stringify(data);
    }

    // Attempt to parse JSON array out of generatedText
    let steps = [];
    try {
      // locate first '['
      const start = generatedText.indexOf("[");
      const end = generatedText.lastIndexOf("]");
      if (start >= 0 && end > start) {
        const jsonStr = generatedText.slice(start, end + 1);
        steps = JSON.parse(jsonStr);
      } else {
        // try parse whole text
        steps = JSON.parse(generatedText);
      }
    } catch (e) {
      // last resort: try to extract lines like "1. ...", convert them to array
      const lines = (generatedText || "").split(/\n+/).map(l => l.trim()).filter(Boolean);
      for (const ln of lines) {
        const m = ln.match(/^\d+\s*[\.\)\-:]\s*(.+)/);
        if (m) steps.push({ text: m[1].trim() });
      }
    }

    // Normalize output to canonical shape
    const normalized = (Array.isArray(steps) ? steps : []).map((it, idx) => {
      const textVal = (it?.text || it?.step_text || it?.description || it?.instruction || (typeof it === "string" ? it : "")).toString().trim();
      return { step: (it?.step && Number.isFinite(+it.step)) ? +it.step : idx + 1, text: textVal.replace(/\s+/g, " ").replace(/\)\s*\.\s*/g, "). ") };
    });

    return NextResponse.json({ success: true, raw: data, steps: normalized });
  } catch (err) {
    console.error("AI extract error:", err);
    return NextResponse.json({ success: false, error: "Server error calling AI." }, { status: 500 });
  }
}
