import { pickNarrativeFromReportState } from "./reportStateNarrative";
import { touchHubRevision } from "./reportPreviewHub";
import { bumpPreviewSyncRevision } from "./pickPreviewWsSyncState";
import { syncSystemBlocksInHub } from "./reportBlocks";
import {
  applyAuditVisibilityToSections,
  buildEffectivePublishMap,
  mergeModuleSectionsForHub,
} from "./previewAuditVisibility";

function narrativeHasContent(value, key) {
  if (key === "conclusionValues") {
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some((v) => String(v ?? "").trim().length > 0);
  }
  if (key === "appendices") {
    return Array.isArray(value) && value.length > 0;
  }
  return String(value ?? "").trim().length > 0;
}

const NARRATIVE_KEYS = [
  "appendices",
  "executiveSummaryHtml",
  "auditObjectivesScopeHtml",
  "auditApproachMethodologyHtml",
  "conclusionValues",
  "wordFindingsHtml",
  "wordAppendicesHtml",
];

/**
 * Server-side: module table refresh must not reset OnlyOffice narrative in DB.
 * Narrative updates only when onlyOfficeSyncRevision increases (OnlyOffice save).
 */
export function mergeReportStateForPersist(existing, incoming, options = {}) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const next = { ...base, ...incoming };

  const existingRev = Number(existing?.onlyOfficeSyncRevision) || 0;
  const incomingRev = Number(incoming?.onlyOfficeSyncRevision) || 0;
  const onlyOfficeSave = incomingRev > existingRev;
  const allowNarrativeOverwrite = options.allowNarrativeOverwrite === true;

  next.onlyOfficeSyncRevision = Math.max(existingRev, incomingRev);

  if (allowNarrativeOverwrite) {
    for (const key of NARRATIVE_KEYS) {
      if (key === "appendices" && Array.isArray(incoming.appendices)) {
        next.appendices = incoming.appendices;
        continue;
      }
      if (narrativeHasContent(incoming[key], key)) {
        next[key] = incoming[key];
      }
    }
  } else if (existingRev > 0 && !onlyOfficeSave) {
    for (const key of NARRATIVE_KEYS) {
      if (narrativeHasContent(existing[key], key)) {
        next[key] = existing[key];
      }
    }
    next.onlyOfficeSyncedAt = existing.onlyOfficeSyncedAt ?? next.onlyOfficeSyncedAt;
    next.onlyOfficeSessionId = existing.onlyOfficeSessionId ?? next.onlyOfficeSessionId;
  } else {
    for (const key of NARRATIVE_KEYS) {
      if (narrativeHasContent(incoming[key], key)) {
        next[key] = incoming[key];
      } else if (narrativeHasContent(existing[key], key)) {
        next[key] = existing[key];
      }
    }
  }

  if (Array.isArray(incoming.findingSections)) {
    next.findingSections = mergeModuleSectionsForHub(
      existing?.findingSections || [],
      incoming.findingSections,
    );
    const lockedByDept = {};
    for (const section of next.findingSections) {
      lockedByDept[section.deptKey] = section.isPublishedToReport === true;
    }
    const effectivePublish = buildEffectivePublishMap(
      lockedByDept,
      next.auditVisibleByDept || {},
    );
    const visibleForBlocks = applyAuditVisibilityToSections(
      next.findingSections,
      effectivePublish,
    );
    const blockSync = syncSystemBlocksInHub(
      existing,
      visibleForBlocks,
      next.auditVisibleByDept || {},
    );
    next.reportBlocks = blockSync.reportBlocks;
    next.userNotes = blockSync.userNotes;
  }
  if (incoming.hiddenAuditFindingEdits && typeof incoming.hiddenAuditFindingEdits === "object") {
    next.hiddenAuditFindingEdits = incoming.hiddenAuditFindingEdits;
  }
  if (incoming.auditVisibleByDept && typeof incoming.auditVisibleByDept === "object") {
    next.auditVisibleByDept = {
      ...(existing?.auditVisibleByDept || {}),
      ...incoming.auditVisibleByDept,
    };
  }

  return touchHubRevision(bumpPreviewSyncRevision(next));
}

/**
 * Client: module-table persist keeps OnlyOffice narrative from DB.
 */
export function buildPersistPayloadWithProtectedNarrative({
  dbState,
  tablesPayload,
  onlyOfficeSyncRevision = 0,
}) {
  const dbNarrative = pickNarrativeFromReportState(dbState);
  const useDbNarrative = onlyOfficeSyncRevision > 0 && dbNarrative;

  if (!useDbNarrative) {
    return tablesPayload;
  }

  return {
    ...tablesPayload,
    appendices: dbNarrative.appendices ?? tablesPayload.appendices,
    executiveSummaryHtml:
      dbNarrative.executiveSummaryHtml ?? tablesPayload.executiveSummaryHtml,
    auditObjectivesScopeHtml:
      dbNarrative.auditObjectivesScopeHtml ?? tablesPayload.auditObjectivesScopeHtml,
    auditApproachMethodologyHtml:
      dbNarrative.auditApproachMethodologyHtml ?? tablesPayload.auditApproachMethodologyHtml,
    conclusionValues:
      Object.keys(dbNarrative.conclusionValues || {}).length > 0
        ? dbNarrative.conclusionValues
        : tablesPayload.conclusionValues,
    onlyOfficeSyncedAt: dbNarrative.onlyOfficeSyncedAt ?? tablesPayload.onlyOfficeSyncedAt,
    onlyOfficeSyncRevision: Math.max(
      onlyOfficeSyncRevision,
      dbNarrative.onlyOfficeSyncRevision,
    ),
    onlyOfficeSessionId: dbNarrative.onlyOfficeSessionId ?? tablesPayload.onlyOfficeSessionId,
    wordFindingsHtml: dbNarrative.wordFindingsHtml ?? tablesPayload.wordFindingsHtml,
    wordAppendicesHtml: dbNarrative.wordAppendicesHtml ?? tablesPayload.wordAppendicesHtml,
  };
}
