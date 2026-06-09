/**
 * Opsi 3 — Merge worker: patch SYSTEM sections only in the last OnlyOffice DOCX.
 *
 * Arsitektur:
 *   Module → HTML Preview (hub DB)
 *   OnlyOffice DOCX terakhir (user edits) → merge worker → replace SYSTEM blocks → bump key → refresh editor
 *
 * Marker format (sudah di templateBuilder):
 *   KIASBLOCK_START_kias_sys_finding_finance_audit … KIASBLOCK_END_…
 *   + bookmark Word: kias_sys_finding_finance_audit
 *
 * Tidak generate DOCX penuh. Tidak menyentuh teks di luar marker SYSTEM.
 */

import {
  readDocx,
  saveDocx,
  docxExists,
  readMeta,
  writeMeta,
  bumpDocumentKeyAfterServerPatch,
} from "./documentStore";
import { buildReportDocxBuffer } from "./reportService";
import { buildModuleSyncRegeneratePayload } from "./onlyOfficeDocxGuard";
import { buildPayloadFromPapers } from "./buildPayloadFromPapers";
import { enrichRegeneratePayloadWithOnlyOffice } from "./enrichRegeneratePayload";
import { computeModuleTablesHash } from "./moduleTablesHash";
import { computePreviewSnapshotHash } from "./previewAuditVisibility";
import { isSystemModuleTableBlockId } from "./reportBlocks";
import { readDocxFileAudit, logDocxFileAudit } from "./docxFileAudit";
import {
  deleteDocxBlocks,
  docxHasSystemTableMarkers,
  docxHasBlockBookmark,
  insertSystemBlockFromSource,
  listSystemBlockIdsInDocx,
  collectUserTextOutsideSystemBlocks,
  verifyUserTextPreserved,
  readDocumentXml,
  sortSystemBlocksForInsert,
} from "./docx/docxBlockEngine";

export const MERGE_JOB_SOURCE = {
  VISIBILITY: "visibility-lock-unlock",
  MODULE_TABLES: "module-tables",
  MANUAL: "manual",
};

/**
 * Diff untuk lock/unlock (visibility saja).
 */
export function resolveVisibilityBlockDiff(blockSync = {}) {
  const deleted = blockSync.deletedSystemIds || [];
  const added = blockSync.addedSystemIds || [];
  const updated = blockSync.updatedSystemIds || [];
  const toInsert = [...new Set([...added, ...updated])];
  return { toDelete: deleted, toInsert };
}

/**
 * Diff untuk perubahan data modul (SOP/audit) + orphan reconcile.
 */
export function resolveModuleBlockDiff(docxBuffer, blockSync = {}) {
  const inDocx = listSystemBlockIdsInDocx(docxBuffer);
  const inDocxSet = new Set(inDocx);
  const nextManifest = blockSync.reportBlocks?.manifest || [];
  const nextSet = new Set(nextManifest.filter(isSystemModuleTableBlockId));

  const toDelete = [
    ...new Set([
      ...(blockSync.deletedSystemIds || []),
      ...inDocx.filter((id) => !nextSet.has(id)),
    ]),
  ];

  const missingInDocx = [...nextSet].filter((id) => !inDocxSet.has(id));
  const toInsert = sortSystemBlocksForInsert([
    ...new Set([
      ...(blockSync.addedSystemIds || []),
      ...(blockSync.updatedSystemIds || []),
      ...missingInDocx,
    ]),
  ]);

  return { toDelete, toInsert, inDocx, manifestBlocks: [...nextSet], missingInDocx };
}

async function buildSourceDocxBuffer(year, payloadMode = "papers") {
  let payload =
    payloadMode === "module-sync"
      ? await buildModuleSyncRegeneratePayload(year)
      : await buildPayloadFromPapers(year);
  if (!payload) return null;
  payload = await enrichRegeneratePayloadWithOnlyOffice(year, payload);
  return buildReportDocxBuffer(payload);
}

/**
 * Core merge: baca DOCX user → patch SYSTEM blocks → simpan → bump OnlyOffice key.
 *
 * @param {object} params
 * @param {number} params.year
 * @param {string} params.sessionId
 * @param {string[]} params.toDelete
 * @param {string[]} params.toInsert
 * @param {object} [params.saved] — hub state untuk hash meta
 * @param {string} [params.source] — MERGE_JOB_SOURCE
 * @param {boolean} [params.requireMarkers=true]
 * @param {boolean} [params.skipUnsafeWithoutMarkers=false] — module sync: skip vs error
 * @param {object} [params.fileBefore] — audit log
 * @param {string} [params.payloadMode] — "papers" | "module-sync"
 */
