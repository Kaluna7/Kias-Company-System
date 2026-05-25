export function mapAiStepsToPreview(aiSteps, sanitizeStepText) {
  if (!Array.isArray(aiSteps)) return [];
  return aiSteps
    .map((s, idx) => {
      const raw = (s.text || s.instruction || (typeof s === "string" ? s : "") || "").toString();
      const clean = sanitizeStepText(raw);
      return {
        no: typeof s.step === "number" ? s.step : idx + 1,
        sop_related: clean,
        status: "IN REVIEW",
        comment: (s.comment || s.reviewer_comment || "").toString().trim(),
        reviewer: "",
      };
    })
    .filter((it) => it.sop_related && it.sop_related.length >= 2);
}

export function formatAiExtractDebug(aiRes) {
  const parts = [];
  if (aiRes?.error) parts.push(String(aiRes.error));
  const d = aiRes?.debug;
  if (d) {
    const meta = [d.api, d.model, d.procedureChars != null ? `prosedur ${d.procedureChars} char` : null]
      .filter(Boolean)
      .join(" · ");
    if (meta) parts.push(`(${meta})`);
    if (d.primaryError) parts.push(String(d.primaryError));
  }
  return parts.filter(Boolean).join(" ");
}
