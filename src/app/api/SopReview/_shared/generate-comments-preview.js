import { NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyByg_otFYurK-Aw0KLtoknlw4x5usJDW10";
const MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";
const BASE_URL = process.env.GOOGLE_AI_BASEURL || "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_URL = `${BASE_URL}/models/${MODEL}:generateContent`;

async function callGemini(prompt) {
  const body = { contents: [{ parts: [{ text: prompt }] }] };
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
    "Anda adalah asisten profesional. Buat TEPAT SATU KALIMAT (1 sentence) sebagai komentar reviewer untuk langkah SOP di bawah.",
    "PERSYARATAN (WAJIB):",
    "1) KELUARKAN HANYA 1 KALIMAT. Jangan keluarkan teks lain.",
    "2) Jangan menyalin atau mengulang langsung frasa lengkap dari langkah. Tidak lebih dari 30% kata yang sama.",
    "3) Gunakan bahasa profesional dan ringkas (~8–20 kata).",
    "4) Komentar harus actionable: jelaskan apa yang harus dicek/konfirmasi reviewer.",
    "5) Jangan sertakan numbering, 'Comment:', atau JSON.",
    "",
    `Langkah: ${step}`,
    "",
    "KELUARKAN HANYA satu kalimat komentar sesuai aturan."
  ].join("\n");
}

function fallbackCommentForStep(step) {
  if (!step || typeof step !== "string") return "Periksa kelengkapan dokumen dan persetujuan sebelum memproses.";
  if (/tanda tangan|ttd|atasan/i.test(step)) return "Pastikan tanda tangan atasan dan tanggal persetujuan tercantum.";
  if (/input|sistem|payroll/i.test(step)) return "Verifikasi data dan otorisasi sebelum input ke sistem.";
  if (/formulir|form/i.test(step)) return "Periksa kelengkapan formulir dan lampiran sebelum pengajuan.";
  return "Periksa kelengkapan dokumen dan persetujuan sebelum memproses.";
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
      if (!comment || isEchoOfStep(comment, step, 0.35)) comment = fallbackCommentForStep(step);
      if (comment.length > 400) comment = comment.slice(0, 400).trim();
      comments.push({ id: it.id ?? null, sop_related: step, comment });
    }

    return NextResponse.json({ success: true, comments }, { status: 200 });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}


