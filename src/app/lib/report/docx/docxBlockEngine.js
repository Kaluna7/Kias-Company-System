import PizZip from "pizzip";
import { toBookmarkName } from "../reportBlocks";
import { blockMarkerToken } from "./blockBookmarks";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readDocumentXml(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  const file = zip.file("word/document.xml");
  if (!file) return { zip, xml: null };
  return { zip, xml: file.asText() };
}

export function writeDocumentXml(zip, xml) {
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function findBookmarkRange(xml, bookmarkName) {
  const patterns = [
    new RegExp(
      `<w:bookmarkStart[^>]*w:name="${escapeRegex(bookmarkName)}"[^>]*w:id="(\\d+)"[^>]*/>`,
      "i",
    ),
    new RegExp(
      `<w:bookmarkStart[^>]*w:id="(\\d+)"[^>]*w:name="${escapeRegex(bookmarkName)}"[^>]*/>`,
      "i",
    ),
    new RegExp(
      `<w:bookmarkStart[^>]*w:name="${escapeRegex(bookmarkName)}"[^>]*/>`,
      "i",
    ),
  ];

  let startMatch = null;
  let bmId = null;
  for (const re of patterns) {
    const m = xml.match(re);
    if (!m) continue;
    startMatch = m;
    bmId = m[1] || null;
    break;
  }
  if (!startMatch) return null;

  if (!bmId) {
    const idRe = new RegExp(
      `<w:bookmarkStart[^>]*w:name="${escapeRegex(bookmarkName)}"[^>]*w:id="(\\d+)"[^>]*/>`,
      "i",
    );
    bmId = xml.match(idRe)?.[1] || null;
  }
  if (!bmId) return null;

  const startIdx = startMatch.index;
  const endRe = new RegExp(`<w:bookmarkEnd[^>]*w:id="${bmId}"[^>]*/>`, "i");
  const endMatch = xml.slice(startIdx).match(endRe);
  if (!endMatch) return null;

  const endIdx = startIdx + endMatch.index + endMatch[0].length;
  return { startIdx, endIdx, bmId };
}

/**
 * Hapus block berdasarkan marker KIASBLOCK (ketat) — bookmark OnlyOffice bisa meluas
 * dan ikut menghapus teks user (TEST) di halaman lain.
 */
function findMarkerBlockRange(xml, blockId) {
  const bmName = toBookmarkName(blockId);
  const startToken = blockMarkerToken(blockId, "START");
  const endToken = blockMarkerToken(blockId, "END");

  const tokenStartIdx = xml.indexOf(startToken);
  if (tokenStartIdx < 0) return null;

  const tokenEndIdx = xml.indexOf(endToken, tokenStartIdx);
  if (tokenEndIdx < 0) return null;

  let startIdx = xml.lastIndexOf("<w:bookmarkStart", tokenStartIdx);
  if (startIdx < 0 || tokenStartIdx - startIdx > 400) {
    startIdx = xml.lastIndexOf("<w:p", tokenStartIdx);
  }
  if (startIdx < 0) startIdx = tokenStartIdx;

  let endIdx = xml.indexOf("</w:p>", tokenEndIdx);
  if (endIdx < 0) {
    endIdx = tokenEndIdx + endToken.length;
  } else {
    endIdx += "</w:p>".length;
  }

  const tail = xml.slice(endIdx, endIdx + 120);
  const bmEnd = tail.match(/<w:bookmarkEnd[^>]*\/>/);
  if (bmEnd) {
    endIdx += bmEnd.index + bmEnd[0].length;
  }

  return { startIdx, endIdx };
}

function resolveBlockRange(xml, blockId) {
  return findMarkerBlockRange(xml, blockId) || findBookmarkRange(xml, toBookmarkName(blockId));
}

function getMaxBookmarkId(xml) {
  let max = 0;
  const re = /<w:bookmark(?:Start|End)[^>]*w:id="(\d+)"/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    max = Math.max(max, Number(m[1]) || 0);
  }
  return max;
}

