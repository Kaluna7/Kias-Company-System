/**
 * Parse executive-summary (and similar) list fields from DB TEXT / JSON.
 * Handles arrays, JSON strings, double-encoded JSON, and plain text.
 */
export function parseStoredJsonList(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "");
  }

  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(current)) {
      return current.filter((item) => item != null && item !== "");
    }
    if (typeof current !== "string") break;
    const trimmed = current.trim();
    if (!trimmed) return [];
    try {
      current = JSON.parse(trimmed);
    } catch {
      if (trimmed.includes(",")) {
        return trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [trimmed];
    }
  }

  return [];
}

export function isAuditReviewLocked(row) {
  if (!row) return false;
  const locked = row.is_locked;
  if (locked === false || locked === "f" || locked === "false" || locked === 0) return false;
  return locked === true || locked === "t" || locked === "true" || locked === 1;
}

export function executiveSummaryRowHasContent(row) {
  if (!row) return false;
  const fields = [
    row.objective_of_audit,
    row.scope_areas_covered,
    row.scope_methodology,
    row.limitations_scope,
    row.limitations_time,
    row.limitations_resource,
    row.internal_audit_team,
  ];
  return fields.some((f) => parseStoredJsonList(f).length > 0);
}

export function buildDeptExecutiveSummaryFromRow(row) {
  if (!row || !isAuditReviewLocked(row)) return null;
  const summary = {
    objectiveOfAudit: parseStoredJsonList(row.objective_of_audit),
    scopeAreasCovered: parseStoredJsonList(row.scope_areas_covered),
    scopeMethodology: parseStoredJsonList(row.scope_methodology),
    limitationsScope: parseStoredJsonList(row.limitations_scope),
    limitationsTime: parseStoredJsonList(row.limitations_time),
    limitationsResource: parseStoredJsonList(row.limitations_resource),
    internalAuditTeam: parseStoredJsonList(row.internal_audit_team),
  };
  const hasContent = Object.values(summary).some((list) => list.length > 0);
  return hasContent ? summary : null;
}
