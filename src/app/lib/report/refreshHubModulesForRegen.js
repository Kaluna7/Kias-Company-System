import { readReportState } from "./reportStateStore";
import { loadFindingSectionsForPreviewServer } from "./loadFindingSectionsServer";
import {
  applyAuditVisibilityToSections,
  buildEffectivePublishMap,
  syncAuditVisibleFromLockedByDept,
} from "./previewAuditVisibility";
import { getHubRevision, HUB_CHANGE_SOURCE } from "./reportPreviewHub";
import { broadcastReportStateChange } from "./reportStateHub";
import { sharedReportSessionId } from "./onlyOfficeDocxGuard";
import {
  prepareModuleBlockSync,
  persistBootstrappedHubState,
} from "./bootstrapModuleSync";

/**
 * Pull latest SOP/Audit rows + lock state from module APIs, merge into hub DB,
 * and return block diff for DOCX patch (vs. stale consolidated_report_state).
 */
export async function refreshHubModulesForRegen(year, cookieHeader = "", updatedBy = "regen-sync") {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { ok: false, error: "Invalid year" };
  }

  const existing = (await readReportState(y)) || {};
  const { sections, lockedByDept } = await loadFindingSectionsForPreviewServer(y, cookieHeader);

  if (!Array.isArray(sections) || !sections.length) {
    return { ok: false, error: "No module data for this year", saved: existing };
  }

  const auditVisibleByDept = syncAuditVisibleFromLockedByDept(
    lockedByDept,
    existing.auditVisibleByDept || {},
  );
  const effectivePublish = buildEffectivePublishMap(lockedByDept, auditVisibleByDept);
  /** Render-only — manifest block SYSTEM mengikuti visibility. */
  const visibleSections = applyAuditVisibilityToSections(sections, effectivePublish);

  const sessionId = sharedReportSessionId(y);
  const { blockSync, migrated } = await prepareModuleBlockSync({
    year: y,
    sessionId,
    existing,
    findingSections: visibleSections,
    auditVisibleByDept,
    createdBy: { email: updatedBy, name: updatedBy },
  });

  /** DB menyimpan data modul utuh; unlock tidak menghapus auditRows. */
  const state = await persistBootstrappedHubState(
    y,
    existing,
    sections,
    auditVisibleByDept,
    blockSync,
    updatedBy,
  );

  broadcastReportStateChange({
    year: y,
    revision: Number(state.onlyOfficeSyncRevision) || 0,
    hubRevision: getHubRevision(state),
    moduleTablesRevision: state.moduleTablesRevision,
    source: HUB_CHANGE_SOURCE.MODULE_TABLES,
  });

  return {
    ok: true,
    saved: state,
    findingSections: sections,
    displayFindingSections: visibleSections,
    lockedByDept,
    blockSync,
    bootstrapped: migrated === true,
  };
}
