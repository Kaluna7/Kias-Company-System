/**
 * Prompt standar Review Comment — gaya internal audit profesional, natural, mudah dibaca.
 */

export const SOP_REVIEW_COMMENT_SYSTEM =
  "You are a senior internal auditor reviewing Standard Operating Procedures (SOP). " +
  "Write review comments the way an experienced auditor would speak to a colleague: clear, constructive, specific, and human—not robotic templates. " +
  "Output only the comment text—no labels, numbering, or JSON.";

export const SOP_REVIEW_COMMENT_RULES = [
  "Peran: reviewer SOP / auditor internal senior — nada profesional, konstruktif, sopan, dan spesifik.",
  "Bahasa: SAMA dengan bahasa pada SOP Description (Indonesia → Indonesia; English → English).",
  "Panjang: 1–2 kalimat pendek. Total kira-kira 25–50 kata (maks. 320 karakter).",
  "Gaya: seperti manusia yang menulis memo review—langsung ke poin, mudah dipahami auditee, tidak kaku atau seperti template AI.",
  "Isi: sebutkan gap atau saran perbaikan konkret (PIC, tenggat, kriteria, bukti arsip, persetujuan, pengecualian/eskalasi) yang relevan dengan langkah tersebut.",
  "Variasi kalimat: jangan selalu memakai pembuka yang sama. Rotasi gaya, misalnya:",
  "  • menyatakan apa yang belum dijelaskan SOP,",
  "  • menyoroti risiko jika langkah tidak diperjelas,",
  "  • menyarankan penambahan elemen kontrol,",
  "  • menanyakan implisit siapa/kapan/bukti apa yang kurang.",
  "Dilarang memulai komentar dengan pola berulang: 'Cantumkan', 'Tetapkan', 'Tentukan', 'Define', 'Specify', 'Clarify', 'Add' — kecuali benar-benar paling natural (maks. 1 dari sekumpulan batch).",
  "Dilarang: daftar panjang; paragraf; menyalin ulang kalimat SOP; komentar generik ('perlu diperjelas' tanpa substansi); jargon berlebihan.",
  "Keluarkan HANYA teks komentar review.",
].join("\n");

const EXAMPLES = `
Contoh BAIK (natural, bervariasi, spesifik):

SOP: "HRD memastikan adanya permintaan tenaga kerja yang disetujui General Manager."
Comment: "Belum dijelaskan kapan HRD boleh memproses lowongan setelah persetujuan GM, serta bukti verifikasi formulir yang wajib diarsipkan."

SOP: "HRD mulai menyebarkan iklan lowongan di sosial media."
Comment: "Perlu ditambahkan siapa yang menyetujui konten iklan, media yang dipakai, dan bukti tayang untuk keperluan audit trail."

SOP: "CV terpilih akan diatur jadwal interview oleh HRD."
Comment: "SOP belum menyebut batas waktu penjadwalan sejak CV dinyatakan lolos, PIC penghubung kandidat, dan bukti konfirmasi kehadiran yang disimpan."

SOP: "Interview dilakukan dalam 1 hari oleh HRD dan Department Head."
Comment: "Urutan wawancara, koordinator jadwal, dan tindakan jika salah satu pewawancara tidak tersedia perlu diperjelas agar proses konsisten."

SOP EN: "MIS will check stock or repair the device."
Comment: "The SOP should clarify when repair applies versus a stock check, who authorizes it, and what records are kept."

Contoh BURUK (kaku, repetitif, generik):
- "Cantumkan bahwa HRD wajib memverifikasi formulir..."
- "Tetapkan siapa yang berwenang menyetujui..."
- "Tentukan batas waktu HRD mengompilasi lamaran..."
- "Please review and improve this step."
- "Langkah ini kurang jelas dan perlu diperbaiki secara menyeluruh."
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
    "Task: Untuk setiap SOP Description di bawah, buat satu review comment (gaya auditor internal yang natural dan profesional).",
    "Penting: variaikan cara pembukaan dan struktur kalimat antar item—jangan gunakan kata pembuka yang sama berulang (mis. jangan semua diawali Cantumkan/Tetapkan/Tentukan).",
    "Output: HANYA JSON array: [{\"id\": <id or null>, \"comment\": \"<teks>\"}].",
    SOP_REVIEW_COMMENT_RULES,
    "",
    EXAMPLES,
    "",
    "Daftar (id | SOP Description):",
  ].join("\n");
}
