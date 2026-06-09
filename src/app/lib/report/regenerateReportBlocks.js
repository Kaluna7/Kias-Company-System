import { readDocx, saveDocx, docxExists } from "./documentStore";
import { readReportState } from "./reportStateStore";
import { deleteDocxBlocks } from "./docx/docxBlockEngine";
import { syncSystemBlocksInHub } from "./reportBlocks";

/**
 * Hapus system blocks yang di-unlock dari DOCX (narasi user tidak disentuh).
 * @param {number} year
 * @param {string} sessionId
 */
export async function applyDeletedSystemBlocksToDocx(year, sessionId) {
  const saved = (await readReportState(year)) || {};
  const findingSections = Array.isArray(saved.findingSections) ? saved.findingSections : [];
  const blockSync = syncSystemBlocksInHub(
    saved,
    findingSections,
    saved.auditVisibleByDept || {},
  );

  const deleted = blockSync.deletedSystemIds || [];
  if (!deleted.length || !(await docxExists(sessionId))) {
    return { ok: true, deleted: [], skipped: true };
  }

  let buf = await readDocx(sessionId);
  buf = deleteDocxBlocks(buf, deleted);
  await saveDocx(sessionId, buf);

  return { ok: true, deleted, skipped: false };
}
