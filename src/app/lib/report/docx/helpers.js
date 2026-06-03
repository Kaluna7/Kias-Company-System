import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  HeadingLevel,
  VerticalAlign,
  ShadingType,
  TabStopType,
  TabStopPosition,
  LeaderType,
  ImageRun,
  Footer,
  PageNumber,
  TableLayoutType,
} from "docx";

import {
  FONT,
  BODY_SIZE,
  TABLE_SIZE,
  AUDIT_TABLE_SIZE,
  PORTRAIT_CONTENT_WIDTH,
  FINDING_TABLE_NO_COL_MIN_TWIPS,
} from "./templateStyles";

/** Convert column % to fixed twips (Word/OnlyOffice renders these reliably). */
export function widthsPctToDxa(percents, totalTwips = PORTRAIT_CONTENT_WIDTH) {
  const sum = percents.reduce((a, b) => a + b, 0) || 100;
  const raw = percents.map((p) => Math.floor((p / sum) * totalTwips));
  const drift = totalTwips - raw.reduce((a, b) => a + b, 0);
  if (drift !== 0 && raw.length > 0) raw[raw.length - 1] += drift;
  return raw;
}

/** Ensure "No" column is wide enough that numbers do not wrap in Word/OnlyOffice. */
export function findingTableColumnWidths(percents, totalTwips = PORTRAIT_CONTENT_WIDTH) {
  const widths = widthsPctToDxa(percents, totalTwips);
  if (!widths.length) return widths;

  const minNo = FINDING_TABLE_NO_COL_MIN_TWIPS;
  if (widths[0] < minNo) {
    const need = minNo - widths[0];
    widths[0] = minNo;
    let donorIdx = 1;
    for (let i = 2; i < percents.length; i++) {
      if (percents[i] > percents[donorIdx]) donorIdx = i;
    }
    widths[donorIdx] = Math.max(400, widths[donorIdx] - need);
  }

  const drift = totalTwips - widths.reduce((a, b) => a + b, 0);
  if (drift !== 0) widths[widths.length - 1] += drift;
  return widths;
}

const DEFAULT_FONT = FONT;
const DEFAULT_SIZE = BODY_SIZE;

/** Marker so we can strip orphan page-break paragraphs (they create blank pages in Word/OnlyOffice). */
export const PAGE_BREAK_ONLY = "__kiasPageBreakOnly";

export function pageBreakParagraph() {
  const p = new Paragraph({ children: [new PageBreak()] });
  p[PAGE_BREAK_ONLY] = true;
  return p;
}

export function stripLeadingPageBreakOnlyParagraphs(children) {
  const out = [...(children || [])];
  while (out.length > 0 && out[0]?.[PAGE_BREAK_ONLY]) {
    out.shift();
  }
  return out;
}

export function stripTrailingPageBreakOnlyParagraphs(children) {
  const out = [...(children || [])];
  while (out.length > 0 && out[out.length - 1]?.[PAGE_BREAK_ONLY]) {
    out.pop();
  }
  return out;
}

/** Trailing empty spacer paragraphs after tables (cause blank pages + break centering in Word). */
export const EMPTY_SPACER_PARA = "__kiasEmptySpacer";

export function stripTrailingSpacerParagraphs(children) {
  const out = [...(children || [])];
  while (out.length > 0 && out[out.length - 1]?.[EMPTY_SPACER_PARA]) {
    out.pop();
  }
  return out;
}

export function textParagraph(text, options = {}) {
  const size = options.size ?? DEFAULT_SIZE;
  return new Paragraph({
    alignment: options.alignment,
    spacing: { after: options.after ?? 120, before: options.before ?? 0 },
    pageBreakBefore: options.pageBreakBefore || undefined,
    children: [
      new TextRun({
        text: String(text ?? ""),
        bold: options.bold,
        italics: options.italics,
        underline: options.underline,
        color: options.color,
        size,
        font: DEFAULT_FONT,
      }),
    ],
  });
}

