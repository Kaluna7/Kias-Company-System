export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_API_KEY;
/** Fixed model for extract-steps only; do not use GOOGLE_AI_MODEL so other features keep their env model. */
const MODEL = "gemini-3-flash-preview";
const BASE_URL = process.env.GOOGLE_AI_BASEURL || "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:generateContent`;

async function callGemini(prompt) {
  try {
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const res = await fetch(GOOGLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": API_KEY },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = null;
    }
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.candidates?.[0]?.text || raw || "";
    return { ok: res.ok, status: res.status, rawResponse: raw, generated: candidate, data };
  } catch (err) {
    return { ok: false, status: 500, error: String(err) };
  }
}

function tryParseJsonArray(s) {
  if (!s || typeof s !== "string") return null;
  // Try to find JSON array in the response
  const fenced = s.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      const p = JSON.parse(fenced[1]);
      if (Array.isArray(p)) return p;
    } catch (e) {}
  }
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first >= 0 && last > first) {
    const candidate = s.slice(first, last + 1);
    try {
      const p = JSON.parse(candidate);
      if (Array.isArray(p)) return p;
    } catch (e) {}
  }
  try {
    const p = JSON.parse(s);
    if (Array.isArray(p)) return p;
  } catch (e) {}
  return null;
}

/**
 * PROMPT GEMINI UNTUK EXTRACT STEPS DARI PDF TEXT
 * 
 * Prompt ini akan dieksekusi setelah PDF reader membaca semua isi PDF.
 * Gemini akan mengambil hanya data SOP (langkah-langkah prosedur) dan mengurutkannya.
 * 
 * NOTE: JANGAN UBAH PROMPT INI - User sudah mengkonfirmasi prompt ini sudah benar.
 * Jika perlu mengubah prompt, tanyakan dulu ke user.
 */
function buildExtractStepsPrompt(fullText) {
  /**
   * Target: extract steps TANPA mengubah isi.
   * - Jangan ringkas / paraphrase / translate
   * - Jangan hilangkan detail (angka, nama, dokumen, kode form, threshold, tanggal, istilah)
   * - Output wajib JSON array saja
   */
  const textPreview = (fullText || "").slice(0, 120000); // enlarge context to reduce truncated procedure section

  return [
    "Anda adalah extractor SOP. Fokus Anda adalah mengambil langkah-langkah PROSEDUR dari teks dokumen.",
    "",
    "ATURAN PALING PENTING (WAJIB):",
    "1) JANGAN mengubah kata, jangan parafrase, jangan menerjemahkan, jangan memperpendek, jangan merangkum.",
    "2) Untuk setiap langkah prosedur, Anda harus menyalin isinya secara verbatim dari dokumen (copy persis).",
    "3) Jangan menghapus detail kecil: angka/nominal, nama departemen, jabatan, sistem, kode dokumen/form, kondisi/threshold, catatan di dalam langkah, tanda kurung, dan istilah khusus.",
    "4) Jangan menggabungkan dua langkah menjadi satu. Jika ada sub-langkah/bullet di dalam satu langkah, tetap masukkan sebagai bagian dari text langkah tersebut (boleh gunakan '\\n' untuk pemisah), tetapi jangan pindah ke langkah lain.",
    "",
    "CARA MENENTUKAN BAGIAN PROSEDUR:",
    "- Ambil langkah-langkah yang berada pada bagian 'Prosedur' / 'Procedure' / penomoran langkah kerja.",
    "- Abaikan bagian non-prosedur: tujuan, ruang lingkup, definisi, referensi, lampiran, daftar dokumen, revisi, tanda tangan (kecuali jika itu memang langkah prosedur).",
    "",
    "FORMAT OUTPUT (WAJIB):",
    "- Kembalikan HANYA JSON array. Tidak boleh ada teks tambahan, tidak boleh markdown/fence.",
    "- Setiap item: {\"step\": <angka berurutan mulai 1>, \"text\": \"<ISI LANGKAH VERBATIM>\"}",
    "- 'text' boleh multi-kalimat; jangan ringkas. Jika ada line break di dokumen, boleh dipertahankan sebagai \\n.",
    "- Jika tidak ada langkah prosedur ditemukan, kembalikan [].",
    "",
    "Teks dokumen:",
    textPreview,
    "",
    "Sekali lagi: keluarkan HANYA JSON array."
  ].join("\n");
}

export async function POST(req) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "Server missing GOOGLE_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { data: base64Data, text: fullText } = body;

    if (!fullText || typeof fullText !== "string") {
      return NextResponse.json({ 
        success: false, 
        error: "Missing or invalid 'text' field. PDF text extraction must be done first." 
      }, { status: 400 });
    }

    console.log("Extracting SOP steps from PDF text, length:", fullText.length);

    // Build prompt untuk extract steps
    const prompt = buildExtractStepsPrompt(fullText);
    
    // Call Gemini AI
    const aiRes = await callGemini(prompt);
    
    if (!aiRes.ok) {
      console.error("Gemini API error:", aiRes.status, aiRes.error);
      return NextResponse.json({ 
        success: false, 
        error: `AI API error: ${aiRes.status}`,
        diagnostic: { rawResponse: aiRes.rawResponse?.slice(0, 1000) }
      }, { status: 500 });
    }

    // Try to parse JSON array from response
    const parsed = tryParseJsonArray(aiRes.generated || aiRes.rawResponse || "");
    
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      // Normalize steps
      const steps = parsed.map((item, idx) => {
        const stepNum = typeof item.step === "number" ? item.step : (idx + 1);
        const stepText = item.text || item.instruction || item.content || (typeof item === "string" ? item : "") || "";
        return {
          step: stepNum,
          text: stepText.toString().trim(),
          instruction: stepText.toString().trim()
        };
      }).filter(s => s.text && s.text.length > 3);

      console.log(`Successfully extracted ${steps.length} steps from PDF`);
      
      return NextResponse.json({ 
        success: true, 
        steps,
        diagnostic: {
          rawTextPreview: fullText.slice(0, 500),
          generatedPreview: aiRes.generated?.slice(0, 1000),
          rawResponse: aiRes.rawResponse?.slice(0, 1000)
        }
      }, { status: 200 });
    } else {
      // Fallback: return empty steps with diagnostic info
      console.warn("Failed to parse steps from AI response, returning empty array");
      return NextResponse.json({ 
        success: false, 
        error: "AI tidak mengembalikan format yang valid",
        steps: [],
        diagnostic: {
          rawTextPreview: fullText.slice(0, 500),
          generated: aiRes.generated?.slice(0, 2000),
          rawResponse: aiRes.rawResponse?.slice(0, 2000)
        }
      }, { status: 200 });
    }
  } catch (err) {
    console.error("Error in extract-steps:", err);
    return NextResponse.json({ 
      success: false, 
      error: "Server error", 
      details: String(err) 
    }, { status: 500 });
  }
}

