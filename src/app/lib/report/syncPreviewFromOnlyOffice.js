import { readMeta, readDocx, writeMeta } from "./documentStore";
import { readReportState, writeReportState, pickReportStatePayload } from "./reportStateStore";
import { readPreviewPayload, savePreviewPayload } from "./previewPayloadStore";
import { computePreviewSnapshotHash } from "./previewAuditVisibility";
import {
  applyAuditVisibilityToSections,
  buildEffectivePublishMap,
} from "./previewAuditVisibility";
import { extractPreviewStateFromDocx } from "./docx/docxToPreviewState";
import { broadcastReportStateChange } from "./reportStateHub";
import { touchHubRevision } from "./reportPreviewHub";

function mergeHtmlField(fromWord, existing) {
  const word = String(fromWord ?? "").trim();
  if (!word) return existing ?? "";
  return word;
}

/**
 * After OnlyOffice save (Ctrl+S / status 6 / close status 2):
 * DOCX → narrative HTML fields → consolidated_report_state → broadcast to HTML preview.
 * Table rows (SOP/Audit) stay from modules; only narrative sections are taken from Word.
 */
export async function syncReportStateFromOnlyOfficeSession(sessionId, updatedBy = "onlyoffice") {
  const meta = await readMeta(sessionId);
  if (!meta?.year) return { ok: false, reason: "no-meta" };

  const year = Number(meta.year);
  const previewPayload = await readPreviewPayload(sessionId);
  const existing = (await readReportState(year)) || {};

  let docxBuffer;
  try {
    docxBuffer = await readDocx(sessionId);
  } catch {
    return { ok: false, reason: "no-docx" };
  }

  const extracted = await extractPreviewStateFromDocx(docxBuffer, {
    findingSections: existing.findingSections,
    conclusionValues: existing.conclusionValues,
  });

  const visibility = existing.auditVisibleByDept || previewPayload?.auditVisibleByDept || {};

  const baseSections = existing.findingSections || [];
  const apiPublish = {};
  for (const section of baseSections) {
    apiPublish[section.deptKey] = section.isPublishedToReport === true;
  }
  const effectivePublish = buildEffectivePublishMap(apiPublish, visibility);
  const findingSections = applyAuditVisibilityToSections(baseSections, effectivePublish);

  const syncedAt = new Date().toISOString();
  const revision = Number(existing.onlyOfficeSyncRevision || 0) + 1;

  const nextState = pickReportStatePayload({
    ...existing,
    appendices: existing.appendices,
    executiveSummaryHtml: extracted.ok
      ? mergeHtmlField(extracted.executiveSummaryHtml, existing.executiveSummaryHtml)
      : existing.executiveSummaryHtml,
    auditObjectivesScopeHtml: extracted.ok
      ? mergeHtmlField(extracted.auditObjectivesScopeHtml, existing.auditObjectivesScopeHtml)
      : existing.auditObjectivesScopeHtml,
    auditApproachMethodologyHtml: extracted.ok
      ? mergeHtmlField(extracted.auditApproachMethodologyHtml, existing.auditApproachMethodologyHtml)
      : existing.auditApproachMethodologyHtml,
    conclusionValues: extracted.ok
      ? { ...(existing.conclusionValues || {}), ...extracted.conclusionValues }
      : existing.conclusionValues,
    auditVisibleByDept: visibility,
    findingSections,
    hiddenAuditFindingEdits: existing.hiddenAuditFindingEdits,
    onlyOfficeSyncedAt: syncedAt,
    onlyOfficeSyncRevision: revision,
    onlyOfficeSessionId: sessionId,
    wordFindingsHtml: extracted.ok ? extracted.wordFindingsHtml : existing.wordFindingsHtml,
    wordAppendicesHtml: extracted.ok ? extracted.wordAppendicesHtml : existing.wordAppendicesHtml,
  });

  const hubState = touchHubRevision(nextState);
  await writeReportState(year, hubState, updatedBy);

  try {
    await savePreviewPayload(sessionId, {
      year,
      source: "html-preview",
      previewSnapshotHash: computePreviewSnapshotHash(
        nextState.auditVisibleByDept,
        findingSections,
        {
          executiveSummaryHtml: nextState.executiveSummaryHtml,
          auditObjectivesScopeHtml: nextState.auditObjectivesScopeHtml,
          auditApproachMethodologyHtml: nextState.auditApproachMethodologyHtml,
          conclusionValues: nextState.conclusionValues,
        },
      ),
      auditVisibleByDept: nextState.auditVisibleByDept,
      executiveSummaryHtml: nextState.executiveSummaryHtml,
      auditObjectivesScopeHtml: nextState.auditObjectivesScopeHtml,
      auditApproachMethodologyHtml: nextState.auditApproachMethodologyHtml,
      conclusionValues: nextState.conclusionValues,
      appendices: nextState.appendices,
      findingSections,
    });
  } catch {
    /* ignore */
  }

  try {
    const meta = (await readMeta(sessionId)) || {};
    meta.onlyOfficeSyncRevision = revision;
    meta.previewSnapshotHash = computePreviewSnapshotHash(
      nextState.auditVisibleByDept,
      findingSections,
      {
        executiveSummaryHtml: nextState.executiveSummaryHtml,
        auditObjectivesScopeHtml: nextState.auditObjectivesScopeHtml,
        auditApproachMethodologyHtml: nextState.auditApproachMethodologyHtml,
        conclusionValues: nextState.conclusionValues,
      },
    );
    meta.updatedAt = syncedAt;
    await writeMeta(sessionId, meta);
  } catch {
    /* ignore */
  }

  broadcastReportStateChange({
    year,
    revision,
    hubRevision: hubState.hubRevision,
    moduleTablesRevision: Number(hubState.moduleTablesRevision) || 0,
    sessionId,
    source: updatedBy,
  });

  return { ok: true, year, state: hubState, extracted: extracted.ok, revision };
}