export async function mergeSystemSectionsInDocx({
  year,
  sessionId,
  toDelete = [],
  toInsert = [],
  saved = {},
  source = MERGE_JOB_SOURCE.MANUAL,
  requireMarkers = true,
  skipUnsafeWithoutMarkers = false,
  fileBefore = null,
  payloadMode = "papers",
}) {
  if (!(await docxExists(sessionId))) {
    return { ok: false, error: "no-docx", mergeSource: source };
  }

  const auditBefore = fileBefore || (await readDocxFileAudit(sessionId));
  logDocxFileAudit(`merge-input:${source}`, auditBefore);

  if (!toDelete.length && !toInsert.length) {
    const meta = await readMeta(sessionId);
    return {
      ok: true,
      noop: true,
      patched: false,
      mergeSource: source,
      sessionId,
      year,
      moduleTablesHash: meta?.moduleTablesHash,
      previewSnapshotHash: meta?.previewSnapshotHash,
    };
  }

  const originalBuf = await readDocx(sessionId);
  const { xml: beforeXml } = readDocumentXml(originalBuf);
  const userFingerprints = collectUserTextOutsideSystemBlocks(beforeXml);

  let buf = originalBuf;

  if (requireMarkers && (toDelete.length || toInsert.length) && !docxHasSystemTableMarkers(buf)) {
    if (skipUnsafeWithoutMarkers) {
      return {
        ok: true,
        noop: true,
        patched: false,
        skippedUnsafePatch: true,
        patchMode: "skipped-no-markers",
        mergeSource: source,
        reason:
          "DOCX belum punya marker KIASBLOCK. Buat ulang laporan sekali (Create Report), lalu lock/unlock akan patch SYSTEM saja.",
      };
    }
    return {
      ok: false,
      needsInitialBuild: true,
      error:
        "DOCX tidak punya bookmark tabel modul. Buat ulang laporan dari Report preview (Create Report).",
      tablesNotInserted: true,
      mergeSource: source,
    };
  }

  if (toDelete.length) {
    buf = deleteDocxBlocks(buf, toDelete);
    const stillPresent = toDelete.filter((id) => docxHasBlockBookmark(buf, id));
    if (stillPresent.length) {
      console.warn("[reportMergeWorker] blocks not removed:", stillPresent);
      return {
        ok: false,
        error:
          "Tabel SYSTEM tidak bisa dihapus dari Word (bookmark hilang). Buat ulang laporan dari Report preview.",
        blocksNotRemoved: stillPresent,
        mergeSource: source,
      };
    }
  }

  if (toInsert.length) {
    const sourceBuf = await buildSourceDocxBuffer(year, payloadMode);
    if (!sourceBuf) {
      return { ok: false, error: "no-payload", mergeSource: source };
    }
    for (const blockId of toInsert) {
      buf = insertSystemBlockFromSource(buf, sourceBuf, blockId);
    }
  }

  const { xml: afterXml } = readDocumentXml(buf);
  if (!verifyUserTextPreserved(beforeXml || "", afterXml || "", userFingerprints)) {
    const lost = userFingerprints.filter((fp) => beforeXml?.includes(fp) && !afterXml?.includes(fp));
    console.error("[reportMergeWorker] user text lost:", lost.slice(0, 5));
    return {
      ok: false,
      error:
        "Merge dibatalkan: teks OnlyOffice Anda akan hilang. Ctrl+S di editor lalu coba lagi.",
      contentPreservationFailed: true,
      lostSnippets: lost.slice(0, 3),
      mergeSource: source,
    };
  }

  await saveDocx(sessionId, buf);
  const bumped = await bumpDocumentKeyAfterServerPatch(sessionId);

  const findingSections = Array.isArray(saved.findingSections) ? saved.findingSections : [];
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

  const meta = (await readMeta(sessionId)) || { sessionId };
  await writeMeta(sessionId, {
    ...meta,
    moduleTablesHash,
    previewSnapshotHash,
    lastMergeSource: source,
    lastMergeAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const fileAfter = await readDocxFileAudit(sessionId);
  logDocxFileAudit(`merge-output:${source}`, fileAfter);

  return {
    ok: true,
    patched: true,
    regenerated: false,
    patchMode: "marker-selective",
    mergeSource: source,
    sessionId,
    year,
    selectiveDelete: toDelete.length > 0 && toInsert.length === 0,
    selectiveInsert: toInsert.length > 0,
    deletedBlocks: toDelete,
    insertedBlocks: toInsert,
    moduleTablesHash,
    previewSnapshotHash,
    saveCount: Number(bumped?.saveCount) || 0,
    md5Before: auditBefore.md5,
    md5After: fileAfter.md5,
  };
}

/**
 * Orkestrasi lengkap: flush OnlyOffice opsional dilakukan caller.
 */
export async function runReportMergeJob({
  year,
  sessionId,
  blockSync,
  saved,
  source = MERGE_JOB_SOURCE.MANUAL,
  docxBuffer = null,
  payloadMode = "papers",
  skipUnsafeWithoutMarkers = false,
  fileBefore = null,
}) {
  const buf = docxBuffer || (await docxExists(sessionId) ? await readDocx(sessionId) : null);
  const isVisibility = source === MERGE_JOB_SOURCE.VISIBILITY;
  const { toDelete, toInsert, ...extra } = isVisibility
    ? resolveVisibilityBlockDiff(blockSync)
    : resolveModuleBlockDiff(buf, blockSync);

  const result = await mergeSystemSectionsInDocx({
    year,
    sessionId,
    toDelete,
    toInsert,
    saved,
    source,
    payloadMode: isVisibility ? "module-sync" : payloadMode,
    skipUnsafeWithoutMarkers,
    fileBefore,
  });

  return { ...result, ...extra };
}
