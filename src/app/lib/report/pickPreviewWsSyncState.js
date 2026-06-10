/**
 * Subset of report state pushed over WebSocket for live HTML preview collaboration.
 * Shared by client (buildPreviewSyncPayload) and server (POST /api/report/state).
 */

/** @param {object|null|undefined} state */
export function pickPreviewWsSyncState(state) {
  if (!state || typeof state !== "object") return {};
  return {
    periodStart: String(state.periodStart ?? "").trim(),
    periodEnd: String(state.periodEnd ?? "").trim(),
    auditCoverage: String(state.auditCoverage ?? "").trim(),
    departmentCoverage: String(state.departmentCoverage ?? "").trim(),
    area: String(state.area ?? "").trim(),
    auditTeam: Array.isArray(state.auditTeam) ? state.auditTeam : [],
    preparedBy: Array.isArray(state.preparedBy) ? state.preparedBy : [],
    auditCommitteeName: String(state.auditCommitteeName ?? "").trim(),
    auditCommitteeDate: String(state.auditCommitteeDate ?? "").trim(),
    presidentDirectorName: String(state.presidentDirectorName ?? "").trim(),
    presidentDirectorDate: String(state.presidentDirectorDate ?? "").trim(),
    appendices: Array.isArray(state.appendices) ? state.appendices : [],
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
    findingSections: Array.isArray(state.findingSections) ? state.findingSections : [],
    hiddenAuditFindingEdits:
      state.hiddenAuditFindingEdits && typeof state.hiddenAuditFindingEdits === "object"
        ? state.hiddenAuditFindingEdits
        : {},
    previewSyncRevision: Number(state.previewSyncRevision) || 0,
  };
}

/** @param {object} state */
export function bumpPreviewSyncRevision(state) {
  const base = state && typeof state === "object" ? { ...state } : {};
  base.previewSyncRevision = (Number(base.previewSyncRevision) || 0) + 1;
  return base;
}
