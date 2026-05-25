import { NextResponse } from "next/server";
import { callOpenAIForComments, hasOpenAIKey } from "@/app/lib/openaiChat";

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
  return m && m[1] ? m[1].trim() : firstLine;
}

function wordOverlapFraction(step, comment) {
  if (!step || !comment) return 0;
  const s = step
    .toLowerCase()
    .replace(/[^\p{L}\d\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const c = comment
    .toLowerCase()
    .replace(/[^\p{L}\d\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
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
 * Prompt untuk OpenAI — generate komentar reviewer per langkah SOP.
 * Dipanggil dari SOPHeader / Sidebar-Sop → generate-comments-preview API.
 */
function buildSinglePromptStrict(item) {
  const step = (item.sop_related || "").replace(/\n+/g, " ").trim().slice(0, 1400);
  return [
    "Anda adalah reviewer SOP yang membantu penulis SOP memperbaiki kalimat agar lebih jelas dan mudah dipahami.",
    "Tugas Anda adalah menulis komentar review yang berisi usulan revisi konkret, terdengar natural seperti ditulis manusia, profesional, dan tepat sasaran.",
    "PERSYARATAN (WAJIB):",
    "1) Gunakan bahasa yang sama dengan bahasa pada langkah SOP.",
    "2) Komentar harus terdengar seperti arahan revisi yang jelas dan substantif, bukan analisis abstrak.",
    "3) Jika langkah ambigu, langsung tuliskan isi perbaikan yang perlu dimasukkan ke SOP, misalnya definisi, kondisi if/when, decision rule, kriteria, pihak bertanggung jawab, dokumen/form, approval, batas waktu, output, atau exception handling.",
    "4) Jangan hanya menulis perintah pendek seperti 'Confirm...', 'Verify...', 'Define...', 'Clarify...', 'Specify...', atau 'Add...' tanpa isi detailnya.",
    "5) Jangan memakai pola jawaban yang kaku atau generik. Variasikan gaya kalimat secara natural seperti reviewer manusia.",
    "6) Komentar harus membantu user memahami bagaimana kalimat SOP seharusnya diperjelas.",
    "7) Utamakan bahasa yang mudah dimengerti oleh user bisnis.",
    "8) Komentar boleh menyarankan bentuk kalimat yang lebih jelas, tetapi tetap dalam format komentar reviewer singkat, bukan paragraf penjelasan panjang.",
    "9) Panjang komentar maksimal 2 kalimat.",
    "10) Bahasa harus profesional, jelas, spesifik, mudah dipahami, dan actionable.",
    "11) Jangan sertakan numbering, 'Comment:', atau JSON.",
    "12) Keluarkan HANYA isi komentar.",
    "",
    "Contoh gaya yang diinginkan:",
    'Langkah: "MIS Department will check the stock or repair the device."',
    'Komentar yang baik: "This step should explain that stock availability is checked only when replacement is required, while repair is carried out when the device can still be fixed."',
    "",
    `Langkah: ${step}`,
    "",
    "KELUARKAN HANYA komentar sesuai aturan.",
  ].join("\n");
}

const COMMENTS_SYSTEM =
  "You write SOP review comments using OpenAI. Output only the comment text, no JSON or labels.";

export async function POST(req) {
  try {
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { success: false, error: "Server missing OPENAI_API_KEY", provider: "openai" },
        { status: 500 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Provide items: [{id, sop_related}]" },
        { status: 400 },
      );
    }

    const comments = [];
    let modelUsed = null;
    for (const it of items) {
      const step = it.sop_related || "";
      const r = await callOpenAIForComments(buildSinglePromptStrict(it), {
        temperature: 0.2,
        system: COMMENTS_SYSTEM,
      });
      if (!r.ok) {
        return NextResponse.json(
          {
            success: false,
            error: r.error || "OpenAI gagal membuat komentar",
            provider: "openai",
            model: r.model,
            failedStep: step.slice(0, 120),
          },
          { status: r.status && r.status >= 400 ? r.status : 502 },
        );
      }
      modelUsed = r.model || modelUsed;
      let comment = normalizeGeneratedText(r.generated || r.rawResponse || "");
      if (isEchoOfStep(comment, step, 0.35)) comment = "";
      if (comment.length > 400) comment = comment.slice(0, 400).trim();
      comments.push({ id: it.id ?? null, sop_related: step, comment });
    }

    return NextResponse.json(
      { success: true, comments, provider: "openai", model: modelUsed },
      { status: 200 },
    );
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { success: false, error: "Server error", details: String(err), provider: "openai" },
      { status: 500 },
    );
  }
}
