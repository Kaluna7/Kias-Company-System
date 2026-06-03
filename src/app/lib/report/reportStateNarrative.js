/**
 * HTML preview hub: narrative fields owned by OnlyOffice / preview edits;
 * finding table rows owned by modules (SOP Review, Audit Review).
 */

/** Fields synced from OnlyOffice save → DB → HTML preview (not overwritten by module table reload). */
export const REPORT_NARRATIVE_FIELD_KEYS = [
  "appendices",
  "executiveSummaryHtml",
  "auditObjectivesScopeHtml",
  "auditApproachMethodologyHtml",
  "conclusionValues",
  "auditVisibleByDept",
  "onlyOfficeSyncedAt",
  "onlyOfficeSyncRevision",
  "onlyOfficeSessionId",
  "wordFindingsHtml",
  "wordAppendicesHtml",
  "moduleTablesRevision",
  "moduleTablesSyncedAt",
];

/**
 * @param {object|null|undefined} state
 * @returns {object|null}
 */
export function pickNarrativeFromReportState(state) {
  if (!state || typeof state !== "object") return null;
  return {
    appendices: state.appendices ?? null,
    executiveSummaryHtml: state.executiveSummaryHtml ?? "",
    auditObjectivesScopeHtml: state.auditObjectivesScopeHtml ?? "",
    auditApproachMethodologyHtml: state.auditApproachMethodologyHtml ?? "",
    conclusionValues:
      state.conclusionValues && typeof state.conclusionValues === "object"
        ? state.conclusionValues
        : {},
    auditVisibleByDept:
      state.auditVisibleByDept && typeof state.auditVisibleByDept === "object"
        ? state.auditVisibleByDept
        : {},
    onlyOfficeSyncedAt: state.onlyOfficeSyncedAt ?? null,
    onlyOfficeSyncRevision: Number(state.onlyOfficeSyncRevision) || 0,
    onlyOfficeSessionId: state.onlyOfficeSessionId ?? null,
    wordFindingsHtml: state.wordFindingsHtml ?? "",
    wordAppendicesHtml: state.wordAppendicesHtml ?? "",
    moduleTablesRevision: Number(state.moduleTablesRevision) || 0,
    moduleTablesSyncedAt: state.moduleTablesSyncedAt ?? null,
  };
}
