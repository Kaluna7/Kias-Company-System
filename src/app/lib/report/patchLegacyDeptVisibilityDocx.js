import {
  readDocx,
  saveDocx,
  docxExists,
  readMeta,
  writeMeta,
  bumpDocumentKeyAfterServerPatch,
} from "./documentStore";
import { REPORT_DEPARTMENTS } from "./reportDepartments";
import {
  systemFindingAuditBlockId,
  systemFindingExecBlockId,
} from "./reportBlocks";
import { buildModuleSyncRegeneratePayload } from "./onlyOfficeDocxGuard";
import { enrichRegeneratePayloadWithOnlyOffice } from "./enrichRegeneratePayload";
import { buildReportDocxBuffer } from "./reportService";
import { computeModuleTablesHash } from "./moduleTablesHash";
import { computePreviewSnapshotHash } from "./previewAuditVisibility";
import {
  collectUserTextOutsideSystemBlocks,
  verifyUserTextPreserved,
  readDocumentXml,
  writeDocumentXml,
  extractBookmarkRangeXml,
  docxHasSystemTableMarkers,
} from "./docx/docxBlockEngine";

function findingsSectionStart(xml) {
  return xml.search(/<w:t[^>]*>[^<]*Findings\s*(?:&amp;|&)\s*Recommendations/i);
}

function paragraphStartBefore(xml, charIdx) {
  if (charIdx < 0) return -1;
  return xml.lastIndexOf("<w:p", charIdx);
}

function paragraphEndAfter(xml, charIdx) {
  if (charIdx < 0) return -1;
  const end = xml.indexOf("</w:p>", charIdx);
  return end >= 0 ? end + "</w:p>".length : charIdx;
}

const MAX_LEGACY_DELETE_CHARS = 120000;
const SECTION_BOUNDARY_RE =
  /Standard Operating Procedure Related|Audit Review|Conclusion|Appendix|Appendices/i;

function tableEndAfter(xml, charIdx, maxEnd = xml.length) {
  if (charIdx < 0) return -1;
  let pos = charIdx;
  let lastTblEnd = -1;
  while (pos < maxEnd) {
    const nextTbl = xml.indexOf("<w:tbl", pos);
    if (nextTbl < 0 || nextTbl >= maxEnd) break;
    const gap = xml.slice(pos, nextTbl);
    if (SECTION_BOUNDARY_RE.test(gap)) break;
    const tblEnd = xml.indexOf("</w:tbl>", nextTbl);
    if (tblEnd < 0 || tblEnd >= maxEnd) break;
    lastTblEnd = tblEnd + "</w:tbl>".length;
    pos = lastTblEnd;
  }
  return lastTblEnd;
}

/** Hanya hapus judul + tabel audit — jangan sampai dept/conclusion berikutnya. */
function collectAuditHideRange(xml, auditIdx, nextDeptIdx) {
  const start = paragraphStartBefore(xml, auditIdx);
  if (start < 0) return null;

  const maxEnd = nextDeptIdx > start ? nextDeptIdx : xml.length;
  let end = paragraphEndAfter(xml, auditIdx);
  let pos = auditIdx;

  for (let n = 0; n < 4; n++) {
    const tbl = xml.indexOf("<w:tbl", pos);
    if (tbl < 0 || tbl >= maxEnd) break;
    const gap = xml.slice(pos, tbl);
    if (SECTION_BOUNDARY_RE.test(gap)) break;
    const tblEnd = xml.indexOf("</w:tbl>", tbl);
    if (tblEnd < 0 || tblEnd >= maxEnd) break;
    end = tblEnd + "</w:tbl>".length;
    pos = end;
  }

  if (end > maxEnd) end = maxEnd;
  if (end <= start || end - start > MAX_LEGACY_DELETE_CHARS) return null;
  return { start, end };
}

