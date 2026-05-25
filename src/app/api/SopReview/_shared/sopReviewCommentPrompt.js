/**
 * Prompt standar Review Comment — gaya internal audit profesional, ringkas, jelas.
 */

export const SOP_REVIEW_COMMENT_SYSTEM =
  "You are a senior internal auditor reviewing Standard Operating Procedures (SOP). " +
  "Write concise, professional review comments. Output only the comment text—no labels, numbering, or JSON.";

export const SOP_REVIEW_COMMENT_RULES = [
  "Peran: auditor internal / reviewer SOP senior — nada profesional, konstruktif, netral, dan spesifik.",
  "Bahasa: SAMA dengan bahasa pada SOP Description (Indonesia → Indonesia; English → English).",
  "Panjang: 1 kalimat utama; maksimal 2 kalimat pendek. Total kira-kira 20–45 kata (jangan panjang/lebih dari 320 karakter).",
  "Gaya: jelas, langsung, mudah dibaca auditee; hindari jargon berlebihan dan kalimat bertele-tele.",
  "Isi: sebutkan GAP atau perbaikan konkret (siapa, kapan, bukti, persetujuan, kriteria, pengecualian, eskalasi) — bukan sekadar 'perlu diperjelas' tanpa substansi.",
  "Dilarang: pola kaku 'Define.../Verify.../Clarify.../Specify.../Add...' tanpa detail; daftar panjang; paragraf; analisis umum tanpa arahan revisi.",
  "Dilarang: menyalin ulang kalimat SOP; komentar untuk lebih dari satu langkah.",
  "Keluarkan HANYA teks komentar review.",
].join("\n");

const EXAMPLES = `
Contoh BAIK (internal audit, ringkas):
- SOP EN: "MIS will check stock or repair the device."
  Comment: "Specify when repair applies versus stock check, who decides, and what evidence is retained."
- SOP ID: "Atasan menyetujui pengajuan cuti."
  Comment: "Tambahkan batas waktu persetujuan, pejabat pengganti saat cuti, dan bukti persetujuan yang diarsipkan."

Contoh BURUK (terlalu panjang / generik / kaku):
- "Please review and improve this step to ensure compliance with best practices."
- "Define criteria for approval."
- "Langkah ini kurang jelas dan perlu diperbaiki secara menyeluruh agar sesuai dengan kebijakan perusahaan dan standar audit yang berlaku di seluruh unit kerja."
`.trim();

/**
 * @param {string} sopDescription
 */
export function buildSingleReviewCommentPrompt(sopDescription) {
  const step = String(sopDescription || "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 1400);
  return [
    SOP_REVIEW_COMMENT_RULES,
    "",
    EXAMPLES,
    "",
    "SOP Description (satu langkah):",
    step,
    "",
    "Review Comment:",
  ].join("\n");
}

export function buildBatchReviewCommentIntro() {
  return [
    "Task: Untuk setiap SOP Description di bawah, buat satu review comment (gaya internal audit profesional).",
    "Output: HANYA JSON array: [{\"id\": <id or null>, \"comment\": \"<teks>\"}].",
    SOP_REVIEW_COMMENT_RULES,
    "",
    EXAMPLES,
    "",
    "Daftar (id | SOP Description):",
  ].join("\n");
}
