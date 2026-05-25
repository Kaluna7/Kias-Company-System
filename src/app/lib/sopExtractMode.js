/**
 * Mode ekstraksi SOP:
 * - "vision" → PDF halaman → gambar → GPT Vision → JSON (tanpa pdf.js parser / OCR teks / GPT teks)
 * - "pipeline" (default) → parser + OCR + merge + GPT teks
 */
export function isVisionOnlyExtractMode() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_SOP_EXTRACT_MODE === "vision";
  }
  return process.env.SOP_EXTRACT_MODE === "vision";
}

export function getSopExtractModeLabel() {
  return isVisionOnlyExtractMode() ? "vision" : "pipeline";
}
