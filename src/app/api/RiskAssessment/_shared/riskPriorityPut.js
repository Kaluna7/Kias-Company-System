import { deriveRiskPriorityScoreFromLevels } from "@/app/utils/riskPriorityScore";

/**
 * Set body.priority_level dari impact × probability (merge dengan baris DB untuk PATCH parsial).
 */
export function assignDerivedRiskPriorityToBody(body, existingRow) {
  if (!body || typeof body !== "object") return;
  const impact = "impact_level" in body ? body.impact_level : existingRow?.impact_level;
  const prob = "probability_level" in body ? body.probability_level : existingRow?.probability_level;
  body.priority_level = deriveRiskPriorityScoreFromLevels(impact, prob);
}
