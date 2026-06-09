import { Paragraph, TextRun } from "docx";
import { toBookmarkName } from "../reportBlocks";

const MARKER_PREFIX = "KIASBLOCK";

/** Token tersembunyi di DOCX — dinormalisasi jadi bookmark Word. */
export function blockMarkerToken(blockId, boundary) {
  return `${MARKER_PREFIX}_${boundary}_${toBookmarkName(blockId)}`;
}

/** Paragraph marker awal block (system / user). */
export function blockStartMarker(blockId) {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: 20 },
    children: [
      new TextRun({
        text: blockMarkerToken(blockId, "START"),
        size: 2,
        color: "FFFFFF",
        vanish: true,
      }),
    ],
  });
}

/** Paragraph marker akhir block. */
export function blockEndMarker(blockId) {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: 20 },
    children: [
      new TextRun({
        text: blockMarkerToken(blockId, "END"),
        size: 2,
        color: "FFFFFF",
        vanish: true,
      }),
    ],
  });
}

/** Bungkus array paragraph/table dengan marker start/end. */
export function wrapWithBlockMarkers(blockId, children) {
  const items = (children || []).filter(Boolean);
  if (!items.length) return [];
  return [blockStartMarker(blockId), ...items, blockEndMarker(blockId)];
}

let bookmarkIdSeq = 1000;

/**
 * Konversi marker KIASBLOCK → bookmarkStart/bookmarkEnd di document.xml.
 * @param {string} xml
 */
export function injectBookmarksFromMarkers(xml) {
  const startIds = new Map();
  let nextId = bookmarkIdSeq;
  let out = xml;

  const startRe = new RegExp(
    `<w:t[^>]*>([^<]*${MARKER_PREFIX}_START_([a-zA-Z0-9_]+)[^<]*)</w:t>`,
    "g",
  );
  const endRe = new RegExp(
    `<w:t[^>]*>([^<]*${MARKER_PREFIX}_END_([a-zA-Z0-9_]+)[^<]*)</w:t>`,
    "g",
  );

  out = out.replace(startRe, (match, _text, name) => {
    const id = nextId++;
    startIds.set(name, id);
    return `<w:bookmarkStart w:id="${id}" w:name="${name}"/>${match}`;
  });

  out = out.replace(endRe, (match, _text, name) => {
    const id = startIds.get(name);
    if (!id) return match;
    return `${match}<w:bookmarkEnd w:id="${id}"/>`;
  });

  bookmarkIdSeq = nextId;
  return out;
}
