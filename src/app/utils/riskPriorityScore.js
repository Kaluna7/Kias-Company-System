/**
 * Skor prioritas = Impact × Probability (contoh: 10 × 10 = 100).
 */
export function deriveRiskPriorityScoreFromLevels(impactLevel, probabilityLevel) {
  const i = parseRiskLevelInt(impactLevel);
  const p = parseRiskLevelInt(probabilityLevel);
  if (i === null || p === null) return null;
  return i * p;
}

function parseRiskLevelInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? Math.trunc(v) : parseInt(String(v).trim(), 10);
  if (Number.isNaN(n)) return null;
  return n;
}

/** Warna sel: ≥90 merah, 60–89 kuning, &lt;60 hijau */
export function priorityHeatTailwindClass(score) {
  if (score === null || score === undefined) return "";
  const s = Number(score);
  if (Number.isNaN(s)) return "";
  if (s >= 90) return "bg-red-100 text-red-800 font-semibold";
  if (s >= 60) return "bg-yellow-100 text-yellow-800 font-semibold";
  return "bg-green-100 text-green-800 font-semibold";
}