export function headingParagraph(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { after: 160, before: 160 },
    children: [
      new TextRun({
        text: String(text ?? ""),
        bold: true,
        size: level === HeadingLevel.HEADING_1 ? 32 : 28,
        font: DEFAULT_FONT,
      }),
    ],
  });
}

function cellParagraphs(text, options = {}) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, i, arr) => l.length > 0 || (arr.length === 1 && i === 0));
  if (lines.length === 0) lines.push("");

  return lines.map(
    (line, idx) =>
      new Paragraph({
        alignment: options.alignment ?? AlignmentType.LEFT,
        spacing: { after: idx < lines.length - 1 ? 20 : 0 },
        wordWrap: options.nowrap ? false : true,
        children: [
          new TextRun({
            text: line || " ",
            bold: options.bold,
            size: options.size ?? TABLE_SIZE,
            font: DEFAULT_FONT,
          }),
        ],
      }),
  );
}

function cellWidth(options, idx) {
  if (options.columnWidthsDxa?.[idx] != null) {
    return { size: options.columnWidthsDxa[idx], type: WidthType.DXA };
  }
  if (options.widths?.[idx] != null) {
    return { size: options.widths[idx], type: WidthType.PERCENTAGE };
  }
  return undefined;
}

export function makeTableCell(text, options = {}) {
  const fill = options.fill;
  const cellIdx = options.cellIndex ?? 0;
  const width = cellWidth(options, cellIdx);
  const tight = options.compact || options.nowrap;
  return new TableCell({
    width,
    margins: tight
      ? { top: 24, bottom: 24, left: options.nowrap ? 28 : 40, right: options.nowrap ? 28 : 40 }
      : { top: 40, bottom: 40, left: 60, right: 60 },
    shading: fill ? { fill } : undefined,
    verticalAlign: VerticalAlign.TOP,
    children: cellParagraphs(text, options),
  });
}

export function makeHeaderRow(cells, options = {}) {
  return new TableRow({
    tableHeader: options.tableHeader !== false,
    children: cells.map((label, idx) =>
      makeTableCell(label, {
        bold: true,
        fill: options.headerFill ?? "D9D9D9",
        widths: options.widths,
        columnWidthsDxa: options.columnWidthsDxa,
        cellIndex: idx,
        alignment: options.center?.[idx] ? AlignmentType.CENTER : AlignmentType.LEFT,
        size: options.cellSizes?.[idx] ?? options.size ?? TABLE_SIZE,
        compact: options.compact,
        nowrap: options.nowrapCells?.includes(idx),
      }),
    ),
  });
}

export function makeDataRow(cells, options = {}) {
  return new TableRow({
    cantSplit: options.cantSplit ?? false,
    children: cells.map((label, idx) =>
      makeTableCell(label, {
        widths: options.widths,
        columnWidthsDxa: options.columnWidthsDxa,
        cellIndex: idx,
        alignment: options.center?.[idx] ? AlignmentType.CENTER : AlignmentType.LEFT,
        size: options.cellSizes?.[idx] ?? options.size ?? TABLE_SIZE,
        compact: options.compact,
        nowrap: options.nowrapCells?.includes(idx),
      }),
    ),
  });
}

export function makeTable(rows, options = {}) {
  const contentWidthDxa = options.contentWidthDxa ?? PORTRAIT_CONTENT_WIDTH;
  const columnWidths = options.columnWidthsDxa;

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: contentWidthDxa, type: WidthType.DXA },
    columnWidths,
    alignment: options.alignment,
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor ?? "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor ?? "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor ?? "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor ?? "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor ?? "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor ?? "000000" },
    },
  });
}

export function sectionTitle(text) {
  return textParagraph(text, { bold: true, size: 24, after: 160 });
}

export function imageParagraph(buffer, width, height, alignment = AlignmentType.LEFT) {
  if (!buffer) return textParagraph("");
  return new Paragraph({
    alignment,
    spacing: { after: 120 },
    children: [
      new ImageRun({
        data: buffer,
        transformation: { width, height },
      }),
    ],
  });
}

