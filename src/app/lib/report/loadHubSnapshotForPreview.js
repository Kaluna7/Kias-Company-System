import { readReportState } from "./reportStateStore";
import { loadFindingSectionsForPreviewServer } from "./loadFindingSectionsServer";
import {
  applyAuditVisibilityToSections,
  buildEffectivePublishMap,
  mergeModuleSectionsForHub,
  syncAuditVisibleFromLockedByDept,
} from "./previewAuditVisibility";
import { getHubRevision } from "./reportPreviewHub";
import { pickNarrativeFromReportState } from "./reportStateNarrative";
import { syncSystemBlocksInHub } from "./reportBlocks";

/**
 * Satu snapshot untuk HTML preview: narasi dari hub DB + tabel dari modul live.
 * @param {number} year
 * @param {string} [cookieHeader]
 */
export async function loadHubSnapshotForPreview(year, cookieHeader = "") {
  const existing = (await readReportState(year)) || {};
  const { sections: moduleSections, lockedByDept } = await loadFindingSectionsForPreviewServer(
    year,
    cookieHeader,
  );

  /** Module API + DB hub: jangan hilangkan auditRows yang sudah tersimpan. */
  const sections = mergeModuleSectionsForHub(
    existing.findingSections || [],
    moduleSections || [],
  );

  const auditVisibleByDept = syncAuditVisibleFromLockedByDept(
    lockedByDept,
    existing.auditVisibleByDept || {},
  );

  const effectivePublish = buildEffectivePublishMap(lockedByDept, auditVisibleByDept);
  const visibleSections = applyAuditVisibilityToSections(sections, effectivePublish);
  const narrative = pickNarrativeFromReportState(existing);
  const blockSync = syncSystemBlocksInHub(existing, visibleSections, auditVisibleByDept);

  return {
    year,
    hubRevision: getHubRevision(existing),
    onlyOfficeSyncRevision: Number(existing.onlyOfficeSyncRevision) || 0,
    moduleTablesRevision: Number(existing.moduleTablesRevision) || 0,
    narrative,
    state: existing,
    /** Data modul utuh — client filter tampilan lewat auditVisibleByDept. */
    sections,
    displaySections: visibleSections,
    lockedByDept,
    auditVisibleByDept,
    hiddenAuditFindingEdits:
      existing.hiddenAuditFindingEdits && typeof existing.hiddenAuditFindingEdits === "object"
        ? existing.hiddenAuditFindingEdits
        : {},
    reportBlocks: blockSync.reportBlocks,
    userNotes: blockSync.userNotes,
    deletedSystemBlockIds: blockSync.deletedSystemIds,
    changedSystemBlockIds: blockSync.changedSystemIds,
  };
}
