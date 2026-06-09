import { readDocx, docxExists, readMeta } from "./documentStore";
import { writeReportState } from "./reportStateStore";
import {
  syncSystemBlocksInHub,
  isSystemModuleTableBlockId,
} from "./reportBlocks";
import {
  docxHasSystemTableMarkers,
  listSystemBlockIdsInDocx,
  reconcileBlockSyncWithDocx,
} from "./docx/docxBlockEngine";
import { createReportSession } from "./reportService";
import { buildPayloadFromPapers } from "./buildPayloadFromPapers";
import { mergeModuleTablesIntoHub } from "./reportPreviewHub";

/**
 * Jika manifest DB kosong tapi DOCX punya bookmark — seed dari file (tanpa reset manual).
 */
export function seedBlockSyncIfNeeded(existingState, docxBuffer, findingSections, auditVisibleByDept) {
  const manifest = (existingState.reportBlocks?.manifest || []).filter(
    isSystemModuleTableBlockId,
  );

  if (manifest.length > 0) {
    return syncSystemBlocksInHub(existingState, findingSections, auditVisibleByDept);
  }

  const inDocx = listSystemBlockIdsInDocx(docxBuffer);
  if (inDocx.length > 0) {
    const blocks = {};
    for (const id of inDocx) {
      blocks[id] = { id, kind: "system" };
    }
    const seeded = {
      ...existingState,
      reportBlocks: { manifest: inDocx, blocks },
    };
    return syncSystemBlocksInHub(seeded, findingSections, auditVisibleByDept);
  }

  return syncSystemBlocksInHub(existingState, findingSections, auditVisibleByDept);
}

/**
 * DOCX tanpa bookmark / template lama → rebuild otomatis (sama seperti reset+create, narasi DB tetap).
 */
export async function ensureDocxHasModuleBookmarks(year, sessionId, createdBy = {}, options = {}) {
  if (!(await docxExists(sessionId))) {
    return { ok: false, reason: "no-docx", migrated: false };
  }

  const buf = await readDocx(sessionId);
  const meta = (await readMeta(sessionId)) || {};
  const hasMarkers = docxHasSystemTableMarkers(buf);

  // Punya bookmark → jangan rebuild penuh (lock/unlock / save user tidak boleh hilang).
  if (hasMarkers) {
    return { ok: true, migrated: false, buf };
  }

  // Tanpa bookmark: rebuild penuh hanya saat Create Report eksplisit, bukan lock/unlock.
  if (options.allowFullRebuild !== true) {
    return { ok: true, migrated: false, buf, needsBookmarks: true };
  }

  const payload = await buildPayloadFromPapers(year);
  if (!payload) return { ok: false, reason: "no-payload", migrated: false };

  await createReportSession(payload, createdBy, {
    sessionId,
    regenerateDocx: true,
  });

  const nextBuf = await readDocx(sessionId);
  return { ok: true, migrated: true, buf: nextBuf, reason: "no-bookmarks" };
}

/**
 * Siapkan block diff lock/unlock: bootstrap bookmark + seed manifest + orphan reconcile.
 */
export async function prepareModuleBlockSync({
  year,
  sessionId,
  existing,
  findingSections,
  auditVisibleByDept,
  createdBy = {},
}) {
  let buf = null;
  let migrated = false;

  if (await docxExists(sessionId)) {
    const ensure = await ensureDocxHasModuleBookmarks(year, sessionId, createdBy);
    if (ensure.ok && ensure.buf) {
      buf = ensure.buf;
      migrated = ensure.migrated === true;
    } else {
      buf = await readDocx(sessionId);
    }
  }

  let blockSync = seedBlockSyncIfNeeded(
    existing,
    buf || Buffer.alloc(0),
    findingSections,
    auditVisibleByDept,
  );

  if (buf) {
    blockSync = reconcileBlockSyncWithDocx(buf, blockSync);
  }

  return { blockSync, migrated, buf };
}

/** Persist reportBlocks + hub setelah bootstrap. */
export async function persistBootstrappedHubState(
  year,
  existing,
  findingSections,
  auditVisibleByDept,
  blockSync,
  updatedBy = "bootstrap-sync",
) {
  const state = mergeModuleTablesIntoHub(existing, {
    findingSections,
    auditVisibleByDept,
    hiddenAuditFindingEdits: existing.hiddenAuditFindingEdits,
  });
  state.reportBlocks = blockSync.reportBlocks;
  state.userNotes = blockSync.userNotes;
  await writeReportState(year, state, updatedBy);
  return state;
}