/** Renumber bookmark ids di fragment sisipan agar tidak bentrok dengan dokumen utama. */
function renumberBookmarkIdsInFragment(fragment, nextIdStart) {
  const ids = new Set();
  const re = /<w:bookmark(?:Start|End)[^>]*w:id="(\d+)"/gi;
  let m;
  while ((m = re.exec(fragment)) !== null) {
    ids.add(m[1]);
  }
  if (!ids.size) return { xml: fragment, maxId: nextIdStart };

  const sorted = [...ids].sort((a, b) => Number(a) - Number(b));
  const map = new Map();
  let next = nextIdStart;
  for (const old of sorted) {
    map.set(old, String(next++));
  }

  let out = fragment;
  for (const [old, neu] of map) {
    const oldEsc = escapeRegex(old);
    out = out.replace(
      new RegExp(`(<w:bookmark(?:Start|End)[^>]*w:id=")${oldEsc}(")`, "gi"),
      `$1${neu}$2`,
    );
  }
  return { xml: out, maxId: next };
}

const SYSTEM_BLOCK_RE =
  /w:name="kias_sys_finding_[^"]+_(?:sop|audit|exec_summary)"/i;

/** Ambil teks user di luar block system — untuk verifikasi sebelum simpan patch. */
export function collectUserTextOutsideSystemBlocks(xml) {
  if (!xml) return [];

  const ranges = [];
  const markerRe =
    /KIASBLOCK_(?:START|END)_kias_sys_finding_[a-zA-Z0-9_]+_(?:sop|audit|exec_summary)/g;
  let m;
  while ((m = markerRe.exec(xml)) !== null) {
    const idx = m.index;
    const paraStart = xml.lastIndexOf("<w:p", idx);
    const paraEnd = xml.indexOf("</w:p>", idx);
    ranges.push({
      start: paraStart >= 0 ? paraStart : idx,
      end: paraEnd >= 0 ? paraEnd + 6 : idx + m[0].length,
    });
  }

  const bmRe =
    /<w:bookmarkStart[^>]*w:name="(kias_sys_finding_[^"]+_(?:sop|audit|exec_summary))"[^>]*\/>/gi;
  while ((m = bmRe.exec(xml)) !== null) {
    const range = findBookmarkRange(xml, m[1]);
    if (range) ranges.push({ start: range.startIdx, end: range.endIdx });
  }

  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const texts = new Set();
  const textRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  while ((m = textRe.exec(xml)) !== null) {
    const idx = m.index;
    const inside = merged.some((r) => idx >= r.start && idx < r.end);
    if (inside) continue;
    const t = String(m[1] || "")
      .replace(/\u00a0/g, " ")
      .trim();
    if (t.length >= 2 && !/^KIASBLOCK_/i.test(t) && !SYSTEM_BLOCK_RE.test(t)) {
      texts.add(t);
    }
  }
  return [...texts];
}

export function verifyUserTextPreserved(beforeXml, afterXml, fingerprints) {
  if (!fingerprints?.length) return true;
  for (const fp of fingerprints) {
    if (beforeXml.includes(fp) && !afterXml.includes(fp)) {
      return false;
    }
  }
  return true;
}

/**
 * Hapus system block (unlock) — range marker ketat, bukan bookmark melebar.
 */
export function deleteDocxBlockById(docxBuffer, blockId) {
  const { zip, xml } = readDocumentXml(docxBuffer);
  if (!xml) return docxBuffer;

  const range = resolveBlockRange(xml, blockId);
  if (!range) return docxBuffer;

  const next = xml.slice(0, range.startIdx) + xml.slice(range.endIdx);
  return writeDocumentXml(zip, next);
}

export function deleteDocxBlocks(docxBuffer, blockIds = []) {
  let buf = docxBuffer;
  for (const id of blockIds) {
    buf = deleteDocxBlockById(buf, id);
    if (docxHasBlockBookmark(buf, id)) {
      buf = deleteDocxBlockByBookmarkOnly(buf, id);
    }
  }
  return buf;
}

/** Fallback jika marker KIASBLOCK hilang setelah edit OnlyOffice. */
function deleteDocxBlockByBookmarkOnly(docxBuffer, blockId) {
  const name = toBookmarkName(blockId);
  const { zip, xml } = readDocumentXml(docxBuffer);
  if (!xml) return docxBuffer;
  const range = findBookmarkRange(xml, name);
  if (!range) return docxBuffer;
  const next = xml.slice(0, range.startIdx) + xml.slice(range.endIdx);
  return writeDocumentXml(zip, next);
}

export function docxHasBlockBookmark(docxBuffer, blockId) {
  const name = toBookmarkName(blockId);
  const { xml } = readDocumentXml(docxBuffer);
  if (!xml) return false;
  return (
    xml.includes(`w:name="${name}"`) ||
    xml.includes(blockMarkerToken(blockId, "START"))
  );
}

