/**
 * Mode ekstraksi SOP:
 * - "vision" (default) → PDF halaman → gambar → GPT Vision → JSON
 * - "pipeline" → parser + OCR + merge + GPT teks (set SOP_EXTRACT_MODE=pipeline untuk aktifkan)
 */
function getSopExtractModeEnv() {
  const raw =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SOP_EXTRACT_MODE
      : process.env.SOP_EXTRACT_MODE;
  return String(raw || "vision")
    .trim()
    .toLowerCase();
}

export function isVisionOnlyExtractMode() {
  return getSopExtractModeEnv() !== "pipeline";
}

export function getSopExtractModeLabel() {
  return getSopExtractModeEnv() === "pipeline" ? "pipeline" : "vision";
}
