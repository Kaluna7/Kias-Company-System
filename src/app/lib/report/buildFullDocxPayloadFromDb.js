import { resolveConclusionPagesFromPayload } from "./conclusionSegments";
import { resolveAppendixPagesFromPayload } from "./appendixPages";
import { computePreviewSnapshotHash } from "./previewAuditVisibility";
import { readPreviewPayload } from "./previewPayloadStore";
import { sharedReportSessionId } from "./onlyOfficeDocxGuard";
import { filterPreviewPayloadForDocx } from "./filterPreviewPayloadForDocx";
import { readReportFindingsByDept } from "./reportFindingsStore";
import { deptFindingNarrativesList } from "./reportFindingsUtils";
import { readReportState, pickReportStatePayload } from "./reportStateStore";

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

/** Live HTML export wins; DB fills any field missing from the client overlay. */
function mergePreviewOverlayWithDbState(overlay, dbRaw) {
  const db = pickReportStatePayload(dbRaw || {});
  const merged = { ...db, ...overlay };

  for (const key of [
    "executiveSummaryHtml",
    "auditObjectivesScopeHtml",
    "auditApproachMethodologyHtml",
    "auditCommitteeName",
    "auditCommitteeDate",
    "presidentDirectorName",
    "presidentDirectorDate",
    "periodStart",
    "periodEnd",
    "auditCoverage",
    "departmentCoverage",
    "area",
  ]) {
    if (!hasText(overlay[key]) && hasText(db[key])) {
      merged[key] = db[key];
    }
  }

  if (!Array.isArray(overlay.auditTeam) || overlay.auditTeam.length === 0) {
    merged.auditTeam = Array.isArray(db.auditTeam) ? db.auditTeam : [];
  }
  if (!Array.isArray(overlay.preparedBy) || overlay.preparedBy.length === 0) {
    merged.preparedBy = Array.isArray(db.preparedBy) ? db.preparedBy : [];
  }
  if (!Array.isArray(overlay.appendices) || overlay.appendices.length === 0) {
    merged.appendices = Array.isArray(db.appendices) ? db.appendices : overlay.appendices;
  }

  merged.conclusionValues = {
    ...(db.conclusionValues && typeof db.conclusionValues === "object" ? db.conclusionValues : {}),
    ...(overlay.conclusionValues && typeof overlay.conclusionValues === "object"
      ? overlay.conclusionValues
      : {}),
  };
  merged.auditVisibleByDept = {
    ...(db.auditVisibleByDept && typeof db.auditVisibleByDept === "object"
      ? db.auditVisibleByDept
      : {}),
    ...(overlay.auditVisibleByDept && typeof overlay.auditVisibleByDept === "object"
      ? overlay.auditVisibleByDept
      : {}),
  };

  if (!Array.isArray(overlay.findingSections) || overlay.findingSections.length === 0) {
    merged.findingSections = Array.isArray(db.findingSections) ? db.findingSections : [];
  }
  if (!Array.isArray(overlay.findingDetailPages) || overlay.findingDetailPages.length === 0) {
    merged.findingDetailPages = Array.isArray(overlay.findingDetailPages)
      ? overlay.findingDetailPages
      : [];
  }

  return merged;
}

/**
 * OnlyOffice DOCX payload — HTML Preview live export + DB fallback for missing fields.
 *
 * @param {number} year
 * @param {object} [clientOverlay] From buildReportExportPayload() on the preview page
 */
export async function buildDocxPayloadFromHtmlPreview(year, clientOverlay = {}) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  const sessionId = sharedReportSessionId(y);
  const saved = (await readPreviewPayload(sessionId)) || {};
  const overlay = clientOverlay && typeof clientOverlay === "object" ? clientOverlay : {};

  const hasLiveExport =
    overlay.source === "html-preview" ||
    Boolean(overlay.previewSnapshotHash) ||
    (Array.isArray(overlay.findingPages) && overlay.findingPages.length > 0);

  const dbState = await readReportState(y);

  /** Live export = exact preview state. Do not merge stale findingPages from saved snapshot. */
  const rawBase = hasLiveExport
    ? { ...overlay, year: y }
    : Object.keys(saved).length > 0
      ? { ...saved, year: y }
      : null;

  if (!rawBase) return null;

  const raw = hasLiveExport
    ? mergePreviewOverlayWithDbState(rawBase, dbState)
    : { ...rawBase, year: y };

  const payload = filterPreviewPayloadForDocx(raw);

  const hasFindings =
    (Array.isArray(payload.findingPages) && payload.findingPages.length > 0) ||
    (Array.isArray(payload.findingSections) && payload.findingSections.length > 0);

  if (!hasFindings) return null;

  payload.year = y;
  payload.source = "html-preview";
  payload._narrativeSource = "html-preview";

  payload.conclusionPages = resolveConclusionPagesFromPayload(payload);
  payload.appendixPages = resolveAppendixPagesFromPayload(payload);

  const findingsByDept = await readReportFindingsByDept(y);
  const narrativesFromDb = deptFindingNarrativesList(findingsByDept, payload.findingSections || []);
  if (narrativesFromDb.length > 0) {
    payload.deptFindingNarratives = narrativesFromDb;
  } else if (!Array.isArray(payload.deptFindingNarratives)) {
    payload.deptFindingNarratives = [];
  }

  payload.previewSnapshotHash = computePreviewSnapshotHash(
    payload.auditVisibleByDept || {},
    payload.findingSections || [],
    {
      executiveSummaryHtml: payload.executiveSummaryHtml,
      auditObjectivesScopeHtml: payload.auditObjectivesScopeHtml,
      auditApproachMethodologyHtml: payload.auditApproachMethodologyHtml,
      conclusionValues: payload.conclusionValues || {},
      auditTeam: payload.auditTeam,
      preparedBy: payload.preparedBy,
      auditCommitteeName: payload.auditCommitteeName,
      auditCommitteeDate: payload.auditCommitteeDate,
      presidentDirectorName: payload.presidentDirectorName,
      presidentDirectorDate: payload.presidentDirectorDate,
      appendices: payload.appendices,
    },
  );

  return payload;
}

/** @deprecated Use buildDocxPayloadFromHtmlPreview — kept for existing imports. */
export const buildFullDocxPayloadFromDb = buildDocxPayloadFromHtmlPreview;