/** Semua anchor dept dalam section Findings (DOCX lama tanpa KIASBLOCK). */
function findDeptAnchorsInFindings(xml, deptLabel) {
  const findingsStart = findingsSectionStart(xml);
  if (findingsStart < 0) return [];

  const anchors = [];
  let searchFrom = findingsStart;
  while (searchFrom < xml.length) {
    const labelIdx = xml.indexOf(deptLabel, searchFrom);
    if (labelIdx < 0) break;
    const before = xml.slice(Math.max(findingsStart, labelIdx - 400), labelIdx);
    if (!/Department/i.test(before)) {
      searchFrom = labelIdx + deptLabel.length;
      continue;
    }

    const execIdx = xml.indexOf("Executive Summary", labelIdx);
    const sopIdx = xml.indexOf("Standard Operating Procedure Related", labelIdx);

    const searchBase =
      (sopIdx >= 0 ? sopIdx : labelIdx) + Math.max(deptLabel.length, 20);
    let nextDeptIdx = xml.length;
    for (const other of REPORT_DEPARTMENTS) {
      if (other.label === deptLabel) continue;
      const otherIdx = xml.indexOf(other.label, searchBase);
      if (otherIdx < 0) continue;
      const otherBefore = xml.slice(Math.max(0, otherIdx - 400), otherIdx);
      if (/Department/i.test(otherBefore)) {
        nextDeptIdx = Math.min(nextDeptIdx, paragraphStartBefore(xml, otherIdx));
      }
    }

    const auditIdx = xml.indexOf("Audit Review", sopIdx >= 0 ? sopIdx : labelIdx);
    const validAudit =
      auditIdx >= 0 && sopIdx >= 0 && auditIdx > sopIdx && auditIdx < nextDeptIdx
        ? auditIdx
        : -1;

    anchors.push({
      labelIdx,
      execIdx: execIdx >= 0 && (sopIdx < 0 || execIdx < sopIdx) && execIdx < nextDeptIdx ? execIdx : -1,
      sopIdx: sopIdx >= 0 && sopIdx < nextDeptIdx ? sopIdx : -1,
      auditIdx: validAudit,
      nextDeptIdx,
    });
    searchFrom = labelIdx + deptLabel.length;
  }
  return anchors;
}

function deleteXmlRanges(xml, ranges) {
  const sorted = [...ranges]
    .filter((r) => r.start >= 0 && r.end > r.start)
    .sort((a, b) => b.start - a.start);
  let next = xml;
  for (const { start, end } of sorted) {
    next = next.slice(0, start) + next.slice(end);
  }
  return next;
}

function collectHideRangesForDept(xml, deptLabel) {
  const ranges = [];
  const anchors = findDeptAnchorsInFindings(xml, deptLabel);
  const primary = anchors.length ? [anchors[0]] : [];
  for (const anchor of primary) {
    if (anchor.execIdx >= 0 && anchor.sopIdx > anchor.execIdx) {
      const start = paragraphStartBefore(xml, anchor.execIdx);
      const end = paragraphStartBefore(xml, anchor.sopIdx);
      if (start >= 0 && end > start) ranges.push({ start, end });
    }
    if (anchor.auditIdx >= 0) {
      const auditRange = collectAuditHideRange(xml, anchor.auditIdx, anchor.nextDeptIdx);
      if (auditRange) ranges.push(auditRange);
    }
  }
  return ranges;
}

/**
 * DOCX tanpa bookmark: sembunyikan Executive Summary + Audit untuk satu dept (SOP tetap).
 */
