import { readMeta, writeMeta, readDocx } from "./documentStore";
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
import { extractUserFreeTextFromFindingsHtml } from "./userFindingsFreeText";
import {
  mapExtractedDocxToPapers,
  mergeChangedPapers,
  legacyFieldsFromPapers,
  seedPapersFromLegacyState,
} from "./reportPapers";

/**
 * OnlyOffice save → deteksi paper mana yang berubah → simpan hanya paper itu.
 * Tabel Findings (modul) tidak ditimpa dari Word.
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
  /** Jangan strip auditRows ke DB saat OnlyOffice save — data modul tetap utuh. */
  const findingSections = existing.findingSections || [];

  const wordFindingsHtml = extracted.ok ? extracted.wordFindingsHtml : existing.wordFindingsHtml;
  const userFindingsFreeHtml = extractUserFreeTextFromFindingsHtml(wordFindingsHtml || "");

  const existingPapers = seedPapersFromLegacyState(existing);
  const incomingPapers = mapExtractedDocxToPapers(
    extracted.ok ? extracted : {},
    userFindingsFreeHtml,
  );
  const { papers, changedPaperIds } = mergeChangedPapers(existingPapers, incomingPapers);
  const legacyFromPapers = legacyFieldsFromPapers(papers, existing);

  const syncedAt = new Date().toISOString();
  const revision = Number(existing.onlyOfficeSyncRevision || 0) + 1;

  const nextState = pickReportStatePayload({
    ...existing,
    ...legacyFromPapers,
    appendices: existing.appendices,
    auditVisibleByDept: visibility,
    findingSections,
    hiddenAuditFindingEdits: existing.hiddenAuditFindingEdits,
    reportPapers: papers,
    onlyOfficeSyncedAt: syncedAt,
    onlyOfficeSyncRevision: revision,
    onlyOfficeSessionId: sessionId,
    userFindingsFreeHtml: legacyFromPapers.userFindingsFreeHtml || userFindingsFreeHtml || "",
    lastChangedPaperIds: changedPaperIds,
  });

  const hubState = touchHubRevision(nextState);
  await writeReportState(year, hubState, updatedBy);

  try {
    await savePreviewPayload(
      sessionId,
      {
        year,
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
      },
      { narrativeOnly: true },
    );
  } catch {
    /* ignore */
  }

  try {
    const sessionMeta = (await readMeta(sessionId)) || {};
    sessionMeta.onlyOfficeSyncRevision = revision;
    sessionMeta.previewSnapshotHash = computePreviewSnapshotHash(
      nextState.auditVisibleByDept,
      findingSections,
      {
        executiveSummaryHtml: nextState.executiveSummaryHtml,
        auditObjectivesScopeHtml: nextState.auditObjectivesScopeHtml,
        auditApproachMethodologyHtml: nextState.auditApproachMethodologyHtml,
        conclusionValues: nextState.conclusionValues,
      },
    );
    sessionMeta.updatedAt = syncedAt;
    await writeMeta(sessionId, sessionMeta);
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
    changedPaperIds,
  });

  return {
    ok: true,
    year,
    state: hubState,
    extracted: extracted.ok,
    revision,
    changedPaperIds,
  };
}
