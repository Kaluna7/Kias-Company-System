/**
 * HTML preview hub — satu "repo" seperti GitHub untuk laporan tahunan.
 *
 * - Jalur narasi (`narrative`): Executive Summary, objectives, approach, conclusions,
 *   appendices — ditulis dari HTML preview atau OnlyOffice (Ctrl+S) → DB hub.
 * - Jalur tabel modul (`moduleTables`): baris SOP + Audit — dari API modul;
 *   lock/unlock audit hanya mengubah visibilitas di hub, tidak menghapus narasi.
 *
 * DOCX / OnlyOffice adalah view/export dari hub, bukan sumber yang menimpa narasi.
 */

import { pickNarrativeFromReportState } from "./reportStateNarrative";

export const HUB_SYNC_MODE_MODULE_TABLES_ONLY = "moduleTablesOnly";

export const HUB_CHANGE_SOURCE = {
  ONLYOFFICE: "onlyoffice",
  MODULE_TABLES: "module-tables",
  PREVIEW: "html-preview",
};

/** @param {number} revision */
export function hubNarrativeIsProtected(revision) {
  return Number(revision) > 0;
}

/** @param {object|null|undefined} state */
export function nextModuleTablesRevision(state) {
  return (Number(state?.moduleTablesRevision) || 0) + 1;
}

/** Satu counter untuk auto-refresh HTML preview (OnlyOffice + modul). */
export function getHubRevision(state) {
  if (!state || typeof state !== "object") return 0;
  const hub = Number(state.hubRevision);
  if (hub > 0) return hub;
  return Math.max(
    Number(state.onlyOfficeSyncRevision) || 0,
    Number(state.moduleTablesRevision) || 0,
  );
}

/** @param {object} state */
export function touchHubRevision(state) {
  const next = { ...state };
  next.hubRevision = getHubRevision(state) + 1;
  next.hubSyncedAt = new Date().toISOString();
  return next;
}

/**
 * Server: merge module-table lane into hub without touching OnlyOffice narrative.
 * @param {object} existing
 * @param {object} incoming — findingSections, hiddenAuditFindingEdits, auditVisibleByDept
 */
export function mergeModuleTablesIntoHub(existing, incoming) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const next = { ...base };

  if (Array.isArray(incoming.findingSections)) {
    next.findingSections = incoming.findingSections;
  }
  if (
    incoming.hiddenAuditFindingEdits &&
    typeof incoming.hiddenAuditFindingEdits === "object"
  ) {
    next.hiddenAuditFindingEdits = incoming.hiddenAuditFindingEdits;
  }
  if (incoming.auditVisibleByDept && typeof incoming.auditVisibleByDept === "object") {
    next.auditVisibleByDept = {
      ...(base.auditVisibleByDept || {}),
      ...incoming.auditVisibleByDept,
    };
  }

  next.moduleTablesRevision = nextModuleTablesRevision(base);
  next.moduleTablesSyncedAt = new Date().toISOString();

  return touchHubRevision(next);
}

/**
 * Client: should POST use moduleTablesOnly (narasi tetap di DB)?
 * @param {number} onlyOfficeSyncRevision
 * @param {{ narrativeFromPreviewEdit?: boolean }} [options]
 */
export function resolveHubPersistSyncMode(onlyOfficeSyncRevision, options = {}) {
  if (options.narrativeFromPreviewEdit === true) return undefined;
  return hubNarrativeIsProtected(onlyOfficeSyncRevision)
    ? HUB_SYNC_MODE_MODULE_TABLES_ONLY
    : undefined;
}

export { pickNarrativeFromReportState };