export function extractBookmarkRangeXml(docxBuffer, blockId) {
  const { xml } = readDocumentXml(docxBuffer);
  if (!xml) return null;
  const range = resolveBlockRange(xml, blockId) || findBookmarkRange(xml, toBookmarkName(blockId));
  if (!range) return null;
  return xml.slice(range.startIdx, range.endIdx);
}

function findingsSectionStart(xml) {
  return xml.search(/<w:t[^>]*>[^<]*Findings\s*(?:&amp;|&)\s*Recommendations/i);
}

/** Sisipkan block modul di dekat SOP dept yang sama — bukan di akhir dokumen. */
function findInsertIndexForBlockId(xml, blockId) {
  const parts = String(blockId).match(/^sys:finding:([^:]+):(exec-summary|sop|audit)$/);
  if (!parts) return findInsertIndexForSystemBlock(xml);

  const deptKey = parts[1];
  const kind = parts[2];
  const sopId = `sys:finding:${deptKey}:sop`;
  const execId = `sys:finding:${deptKey}:exec-summary`;
  const sopRange = resolveBlockRange(xml, sopId);
  const execRange = resolveBlockRange(xml, execId);

  if (kind === "audit") {
    if (sopRange) return sopRange.endIdx;
    if (execRange) return execRange.endIdx;
  }
  if (kind === "exec-summary") {
    if (sopRange) return sopRange.startIdx;
  }
  if (kind === "sop") {
    const findingsStart = findingsSectionStart(xml);
    if (findingsStart >= 0) {
      const afterTitle = xml.indexOf("</w:p>", findingsStart);
      if (afterTitle >= 0) return afterTitle + "</w:p>".length;
    }
  }

  return findInsertIndexForSystemBlock(xml);
}

function findInsertIndexForSystemBlock(xml) {
  const findingsTitle = findingsSectionStart(xml);
  if (findingsTitle >= 0) {
    const afterTitle = xml.indexOf("</w:p>", findingsTitle);
    if (afterTitle >= 0) return afterTitle + "</w:p>".length;
  }

  const anchors = [
    /w:bookmarkStart[^>]*w:name="kias_user_note_findings_free"/i,
    /w:bookmarkStart[^>]*w:name="kias_user_conclusion_/i,
  ];

  for (const re of anchors) {
    const m = xml.match(re);
    if (m?.index != null && m.index > 0) return m.index;
  }

  const sectPr = xml.indexOf("<w:sectPr");
  return sectPr >= 0 ? sectPr : xml.length;
}

/**
 * Block ada di XML tapi jauh dari SOP dept-nya → OnlyOffice tidak tampil di section Findings.
 */
export function isSystemBlockMisplaced(xml, blockId) {
  const parts = String(blockId).match(/^sys:finding:([^:]+):(exec-summary|sop|audit)$/);
  if (!parts) return false;

  const findingsStart = findingsSectionStart(xml);
  if (findingsStart < 0) return false;

  const range = resolveBlockRange(xml, blockId);
  if (!range) return false;

  const [, deptKey, kind] = parts;
  const sopRange = resolveBlockRange(xml, `sys:finding:${deptKey}:sop`);

  if (kind === "sop") {
    return range.startIdx < findingsStart || range.startIdx > findingsStart + 200000;
  }

  if (sopRange) {
    if (range.startIdx < sopRange.startIdx - 8000) return true;
    if (range.startIdx > sopRange.endIdx + 250000) return true;
    return false;
  }

  return range.startIdx < findingsStart || range.startIdx > findingsStart + 200000;
}

export function listMisplacedSystemBlockIds(docxBuffer) {
  const { xml } = readDocumentXml(docxBuffer);
  if (!xml) return [];
  return listSystemBlockIdsInDocx(docxBuffer).filter((id) => isSystemBlockMisplaced(xml, id));
}

const BLOCK_KIND_ORDER = { "exec-summary": 0, sop: 1, audit: 2 };

