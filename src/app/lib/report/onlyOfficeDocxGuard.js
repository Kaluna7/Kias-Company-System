import { readMeta, writeMeta, docxExists } from "./documentStore";
import { readReportState } from "./reportStateStore";
import { computeModuleTablesHash } from "./moduleTablesHash";
import { computePreviewSnapshotHash } from "./previewAuditVisibility";
import { enrichRegeneratePayloadWithOnlyOffice } from "./enrichRegeneratePayload";

export function sharedReportSessionId(year) {
  return `shared-report-${Number(year)}`;
}

/** Narrative saved via OnlyOffice (Ctrl+S) — stored in consolidated_report_state. */
export async function getOnlyOfficeNarrativeRevision(year) {
  const saved = (await readReportState(year)) || {};
  return Number(saved.onlyOfficeSyncRevision) || 0;
}

/**
 * Rebuild DOCX from latest DB report state (module tables + visibility).
 * Narrative paragraphs come from DB / OnlyOffice sync; audit tables follow lock/unlock.
 */
export async function buildModuleSyncRegeneratePayload(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  const saved = (await readReportState(y)) || {};
  const findingSections = Array.isArray(saved.findingSections) ? saved.findingSections : [];

  const base = {
    year: y,
    source: "html-preview",
    auditVisibleByDept: saved.auditVisibleByDept || {},
    executiveSummaryHtml: saved.executiveSummaryHtml || "",
    auditObjectivesScopeHtml: saved.auditObjectivesScopeHtml || "",
    auditApproachMethodologyHtml: saved.auditApproachMethodologyHtml || "",
    conclusionValues: saved.conclusionValues || {},
    appendices: saved.appendices || [],
    findingSections,
    moduleTablesHash: computeModuleTablesHash(findingSections),
    previewSnapshotHash: computePreviewSnapshotHash(
      saved.auditVisibleByDept || {},
      findingSections,
      {
        executiveSummaryHtml: saved.executiveSummaryHtml,
        auditObjectivesScopeHtml: saved.auditObjectivesScopeHtml,
        auditApproachMethodologyHtml: saved.auditApproachMethodologyHtml,
        conclusionValues: saved.conclusionValues || {},
      },
    ),
    onlyOfficeSyncRevision: Number(saved.onlyOfficeSyncRevision) || 0,
    onlyOfficeSyncedAt: saved.onlyOfficeSyncedAt ?? null,
    onlyOfficeSessionId: saved.onlyOfficeSessionId ?? null,
  };

  return enrichRegeneratePayloadWithOnlyOffice(y, base);
}

export async function updateSharedSessionMetaFromReportState(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  const sessionId = sharedReportSessionId(y);
  if (!(await docxExists(sessionId))) return null;

  const saved = (await readReportState(y)) || {};
  const findingSections = Array.isArray(saved.findingSections) ? saved.findingSections : [];
  const existing = (await readMeta(sessionId)) || { sessionId };

  const moduleTablesHash = computeModuleTablesHash(findingSections);
  const previewSnapshotHash = computePreviewSnapshotHash(
    saved.auditVisibleByDept || {},
    findingSections,
    {
      executiveSummaryHtml: saved.executiveSummaryHtml,
      auditObjectivesScopeHtml: saved.auditObjectivesScopeHtml,
      auditApproachMethodologyHtml: saved.auditApproachMethodologyHtml,
      conclusionValues: saved.conclusionValues || {},
    },
  );

  const next = {
    ...existing,
    sessionId,
    year: y,
    moduleTablesHash,
    previewSnapshotHash,
    onlyOfficeSyncRevision: Math.max(
      Number(existing.onlyOfficeSyncRevision) || 0,
      Number(saved.onlyOfficeSyncRevision) || 0,
    ),
    updatedAt: new Date().toISOString(),
  };

  await writeMeta(sessionId, next);
  return next;
}
