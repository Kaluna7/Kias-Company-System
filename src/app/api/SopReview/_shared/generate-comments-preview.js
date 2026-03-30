import { NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.GOOGLE_AI_MODEL;
const BASE_URL = process.env.GOOGLE_AI_BASEURL;
const GEN_PATH = process.env.GOOGLE_AI_GENPATH;
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:${GEN_PATH}`;

async function callGemini(prompt) {
  const body = { contents: [{ parts: [{ text: prompt }] }], temperature: 0.0 };
  try {
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

function normalizeGeneratedText(s) {
  if (!s || typeof s !== "string") return "";
  let t = s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*["']?/, "")
    .replace(/["']?\s*$/, "")
    .replace(/\|/g, " ")
    .replace(/[\{\}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const firstLine = t.split(/\r?\n/)[0].trim();
  const m = firstLine.match(/^(.+?[.!?])(\s|$)/);
  return (m && m[1]) ? m[1].trim() : firstLine;
}

function wordOverlapFraction(step, comment) {
  if (!step || !comment) return 0;
  const s = step.toLowerCase().replace(/[^\p{L}\d\s]/gu, " ").split(/\s+/).filter(Boolean);
  const c = comment.toLowerCase().replace(/[^\p{L}\d\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (s.length === 0 || c.length === 0) return 0;
  const setC = new Set(c);
  let common = 0;
  for (const w of s) if (setC.has(w)) common++;
  return common / Math.max(1, s.length);
}

function isEchoOfStep(comment, step, threshold = 0.35) {
  return wordOverlapFraction(step, comment) > threshold;
}

/**
 * PROMPT GEMINI UNTUK GENERATE REVIEW COMMENTS
 * 
 * Fungsi ini membuat prompt yang dikirim ke Gemini AI untuk generate komentar reviewer
 * untuk setiap langkah SOP. Prompt ini memastikan output adalah 1 kalimat profesional
 * yang actionable untuk reviewer.
 * 
 * Lokasi file: src/app/api/SopReview/_shared/generate-comments-preview.js
 * Dipanggil dari: SOPHeader.js -> openAppendModal() -> callGenerateCommentsPreview()
 * 
 * Flow:
 * 1. User upload PDF -> parsing selesai -> tombol "Append" muncul
 * 2. User klik "Append" -> openAppendModal() dipanggil
 * 3. Modal terbuka dengan loading state
 * 4. callGenerateCommentsPreview() mengirim request ke API endpoint
 * 5. API endpoint memanggil fungsi ini untuk setiap item SOP
 * 6. Gemini generate komentar untuk setiap item
 * 7. Modal menampilkan hasil dengan komentar yang bisa di-edit
 * 8. User bisa edit komentar sebelum klik "Save & Append"
 */
function buildSinglePromptStrict(item) {
  const step = (item.sop_related || "").replace(/\n+/g, " ").trim().slice(0, 1400);
  return [
    "Anda adalah reviewer SOP yang membantu penulis SOP memperbaiki kalimat agar lebih jelas dan mudah dipahami.",
    "Tugas Anda adalah menulis komentar review yang berisi usulan revisi konkret, bukan sekadar menyebut apa yang kurang.",
    "PERSYARATAN (WAJIB):",
    "1) Gunakan bahasa yang sama dengan bahasa pada langkah SOP.",
    "2) Komentar harus terdengar seperti arahan revisi yang jelas dan substantif, bukan analisis abstrak.",
    "3) Jika langkah ambigu, langsung tuliskan isi perbaikan yang perlu dimasukkan ke SOP, misalnya definisi, kondisi if/when, decision rule, kriteria, pihak bertanggung jawab, dokumen/form, approval, batas waktu, output, atau exception handling.",
    "4) Jangan hanya menulis perintah seperti 'Define...', 'Clarify...', 'Specify...', atau 'Add...' tanpa isi detailnya.",
    "5) Komentar harus membantu user memahami bagaimana kalimat SOP seharusnya diperjelas.",
    "6) Utamakan bahasa yang mudah dimengerti oleh user bisnis.",
    "7) Komentar boleh menyarankan bentuk kalimat yang lebih jelas, tetapi tetap dalam format komentar reviewer singkat, bukan paragraf penjelasan panjang.",
    "8) Panjang komentar maksimal 2 kalimat.",
    "9) Bahasa harus profesional, jelas, spesifik, mudah dipahami, dan actionable.",
    "10) Jangan sertakan numbering, 'Comment:', atau JSON.",
    "11) Keluarkan HANYA isi komentar.",
    "",
    "Contoh gaya yang diinginkan:",
    'Langkah: "MIS Department will check the stock or repair the device."',
    'Komentar yang baik: "State that stock availability should be checked only if replacement is required, while repair should be performed if the device can still be fixed."',
    'Komentar yang juga baik: "Revise this step so that the device is first assessed; if replacement is needed, stock availability should be checked, otherwise the device should be repaired."',
    'Komentar yang buruk: "Specify the conditions dictating either inventory assessment or equipment servicing."',
    "",
    'Langkah: "If goods are damaged due to user negligence with an asset age requirement of less than 5 years, the user must pay 50% of the total repair costs."',
    'Komentar yang baik: "Define user negligence as misuse, improper handling, or failure to follow usage procedures, and state that asset age is calculated from the purchase date. Keep the 50% repair cost responsibility only when both conditions are met."',
    'Komentar yang buruk: "Define criteria for user negligence, asset age calculation, and the resulting payment structure."',
    "",
    `Langkah: ${step}`,
    "",
    "KELUARKAN HANYA komentar sesuai aturan."
  ].join("\n");
}

export async function POST(req) {
  try {
    if (!API_KEY) return NextResponse.json({ success: false, error: "Server missing GOOGLE_API_KEY" }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0) return NextResponse.json({ success: false, error: "Provide items: [{id, sop_related}]" }, { status: 400 });

    const comments = [];
    for (const it of items) {
      const step = it.sop_related || "";
      let comment = "";
      const r = await callGemini(buildSinglePromptStrict(it));
      comment = normalizeGeneratedText(r.generated || r.rawResponse || "");
      if (isEchoOfStep(comment, step, 0.35)) comment = "";
      if (comment.length > 400) comment = comment.slice(0, 400).trim();
      comments.push({ id: it.id ?? null, sop_related: step, comment });
    }

    return NextResponse.json({ success: true, comments }, { status: 200 });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}