/** Urutan sisip: exec-summary → sop → audit per dept. */
export function sortSystemBlocksForInsert(blockIds = []) {
  return [...blockIds].sort((a, b) => {
    const pa = String(a).match(/^sys:finding:([^:]+):(exec-summary|sop|audit)$/);
    const pb = String(b).match(/^sys:finding:([^:]+):(exec-summary|sop|audit)$/);
    if (!pa || !pb) return String(a).localeCompare(String(b));
    const deptCmp = pa[1].localeCompare(pb[1]);
    if (deptCmp !== 0) return deptCmp;
    return (BLOCK_KIND_ORDER[pa[2]] ?? 9) - (BLOCK_KIND_ORDER[pb[2]] ?? 9);
  });
}

export function insertSystemBlockFromSource(mainBuffer, sourceBuffer, blockId) {
  let fragment = extractBookmarkRangeXml(sourceBuffer, blockId);
  if (!fragment) return mainBuffer;

  const { xml: mainXml } = readDocumentXml(mainBuffer);
  const maxId = getMaxBookmarkId(mainXml || "") + 1;
  fragment = renumberBookmarkIdsInFragment(fragment, maxId).xml;

  if (docxHasBlockBookmark(mainBuffer, blockId)) {
    let buf = deleteDocxBlockById(mainBuffer, blockId);
    return insertSystemBlockXml(buf, fragment, blockId);
  }
  return insertSystemBlockXml(mainBuffer, fragment, blockId);
}

export function insertSystemBlockXml(docxBuffer, rangeXml, blockId = null) {
  const { zip, xml } = readDocumentXml(docxBuffer);
  if (!xml || !rangeXml) return docxBuffer;

  const insertAt = blockId
    ? findInsertIndexForBlockId(xml, blockId)
    : findInsertIndexForSystemBlock(xml);
  const next = xml.slice(0, insertAt) + rangeXml + xml.slice(insertAt);
  return writeDocumentXml(zip, next);
}

export function docxHasSystemTableMarkers(docxBuffer) {
  const { xml } = readDocumentXml(docxBuffer);
  if (!xml) return false;
  return (
    /w:name="kias_sys_finding_[^"]+_(?:sop|audit|exec_summary)"/i.test(xml) ||
    /KIASBLOCK_(?:START|END)_kias_sys_finding_[a-zA-Z0-9_]+_(?:sop|audit|exec_summary)/.test(
      xml,
    )
  );
}

/** @deprecated */
export function docxHasUserEditMarkers(docxBuffer) {
  return docxHasSystemTableMarkers(docxBuffer);
}

function blockIdFromBookmarkName(name) {
  const m = String(name).match(/^kias_sys_finding_(.+)_(sop|audit|exec_summary)$/);
  if (!m) return null;
  const type = m[2] === "exec_summary" ? "exec-summary" : m[2];
  return `sys:finding:${m[1]}:${type}`;
}

/** Semua system block Findings yang ada di DOCX (untuk deteksi orphan setelah unlock). */
export function listSystemBlockIdsInDocx(docxBuffer) {
  const { xml } = readDocumentXml(docxBuffer);
  if (!xml) return [];

  const ids = new Set();
  const bmRe = /w:name="(kias_sys_finding_[^"]+_(?:sop|audit|exec_summary))"/gi;
  let m;
  while ((m = bmRe.exec(xml)) !== null) {
    const blockId = blockIdFromBookmarkName(m[1]);
    if (blockId) ids.add(blockId);
  }

  const markerRe = /KIASBLOCK_(?:START|END)_(kias_sys_finding_[a-zA-Z0-9_]+_(?:sop|audit|exec_summary))/g;
  while ((m = markerRe.exec(xml)) !== null) {
    const blockId = blockIdFromBookmarkName(m[1]);
    if (blockId) ids.add(blockId);
  }

  return [...ids];
}

/**
 * DOCX bisa masih punya tabel audit padahal manifest DB sudah kosong (unlock sebelumnya gagal).
 */
export function reconcileBlockSyncWithDocx(docxBuffer, blockSync) {
  const inDocx = listSystemBlockIdsInDocx(docxBuffer);
  const nextSet = new Set(blockSync.reportBlocks?.manifest || []);
  const orphanInDocx = inDocx.filter((id) => !nextSet.has(id));
  if (!orphanInDocx.length) return blockSync;

  const deleted = [...new Set([...(blockSync.deletedSystemIds || []), ...orphanInDocx])];
  const changed = [...new Set([...(blockSync.changedSystemIds || []), ...orphanInDocx])];
  return {
    ...blockSync,
    deletedSystemIds: deleted,
    changedSystemIds: changed,
  };
}