export function labelValueRow(label, value, labelWidthTwips = 3400) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: labelWidthTwips, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${label} :`, bold: true, size: 20, font: DEFAULT_FONT }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: String(value ?? ""), size: 20, font: DEFAULT_FONT }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function grayBadgeParagraph(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: String(text ?? ""),
        bold: true,
        size: 20,
        font: DEFAULT_FONT,
        shading: { type: ShadingType.CLEAR, fill: "F3F4F6" },
      }),
    ],
  });
}

function headerCellParagraphs(label, size, nowrap = false) {
  const lines = String(label ?? "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) lines.push("");
  return lines.map(
    (line, idx) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        wordWrap: nowrap ? false : true,
        spacing: { after: idx < lines.length - 1 ? 0 : 0 },
        children: [
          new TextRun({
            text: line || " ",
            bold: true,
            color: "FFFFFF",
            size,
            font: DEFAULT_FONT,
          }),
        ],
      }),
  );
}

export function makeHeaderRowBlue(cells, widthsOrDxa, options = {}) {
  const useDxa = options.columnWidthsDxa?.length > 0;
  return new TableRow({
    tableHeader: true,
    children: cells.map((label, idx) =>
      new TableCell({
        width: useDxa
          ? { size: options.columnWidthsDxa[idx], type: WidthType.DXA }
          : widthsOrDxa?.[idx]
            ? { size: widthsOrDxa[idx], type: WidthType.PERCENTAGE }
            : undefined,
        shading: { fill: "1E3A8A", type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: options.nowrapCells?.includes(idx)
          ? { top: 40, bottom: 40, left: 28, right: 28 }
          : { top: 40, bottom: 40, left: 40, right: 40 },
        children: headerCellParagraphs(
          label,
          options.cellSizes?.[idx] ?? options.size ?? AUDIT_TABLE_SIZE,
          options.nowrapCells?.includes(idx),
        ),
      }),
    ),
  });
}

/** Gray bordered box — accepts Paragraph and/or nested Table blocks (matches HTML preview). */
export function borderedBoxTable(blocks) {
  const children = blocks?.length > 0 ? blocks : [textParagraph("")];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F9FAFB", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children,
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
    },
  });
}

/** Word footer (PAGE X of Y) — must not be inline in body or it floats mid-page. */
export function createReportDocumentFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" } },
        spacing: { before: 60, after: 0 },
        children: [
          new TextRun({
            text: "SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM",
            size: 12,
            font: DEFAULT_FONT,
          }),
          new TextRun({ text: "\t", size: 12 }),
          new TextRun({ text: "INTERNAL AUDIT REPORT", bold: true, size: 12, font: DEFAULT_FONT }),
          new TextRun({ text: "\t", size: 12 }),
          new TextRun({ text: "PAGE ", size: 12, font: DEFAULT_FONT }),
          PageNumber.CURRENT,
          new TextRun({ text: " of ", size: 12, font: DEFAULT_FONT }),
          PageNumber.TOTAL_PAGES,
        ],
        tabStops: [
          { type: TabStopType.CENTER, position: 4680 },
          { type: TabStopType.RIGHT, position: 9360 },
        ],
      }),
    ],
  });
}

export function tocEntry(title, page) {
  return new Paragraph({
    spacing: { after: 100 },
    tabStops: [
      {
        type: TabStopType.RIGHT,
        position: TabStopPosition.MAX,
        leader: LeaderType.DOT,
      },
    ],
    children: [
      new TextRun({ text: String(title ?? ""), bold: true, size: 20, font: DEFAULT_FONT }),
      new TextRun({ text: "\t" }),
      new TextRun({ text: String(page ?? "—"), bold: true, size: 20, font: DEFAULT_FONT }),
    ],
  });
}

export function pageBlock(children, { pageBreakBefore = false } = {}) {
  const items = pageBreakBefore ? [pageBreakParagraph(), ...children] : children;
  return [...items, pageBreakParagraph()];
}