export async function hideLegacyDeptAuditInDocx(sessionId, deptKey, saved) {
  if (!(await docxExists(sessionId))) return { ok: false, error: "no-docx" };

  const dept = REPORT_DEPARTMENTS.find((d) => d.key === deptKey);
  if (!dept) return { ok: false, error: "unknown-dept" };

  const originalBuf = await readDocx(sessionId);
  const { zip, xml: beforeXml } = readDocumentXml(originalBuf);
  if (!beforeXml) return { ok: false, error: "no-xml" };

  const userFingerprints = collectUserTextOutsideSystemBlocks(beforeXml);
  const ranges = collectHideRangesForDept(beforeXml, dept.label);
  if (!ranges.length) {
    return { ok: true, patched: false, noop: true, patchMode: "legacy-no-ranges" };
  }

  const totalDelete = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  if (totalDelete > MAX_LEGACY_DELETE_CHARS) {
    return {
      ok: false,
      error: "Patch dibatalkan: rentang hapus terlalu besar (DOCX tanpa marker).",
      patchMode: "legacy-hide-aborted",
      totalDelete,
    };
  }

  const afterXml = deleteXmlRanges(beforeXml, ranges);
  if (!verifyUserTextPreserved(beforeXml, afterXml, userFingerprints)) {
    return {
      ok: false,
      error: "Patch dibatalkan: teks OnlyOffice akan hilang.",
      contentPreservationFailed: true,
      patchMode: "legacy-hide",
    };
  }

  const buf = writeDocumentXml(zip, afterXml);
  await saveDocx(sessionId, buf);
  await bumpDocumentKeyAfterServerPatch(sessionId);

  const findingSections = Array.isArray(saved.findingSections) ? saved.findingSections : [];
  const meta = (await readMeta(sessionId)) || { sessionId };
  await writeMeta(sessionId, {
    ...meta,
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
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    patched: true,
    patchMode: "legacy-hide",
    deletedRanges: ranges.length,
  };
}

/**
 * DOCX tanpa bookmark: sisipkan Executive Summary + Audit sebelum/sesudah SOP dept.
 */
export async function showLegacyDeptAuditInDocx(year, sessionId, deptKey, saved) {
  if (!(await docxExists(sessionId))) return { ok: false, error: "no-docx" };

  const dept = REPORT_DEPARTMENTS.find((d) => d.key === deptKey);
  if (!dept) return { ok: false, error: "unknown-dept" };

  let payload = await buildModuleSyncRegeneratePayload(year);
  if (!payload) return { ok: false, error: "no-payload" };
  payload = await enrichRegeneratePayloadWithOnlyOffice(year, payload);
  const sourceBuf = await buildReportDocxBuffer(payload);

  const execFrag = extractBookmarkRangeXml(sourceBuf, systemFindingExecBlockId(deptKey));
  const auditFrag = extractBookmarkRangeXml(sourceBuf, systemFindingAuditBlockId(deptKey));
  if (!execFrag && !auditFrag) {
    return { ok: true, patched: false, noop: true, patchMode: "legacy-show-empty" };
  }

  const originalBuf = await readDocx(sessionId);
  const { zip, xml: beforeXml } = readDocumentXml(originalBuf);
  if (!beforeXml) return { ok: false, error: "no-xml" };

  const userFingerprints = collectUserTextOutsideSystemBlocks(beforeXml);
  let xml = beforeXml;
  const anchors = findDeptAnchorsInFindings(xml, dept.label).filter((a) => a.sopIdx >= 0);
  if (!anchors.length) {
    return { ok: false, error: "Tidak menemukan section SOP dept di Word.", patchMode: "legacy-show" };
  }

  const anchor = anchors[0];
  if (execFrag && anchor.execIdx < 0) {
    const insertAt = paragraphStartBefore(xml, anchor.sopIdx);
    if (insertAt >= 0) {
      xml = xml.slice(0, insertAt) + execFrag + xml.slice(insertAt);
    }
  }

  const conclusionIdx = xml.search(/<w:t[^>]*>[^<]*Conclusion/i);
  const sopIdxAfterExec = xml.indexOf("Standard Operating Procedure Related", anchor.labelIdx);
  if (
    auditFrag &&
    xml.indexOf("Audit Review", anchor.labelIdx) < 0 &&
    sopIdxAfterExec >= 0 &&
    sopIdxAfterExec < anchor.nextDeptIdx
  ) {
    const sopTableEnd = tableEndAfter(xml, sopIdxAfterExec, anchor.nextDeptIdx);
    let insertAt =
      sopTableEnd > sopIdxAfterExec
        ? paragraphEndAfter(xml, sopTableEnd)
        : paragraphEndAfter(xml, sopIdxAfterExec);
    if (conclusionIdx > 0) insertAt = Math.min(insertAt, conclusionIdx);
    if (insertAt > 0 && insertAt < anchor.nextDeptIdx && insertAt < xml.length) {
      xml = xml.slice(0, insertAt) + auditFrag + xml.slice(insertAt);
    }
  }

  if (xml === beforeXml) {
    return { ok: true, patched: false, noop: true, patchMode: "legacy-show-noop" };
  }

  if (!verifyUserTextPreserved(beforeXml, xml, userFingerprints)) {
    return {
      ok: false,
      error: "Patch dibatalkan: teks OnlyOffice akan hilang.",
      contentPreservationFailed: true,
      patchMode: "legacy-show",
    };
  }

  const buf = writeDocumentXml(zip, xml);
  await saveDocx(sessionId, buf);
  await bumpDocumentKeyAfterServerPatch(sessionId);

  return {
    ok: true,
    patched: true,
    patchMode: "legacy-show",
    insertedExec: Boolean(execFrag),
    insertedAudit: Boolean(auditFrag),
  };
}

export function docxNeedsLegacyVisibilityPatch(docxBuffer) {
  return !docxHasSystemTableMarkers(docxBuffer);
}
