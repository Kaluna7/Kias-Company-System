import { readReportState } from "./reportStateStore";
import { loadFindingSectionsForPreviewServer } from "./loadFindingSectionsServer";
import {
  applyAuditVisibilityToSections,
  buildEffectivePublishMap,
} from "./previewAuditVisibility";
import { getHubRevision } from "./reportPreviewHub";
import { pickNarrativeFromReportState } from "./reportStateNarrative";

/**
 * Satu snapshot untuk HTML preview: narasi dari hub DB + tabel dari modul live.
 * @param {number} year
 * @param {string} [cookieHeader]
 */
export async function loadHubSnapshotForPreview(year, cookieHeader = "") {
  const existing = (await readReportState(year)) || {};
  const { sections, lockedByDept } = await loadFindingSectionsForPreviewServer(
    year,
    cookieHeader,
  );

  const auditVisibleByDept =
    existing.auditVisibleByDept && typeof existing.auditVisibleByDept === "object"
      ? existing.auditVisibleByDept
      : {};

  const effectivePublish = buildEffectivePublishMap(lockedByDept, auditVisibleByDept);
  const visibleSections = applyAuditVisibilityToSections(sections, effectivePublish);
  const narrative = pickNarrativeFromReportState(existing);

  return {
    year,
    hubRevision: getHubRevision(existing),
    onlyOfficeSyncRevision: Number(existing.onlyOfficeSyncRevision) || 0,
    moduleTablesRevision: Number(existing.moduleTablesRevision) || 0,
    narrative,
    state: existing,
    sections: visibleSections,
    lockedByDept,
    auditVisibleByDept,
    hiddenAuditFindingEdits:
      existing.hiddenAuditFindingEdits && typeof existing.hiddenAuditFindingEdits === "object"
        ? existing.hiddenAuditFindingEdits
        : {},
  };
}
