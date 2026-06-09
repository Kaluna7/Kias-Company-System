import { resolveConclusionPagesFromPayload } from "./conclusionSegments";
import { resolveAppendixPagesFromPayload } from "./appendixPages";
import { computePreviewSnapshotHash } from "./previewAuditVisibility";
import { readPreviewPayload } from "./previewPayloadStore";
import { sharedReportSessionId } from "./onlyOfficeDocxGuard";
import { filterPreviewPayloadForDocx } from "./filterPreviewPayloadForDocx";

/**
 * OnlyOffice DOCX payload — HTML Preview ONLY (live export or saved .preview.json).
 * Does NOT read consolidated_report_state or module APIs.
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

  /** Live export = exact preview state. Do not merge stale findingPages from saved snapshot. */
  const raw = hasLiveExport
    ? { ...overlay, year: y }
    : Object.keys(saved).length > 0
      ? { ...saved, year: y }
      : null;

  if (!raw) return null;

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
