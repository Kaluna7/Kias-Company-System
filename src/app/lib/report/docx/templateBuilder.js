import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  NumberFormat,
  ImageRun,
  VerticalAlign,
  ShadingType,
  PageOrientation,
  HeightRule,
  TableLayoutType,
  TabStopType,
  TabStopPosition,
  SectionType,
  FrameAnchorType,
  FrameWrap,
  TextWrappingType,
  TextWrappingSide,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  createWrapNone,
} from "docx";
import {
  wrapWithBlockMarkers,
} from "./blockBookmarks";
import {
  systemFindingSopBlockId,
  systemFindingAuditBlockId,
  systemFindingExecBlockId,
} from "../reportBlocks";
import {
  PAGE_SIZE_PORTRAIT,
  PAGE_SIZE_LANDSCAPE,
  PAGE_MARGINS,
  HTML_BODY_MARGINS,
  LANDSCAPE_TABLE_MARGINS,
  BODY_SIZE,
  TITLE_SIZE,
  FONT,
  LANDSCAPE_CONTENT_WIDTH,
  PORTRAIT_CONTENT_WIDTH,
  PAGE_BODY_HEIGHT,
  CONTENT_BODY_HEIGHT,
  SOP_TABLE_WIDTHS_PCT,
  AUDIT_TABLE_WIDTHS_PCT,
  FINDING_TABLE_DATA_SIZE,
  AUDIT_TABLE_CELL_SIZES,
} from "./templateStyles";
import {
  PAGE_BREAK_ONLY,
  pageBreakParagraph,
  stripLeadingPageBreakOnlyParagraphs,
  stripTrailingPageBreakOnlyParagraphs,
  stripTrailingSpacerParagraphs,
  textParagraph,
  makeTable,
  makeHeaderRow,
  makeDataRow,
  makeHeaderRowBlue,
  imageParagraph,
  createReportDocumentFooter,
  createInfoPageFooter,
  tocEntry,
  labelValueRow,
  borderedBoxTable,
  widthsPctToDxa,
  findingTableColumnWidths,
} from "./helpers";
import { htmlToDocxParagraphs } from "./htmlToDocx";
import { resolveHtmlPageList } from "./htmlPageUtils";
import { formatDeptTocTitle } from "./templateTitles";
import { resolveAuditTeamRows } from "../auditTeamDefaults";
import { resolveConclusionPagesFromPayload } from "../conclusionSegments";
import { resolveAppendixPagesFromPayload } from "../appendixPages";
import {
  COVER_FONT,
  COVER_REPORT_LINE_SIZE,
  COVER_SUBTITLE,
  COVER_SUBTITLE_SIZE,
  COVER_TAGLINE,
  COVER_TAGLINE_SIZE,
  COVER_TITLE_LINE_SIZE,
  COVER_YEAR_SIZE,
  COVER_YEAR_WHITE_HEX,
} from "../coverLayout";
import { resolvePreparedByRows } from "../preparedByDefaults";

function readPublicImage(filename) {
  try {
    const filePath = path.join(process.cwd(), "public", "images", filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function ensureTableCenterAlignment(xml) {
  return xml.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (tblXml) => {
    if (/<w:jc[\s>]/.test(tblXml)) return tblXml;
    return tblXml.replace("<w:tblPr>", "<w:tblPr><w:jc w:val=\"center\"/>");
  });
}

async function ensureUpdateFieldsOnOpen(zip) {
  const settingsPath = "word/settings.xml";
  const file = zip.file(settingsPath);
  if (!file) return false;

  let xml = await file.async("string");
  if (/<w:updateFields\b/.test(xml)) return false;

  const patched = xml.includes("</w:settings>")
    ? xml.replace("</w:settings>", '<w:updateFields w:val="true"/></w:settings>')
    : xml;
  if (patched === xml) return false;
  zip.file(settingsPath, patched);
  return true;
}

async function normalizeReportDocx(buffer) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const docPath = "word/document.xml";
  const file = zip.file(docPath);
  if (!file) return buffer;

  let xml = await file.async("string");
  let patched = xml.replace(
    /<w:pgSz([^>]*?)w:w="11906"([^>]*?)w:h="16838"([^>]*?)w:orient="landscape"([^>]*?)\/>/g,
    '<w:pgSz$1w:w="16838"$2w:h="11906"$3w:orient="landscape"$4/>',
  );
  patched = ensureTableCenterAlignment(patched);
  const { injectBookmarksFromMarkers } = await import("./blockBookmarks");
  const withBookmarks = injectBookmarksFromMarkers(patched);
  if (withBookmarks !== patched) patched = withBookmarks;

  const settingsPatched = await ensureUpdateFieldsOnOpen(zip);
  const docPatched = patched !== xml;

  if (!docPatched && !settingsPatched) return buffer;
  if (docPatched) zip.file(docPath, patched);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function formatExecSummaryItem(item) {
  if (item == null) return "-";
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (typeof item === "object") {
    const name = item?.name ? String(item.name) : "";
    const region = item?.region ? String(item.region) : "";
    if (name && region) return `${name} - ${region}`;
    if (name) return name;
    return (
      Object.values(item)
        .filter((v) => v != null && v !== "")
        .map(String)
        .join(" - ") || "-"
    );
  }
  return String(item);
}

function riskLevelLabel(level) {
  const n = Number(level);
  if (n === 1) return "Low";
  if (n === 2) return "Moderate";
  if (n === 3) return "High";
  return level != null && level !== "" ? String(level) : "";
}

/** Match HTML preview cell display for risk level column. */
function formatRiskLevelCell(level) {
  const label = riskLevelLabel(level);
  if (label) return label;
  return level != null && level !== "" ? String(level) : "";
}

const EXEC_SUMMARY_FONT = BODY_SIZE - 2; // 10pt — HTML text-[10px]

/** Cover section with full-bleed page area (no page margins). */
const COVER_MARGIN = { top: 0, bottom: 0, left: 0, right: 0 };
const COVER_CONTENT_WIDTH =
  PAGE_SIZE_PORTRAIT.width - COVER_MARGIN.left - COVER_MARGIN.right;
const COVER_CONTENT_HEIGHT =
  PAGE_SIZE_PORTRAIT.height - COVER_MARGIN.top - COVER_MARGIN.bottom;
/** Extra px on cover image height to avoid a white strip at the bottom in OnlyOffice. */
const COVER_IMAGE_BLEED_PX = 14;

function pxFromTwips(twips) {
  return Math.max(24, Math.floor(twips / 15));
}

/** Max image height (px) that fits inside a table row with EXACT height. */
function pxCapForRow(rowTwips, reserveTwips = 60) {
  return Math.max(24, pxFromTwips(Math.max(0, rowTwips - reserveTwips)));
}

/** One A4 sheet — fixed table width so OnlyOffice does not grow cells horizontally. */
function fixedPageShell(rows) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: PORTRAIT_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [PORTRAIT_CONTENT_WIDTH],
    borders: COVER_BORDER_NONE,
    rows,
  });
}

function paragraphSpacer(lines = 1) {
  return Array.from({ length: Math.max(0, lines) }, () =>
    new Paragraph({
      spacing: { before: 0, after: 0, line: 240 },
      children: [new TextRun({ text: " ", size: INFO_FONT, font: FONT })],
    }),
  );
}

const COVER_BORDER_NONE = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

/** Full-bleed cover art + framed text overlays (cover.png has no main title text). */
const COVER_IMAGE_PATH = "report-cover/cover.png";
const COVER_NAVY_HEX = "1A365D";
const COVER_GOLD_HEX = "C9A227";

const COVER_FRAME_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
};

const COVER_FRAME_ANCHOR = {
  horizontal: FrameAnchorType.PAGE,
  vertical: FrameAnchorType.PAGE,
};

function coverFrameParagraph(children, { x, y, width, height, alignment, noBorder = false } = {}) {
  return new Paragraph({
    alignment,
    frame: {
      position: { x, y },
      width,
      height,
      anchor: COVER_FRAME_ANCHOR,
      wrap: FrameWrap.NONE,
    },
    border: noBorder ? COVER_BORDER_NONE : COVER_FRAME_BORDER,
    spacing: { before: 0, after: 0 },
    children,
  });
}

function coverBackgroundParagraph(coverBuffer) {
  const pageW = pxFromTwips(COVER_CONTENT_WIDTH) + 4;
  const pageH = pxFromTwips(COVER_CONTENT_HEIGHT) + COVER_IMAGE_BLEED_PX;

  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [
      new ImageRun({
        data: coverBuffer,
        transformation: { width: pageW, height: pageH },
        floating: {
          allowOverlap: true,
          behindDocument: true,
          lockAnchor: true,
          wrap: createWrapNone(),
          horizontalPosition: {
            relative: HorizontalPositionRelativeFrom.PAGE,
            offset: 0,
          },
          verticalPosition: {
            relative: VerticalPositionRelativeFrom.PAGE,
            offset: 0,
          },
        },
      }),
    ],
  });
}

function buildCoverTextFrames(year) {
  const x = Math.round(COVER_CONTENT_WIDTH * 0.075);
  const titleY = Math.round(COVER_CONTENT_HEIGHT * 0.2);
  const taglineY = Math.round(COVER_CONTENT_HEIGHT * 0.46);
  const yearFrameW = 2400;
  const yearFrameH = 1000;
  const yearX = COVER_CONTENT_WIDTH - yearFrameW - Math.round(COVER_CONTENT_WIDTH * 0.08);
  const yearY = Math.round(COVER_CONTENT_HEIGHT * 0.86);

  const titleFrame = coverFrameParagraph(
    [
      new TextRun({
        text: "INTERNAL",
        bold: true,
        size: COVER_TITLE_LINE_SIZE,
        color: COVER_NAVY_HEX,
        font: COVER_FONT,
      }),
      new TextRun({
        text: "AUDIT",
        bold: true,
        size: COVER_TITLE_LINE_SIZE,
        color: COVER_NAVY_HEX,
        font: COVER_FONT,
        break: 1,
      }),
      new TextRun({
        text: "REPORT",
        bold: true,
        size: COVER_REPORT_LINE_SIZE,
        color: COVER_GOLD_HEX,
        font: COVER_FONT,
        break: 1,
      }),
      new TextRun({ text: " ", size: 8, font: COVER_FONT, break: 1 }),
      new TextRun({
        text: COVER_SUBTITLE,
        bold: true,
        size: COVER_SUBTITLE_SIZE,
        color: COVER_NAVY_HEX,
        font: COVER_FONT,
        break: 1,
      }),
    ],
    { x, y: titleY, width: 6000, height: 3600 },
  );

  const taglineFrame = coverFrameParagraph(
    [
      new TextRun({
        text: COVER_TAGLINE[0],
        size: COVER_TAGLINE_SIZE,
        color: COVER_NAVY_HEX,
        font: COVER_FONT,
      }),
      new TextRun({
        text: COVER_TAGLINE[1],
        size: COVER_TAGLINE_SIZE,
        color: COVER_NAVY_HEX,
        font: COVER_FONT,
        break: 1,
      }),
    ],
    { x, y: taglineY, width: 5200, height: 1200 },
  );

  const yearFrame = coverFrameParagraph(
    [
      new TextRun({
        text: year,
        bold: true,
        size: COVER_YEAR_SIZE,
        color: COVER_YEAR_WHITE_HEX,
        font: COVER_FONT,
      }),
    ],
    {
      x: yearX,
      y: yearY,
      width: yearFrameW,
      height: yearFrameH,
      alignment: AlignmentType.RIGHT,
      noBorder: true,
    },
  );

  return [titleFrame, taglineFrame, yearFrame];
}

/**
 * One A4 cover: background image (behind text, full page height) + bordered frames (in front).
 */
function buildCoverPage(payload) {
  const year = String(payload.year ?? new Date().getFullYear());
  const cover = readPublicImage(COVER_IMAGE_PATH);
  const children = [];

  if (cover) {
    children.push(coverBackgroundParagraph(cover));
  }

  children.push(...buildCoverTextFrames(year));

  /** Anchor flow height without pushing a second page. */
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 0, line: 240 },
      children: [new TextRun({ text: "", size: 2, font: COVER_FONT })],
    }),
  );

  return children;
}

const INFO_FONT = 20; // 10pt — appendix tables
const NARRATIVE_SECTION_FONT = 22; // 11pt — Conclusion & Appendices body text
const PREPARED_BY_FONT = 18; // 9pt — prepared by block
const PREPARED_BY_UNDERLINE_FONT = 14; // 7pt — signature line beside MEMBER
/** HTML max-w-[650px], label w-[230px] */
const INFO_FIELD_TABLE_W = 9750;
/** ~230px label column in HTML preview */
const INFO_LABEL_DXA = 3450;
const INFO_FIELD_COL_DXA = [INFO_LABEL_DXA, INFO_FIELD_TABLE_W - INFO_LABEL_DXA];

function grayBadgeRun(text, bold = true) {
  return new TextRun({
    text: String(text ?? ""),
    bold,
    size: INFO_FONT,
    font: FONT,
    shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
  });
}

function infoLabelCell(label) {
  return new TableCell({
    width: { size: INFO_FIELD_COL_DXA[0], type: WidthType.DXA },
    borders: COVER_BORDER_NONE,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 0, right: 120 },
    children: [
      new Paragraph({
        wordWrap: true,
        children: [
          new TextRun({
            text: `${label} :`,
            bold: true,
            size: INFO_FONT,
            color: "374151",
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

function infoValueCell(children) {
  return new TableCell({
    width: { size: INFO_FIELD_COL_DXA[1], type: WidthType.DXA },
    borders: COVER_BORDER_NONE,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 0, right: 0 },
    children: Array.isArray(children) ? children : [children],
  });
}

function infoFieldRow(label, valueParagraphs) {
  return new TableRow({
    children: [infoLabelCell(label), infoValueCell(valueParagraphs)],
  });
}

function buildInfoFieldsInnerTable(payload) {
  const plainValueRun = (text) =>
    new TextRun({
      text: String(text ?? ""),
      bold: true,
      size: INFO_FONT,
      color: "0F172A",
      font: FONT,
    });

  const periodText = [payload.periodStart, payload.periodEnd]
    .filter(Boolean)
    .join("  -  ");
  const periodPara = new Paragraph({
    wordWrap: true,
    children: [plainValueRun(periodText)],
  });

  const rows = [
    infoFieldRow("PERIOD", periodPara),
    infoFieldRow(
      "AUDIT COVERAGE",
      new Paragraph({ wordWrap: true, children: [plainValueRun(payload.auditCoverage || "")] }),
    ),
    infoFieldRow(
      "DEPARTMENT COVERAGE",
      new Paragraph({ wordWrap: true, children: [plainValueRun(payload.departmentCoverage || "")] }),
    ),
    infoFieldRow(
      "AREA",
      new Paragraph({ wordWrap: true, children: [plainValueRun(payload.area || "")] }),
    ),
  ];

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: INFO_FIELD_TABLE_W, type: WidthType.DXA },
    columnWidths: INFO_FIELD_COL_DXA,
    alignment: AlignmentType.CENTER,
    borders: COVER_BORDER_NONE,
    rows,
  });
}

function companyHeaderBlock(logoKpu, logoSize = 80, nameSize = 28) {
  if (!logoKpu) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "PT KARYA PRIMA UNGGULAN",
            bold: true,
            size: nameSize,
            font: FONT,
            color: "1F2937",
          }),
        ],
      }),
    ];
  }
  const headerW = 7800;
  const logoCol = 1320;
  const textCol = headerW - logoCol;
  return [
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: headerW, type: WidthType.DXA },
      columnWidths: [logoCol, textCol],
      alignment: AlignmentType.CENTER,
      borders: COVER_BORDER_NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: logoCol, type: WidthType.DXA },
              borders: COVER_BORDER_NONE,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new ImageRun({
                      data: logoKpu,
                      transformation: { width: logoSize, height: logoSize },
                      floating: {
                        horizontalPosition: {
                          relative: HorizontalPositionRelativeFrom.COLUMN,
                          offset: 0,
                        },
                        verticalPosition: {
                          relative: VerticalPositionRelativeFrom.PARAGRAPH,
                          offset: 0,
                        },
                        wrap: {
                          type: TextWrappingType.SQUARE,
                          side: TextWrappingSide.BOTH_SIDES,
                        },
                      },
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: textCol, type: WidthType.DXA },
              borders: COVER_BORDER_NONE,
              verticalAlign: VerticalAlign.CENTER,
              margins: { left: 120, right: 0, top: 0, bottom: 0 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: "PT KARYA PRIMA UNGGULAN",
                      bold: true,
                      size: nameSize,
                      font: FONT,
                      color: "1F2937",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

/** Page 2 — logo, title, period/coverage fields, head office (matches HTML info block 1). */
function buildInfoFieldsPage(payload) {
  const logoKpu = readPublicImage("logo_KPU.png");
  return [
    ...companyHeaderBlock(logoKpu, 80, 34),
    ...paragraphSpacer(3),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: "INTERNAL AUDIT REPORT",
          bold: true,
          size: 30,
          font: FONT,
          color: "0B1736",
          characterSpacing: 100,
        }),
      ],
    }),
    ...paragraphSpacer(2),
    buildInfoFieldsInnerTable(payload),
  ];
}

function auditTeamDataCell(text, colIdx, colW) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: String(text ?? ""),
          bold: true,
          size: INFO_FONT,
          font: FONT,
        }),
      ],
    }),
  ];

  return new TableCell({
    width: { size: colW[colIdx], type: WidthType.DXA },
    borders: COVER_BORDER_NONE,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 48, bottom: 48, left: 80, right: 80 },
    children,
  });
}

/** Borderless two-column table — Example Name | MEMBER (plain). */
function buildAuditTeamTable(team) {
  const members = resolveAuditTeamRows(team);
  const tableW = 5200;
  const colW = widthsPctToDxa([50, 50], tableW);

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: tableW, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: colW,
    borders: COVER_BORDER_NONE,
    rows: members.map(
      (m) =>
        new TableRow({
          children: [
            auditTeamDataCell(m.name, 0, colW),
            auditTeamDataCell(m.role, 1, colW),
          ],
        }),
    ),
  });
}

/** Department completion — borderless table, wide columns so text stays on one line. */
function buildDeptCompletionTable(deptRows) {
  const gridW = PORTRAIT_CONTENT_WIDTH;
  const colW = [3000, 4600, 1472];

  const cell = (text, colIdx, { align = AlignmentType.LEFT, bold = true } = {}) =>
    new TableCell({
      width: { size: colW[colIdx], type: WidthType.DXA },
      borders: COVER_BORDER_NONE,
      margins: {
        top: 36,
        bottom: 36,
        left: colIdx === 0 ? 0 : 60,
        right: colIdx === 2 ? 0 : 60,
      },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: align,
          spacing: { before: 0, after: 0 },
          wordWrap: false,
          children: [
            new TextRun({
              text: String(text ?? ""),
              bold,
              size: INFO_FONT,
              font: FONT,
            }),
          ],
        }),
      ],
    });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: gridW, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: colW,
    borders: COVER_BORDER_NONE,
    rows: [
      new TableRow({
        children: [
          cell("DEPARTMENT :", 0, { align: AlignmentType.LEFT }),
          cell("", 1),
          cell("PAGE", 2, { align: AlignmentType.RIGHT }),
        ],
      }),
      ...deptRows.map((r) =>
        new TableRow({
          children: [
            cell(r.name || "", 0, { align: AlignmentType.LEFT }),
            cell(r.completionDate || "", 1, { align: AlignmentType.LEFT }),
            cell(r.pageRange || "—", 2, { align: AlignmentType.RIGHT }),
          ],
        }),
      ),
    ],
  });
}

/** Page 3 — audit team, department completion, date issued, logo (matches HTML info block 2). */
function buildInfoTeamPage(payload) {
  const kiasBlack = readPublicImage("kias_black_logo.png");
  const team = payload.auditTeam || [];
  const deptRows = payload.departmentCompletionRows || [];

  const TEAM_ROW_HEAD = Math.round(CONTENT_BODY_HEIGHT * 0.08);
  const TEAM_ROW_TEAM = Math.round(CONTENT_BODY_HEIGHT * 0.18);
  const TEAM_ROW_DEPT = Math.round(CONTENT_BODY_HEIGHT * 0.5);
  const TEAM_ROW_ISSUED = Math.round(CONTENT_BODY_HEIGHT * 0.08);
  const TEAM_ROW_LOGO =
    CONTENT_BODY_HEIGHT - TEAM_ROW_HEAD - TEAM_ROW_TEAM - TEAM_ROW_DEPT - TEAM_ROW_ISSUED;

  const pageTable = fixedPageShell([
      new TableRow({
        height: { value: TEAM_ROW_HEAD, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: COVER_BORDER_NONE,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "AUDIT TEAM :",
                    bold: true,
                    size: 20,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        height: { value: TEAM_ROW_TEAM, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: COVER_BORDER_NONE,
            verticalAlign: VerticalAlign.TOP,
            children: [buildAuditTeamTable(team)],
          }),
        ],
      }),
      new TableRow({
        height: { value: TEAM_ROW_DEPT, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: COVER_BORDER_NONE,
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: "DEPARTMENT COMPLETION DATE :",
                    bold: true,
                    size: 22,
                    font: FONT,
                  }),
                ],
              }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [] }),
              ...(deptRows.length > 0
                ? [buildDeptCompletionTable(deptRows)]
                : [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [grayBadgeRun("—")],
                    }),
                  ]),
            ],
          }),
        ],
      }),
      new TableRow({
        height: { value: TEAM_ROW_ISSUED, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: COVER_BORDER_NONE,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "DATE OF ISSUED ", bold: true, size: 18, font: FONT }),
                  new TextRun({ text: ":  ", size: INFO_FONT, font: FONT }),
                  new TextRun({
                    text: String(payload.issuedDate || ""),
                    bold: true,
                    size: INFO_FONT,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        height: { value: TEAM_ROW_LOGO, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: COVER_BORDER_NONE,
            verticalAlign: VerticalAlign.CENTER,
            children: kiasBlack
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: kiasBlack,
                        transformation: { width: 152, height: 96 },
                      }),
                    ],
                  }),
                ]
              : [],
          }),
        ],
      }),
  ]);

  return [pageTable];
}

const SIGNATURE_COL_DXA = widthsPctToDxa([50, 50], PORTRAIT_CONTENT_WIDTH);

function signatureColumn(title, name, dateStr, colIdx) {
  return new TableCell({
    width: { size: SIGNATURE_COL_DXA[colIdx], type: WidthType.DXA },
    borders: COVER_BORDER_NONE,
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: title, bold: true, size: INFO_FONT, font: FONT }),
          new TextRun({ text: "  ", size: INFO_FONT }),
          new TextRun({ text: dateStr || "", size: INFO_FONT, font: FONT }),
        ],
      }),
      new Paragraph({ spacing: { before: 960, after: 0 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { left: 720, right: 720 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "9CA3AF" } },
        children: [new TextRun({ text: " ", size: 8 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          new TextRun({ text: name || " ", bold: true, size: INFO_FONT, font: FONT }),
        ],
      }),
    ],
  });
}

function preparedByPlainCell(
  text,
  colIdx,
  colW,
  { bold = false, align = AlignmentType.LEFT, size = PREPARED_BY_FONT } = {},
) {
  return new TableCell({
    width: { size: colW[colIdx], type: WidthType.DXA },
    borders: COVER_BORDER_NONE,
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 40, bottom: 40, left: colIdx === 0 ? 0 : 60, right: 60 },
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: String(text ?? ""),
            bold,
            size,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

function preparedByRoleCell(role, colIdx, colW) {
  return preparedByPlainCell(String(role ?? ""), colIdx, colW, { bold: true });
}

/** Small signature line beside MEMBER — cell bottom border only (no text underline = no double strip). */
function preparedByUnderlineCell(colIdx, colW) {
  return new TableCell({
    width: { size: colW[colIdx], type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
    },
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 40, bottom: 56, left: 0, right: 40 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: "\u00A0",
            size: PREPARED_BY_UNDERLINE_FONT,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

/** Borderless table: Name | MEMBER | underline | DATE | date — one row per member. */
function buildPreparedByBlock(prepared) {
  const rows = resolvePreparedByRows(prepared);
  const tableW = PORTRAIT_CONTENT_WIDTH;
  const colW = widthsPctToDxa([28, 12, 14, 10, 36], tableW);

  const titleCell = new TableCell({
    columnSpan: 5,
    borders: COVER_BORDER_NONE,
    margins: { top: 120, bottom: 160, left: 0, right: 0 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "PREPARED BY :", bold: true, size: PREPARED_BY_FONT, font: FONT }),
        ],
      }),
    ],
  });

  const memberRows =
    rows.length > 0
      ? rows.map(
          (row) =>
            new TableRow({
              children: [
                preparedByPlainCell(row.name, 0, colW, { bold: true }),
                preparedByRoleCell(row.role, 1, colW),
                preparedByUnderlineCell(2, colW),
                preparedByPlainCell("DATE", 3, colW, { bold: true }),
                preparedByPlainCell(row.date, 4, colW, { bold: true }),
              ],
            }),
        )
      : [
          new TableRow({
            children: [
              preparedByPlainCell("", 0, colW, { bold: true }),
              preparedByRoleCell("", 1, colW),
              preparedByUnderlineCell(2, colW),
              preparedByPlainCell("DATE", 3, colW, { bold: true }),
              preparedByPlainCell("", 4, colW, { bold: true }),
            ],
          }),
        ];

  return [
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: tableW, type: WidthType.DXA },
      alignment: AlignmentType.LEFT,
      columnWidths: colW,
      borders: COVER_BORDER_NONE,
      rows: [new TableRow({ children: [titleCell] }), ...memberRows],
    }),
  ];
}

/** Page 4 — prepared by & management approval (matches HTML approval block). */
function buildApprovalPage(payload) {
  const logoKpu = readPublicImage("logo_KPU.png");
  const prepared = payload.preparedBy || [];
  const year = String(payload.year ?? "");

  return [
    ...companyHeaderBlock(logoKpu, 80, 34),
    ...paragraphSpacer(2),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "INTERNAL AUDIT REPORT",
          bold: true,
          size: 32,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `AUDIT PERIOD ${year}`,
          bold: true,
          size: 26,
          font: FONT,
        }),
      ],
    }),
    ...buildPreparedByBlock(prepared),
    ...paragraphSpacer(2),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 320 },
      children: [
        new TextRun({
          text: "MANAGEMENT APPROVAL,",
          bold: true,
          size: INFO_FONT,
          font: FONT,
        }),
      ],
    }),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: PORTRAIT_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: SIGNATURE_COL_DXA,
      borders: COVER_BORDER_NONE,
      rows: [
        new TableRow({
          children: [
            signatureColumn(
              "AUDIT COMMITTEE,",
              payload.auditCommitteeName || "",
              payload.auditCommitteeDate || "",
              0,
            ),
            signatureColumn(
              "PRESIDENT DIRECTOR,",
              payload.presidentDirectorName || "",
              payload.presidentDirectorDate || "",
              1,
            ),
          ],
        }),
      ],
    }),
  ];
}

function buildTocPage(payload) {
  const items = payload.tableOfContents || [];
  // No leading page break — the portrait section already starts on a new page after page 4.
  return [
    textParagraph("Table of Contents", { bold: true, size: 32, alignment: AlignmentType.CENTER, after: 400 }),
    textParagraph("Page", { bold: true, alignment: AlignmentType.RIGHT, after: 80 }),
    ...items.map((item) => tocEntry(item.title, item.page)),
  ];
}

/** One HTML preview narrative page → one portrait part (matches preview A4 pages). */
function buildNarrativePartsFromPreview(payload) {
  const parts = [];

  const addSeries = (title, pagesHtml, fallbackHtml) => {
    const pages = resolveHtmlPageList(pagesHtml, fallbackHtml);
    if (!pages.length) return;

    pages.forEach((pageHtml, idx) => {
      const blocks = [pageBreakParagraph()];
      if (idx === 0) {
        blocks.push(
          textParagraph(title, {
            bold: true,
            size: 32,
            alignment: AlignmentType.CENTER,
            after: 240,
          }),
        );
      }
      const body = htmlToDocxParagraphs(pageHtml, { bodyAlignment: AlignmentType.JUSTIFY });
      blocks.push(...(body.length > 0 ? body : [textParagraph(" ", { size: BODY_SIZE })]));
      parts.push({ orientation: "portrait", blocks });
    });
  };

  if (payload?.source === "html-preview") {
    addSeries(
      "Executive Summary",
      payload.executiveSummaryPages,
      payload.executiveSummaryHtml,
    );
    addSeries(
      "Audit Objectives and Scope",
      payload.auditObjectivesScopePages,
      payload.auditObjectivesScopeHtml,
    );
    addSeries(
      "Audit Approach and Methodology",
      payload.auditApproachMethodologyPages,
      payload.auditApproachMethodologyHtml,
    );
  }

  return parts;
}

/** One HTML preview page per Word page break — matches preview pagination. */
function buildHtmlContentPages(title, pagesHtml, fallbackHtml, editHint, options = {}) {
  const { pageBreakBeforeTitle = false } = options;
  const pages = resolveHtmlPageList(pagesHtml, fallbackHtml);
  if (!pages.length) return [];

  const blocks = [];
  pages.forEach((pageHtml, idx) => {
    if (idx === 0) {
      blocks.push(
        textParagraph(title, {
          bold: true,
          size: 32,
          alignment: AlignmentType.CENTER,
          after: 240,
          pageBreakBefore: pageBreakBeforeTitle,
        }),
      );
      if (editHint) {
        blocks.push(textParagraph(editHint, { size: 18, after: 120 }));
      }
    } else {
      blocks.push(pageBreakParagraph());
    }
    const body = htmlToDocxParagraphs(pageHtml, { bodyAlignment: AlignmentType.JUSTIFY });
    blocks.push(...(body.length > 0 ? body : [textParagraph(" ", { size: BODY_SIZE })]));
  });
  return blocks;
}

function listItemsParagraphs(items) {
  if (!items?.length) return [textParagraph("-", { size: EXEC_SUMMARY_FONT })];
  return items.map((item) =>
    textParagraph(`• ${formatExecSummaryItem(item)}`, { size: EXEC_SUMMARY_FONT, after: 40 }),
  );
}

function deptSummaryColumn(title, items) {
  return [
    textParagraph(title, { bold: true, size: EXEC_SUMMARY_FONT, after: 60 }),
    ...listItemsParagraphs(items),
  ];
}

function deptSummaryGridCell(title, items) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 40, bottom: 80, left: 60, right: 60 },
    children: deptSummaryColumn(title, items),
  });
}

/** Match HTML preview: bordered box, 2×3 grid, Internal Audit Team full width below. */
function buildDeptExecutiveSummaryBlock(exec) {
  if (!exec) return [];

  const grid = new Table({
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
          deptSummaryGridCell("Objective of the Audit", exec.objectiveOfAudit),
          deptSummaryGridCell("1.1 Scope - Areas Covered", exec.scopeAreasCovered),
        ],
      }),
      new TableRow({
        children: [
          deptSummaryGridCell("1.2 Methodology", exec.scopeMethodology),
          deptSummaryGridCell("1.4 Limitations - Scope", exec.limitationsScope),
        ],
      }),
      new TableRow({
        children: [
          deptSummaryGridCell("Limitations - Time", exec.limitationsTime),
          deptSummaryGridCell("Limitations - Resource", exec.limitationsResource),
        ],
      }),
    ],
  });

  return [
    borderedBoxTable([
      textParagraph("Executive Summary", { bold: true, size: EXEC_SUMMARY_FONT, after: 80 }),
      grid,
      ...deptSummaryColumn("Internal Audit Team", exec.internalAuditTeam),
    ]),
    textParagraph("", { after: 100 }),
  ];
}

const SOP_COL_DXA = findingTableColumnWidths(SOP_TABLE_WIDTHS_PCT, PORTRAIT_CONTENT_WIDTH);
const AUDIT_COL_DXA = findingTableColumnWidths(AUDIT_TABLE_WIDTHS_PCT, LANDSCAPE_CONTENT_WIDTH);
const AUDIT_COL_DXA_PORTRAIT = findingTableColumnWidths(
  AUDIT_TABLE_WIDTHS_PCT,
  PORTRAIT_CONTENT_WIDTH,
);

const AUDIT_HEADERS = [
  "No",
  "Risk\nID",
  "Risk\nDetails",
  "Risk\nLevel",
  "Audit Program\nCode",
  "Substantive\nTest",
  "Methodology",
  "Finding\nResult",
  "Finding\nDescription",
  "Auditee\nComment",
  "Follow-Up\nDetail",
];

function deptSectionHeader(page, afterDept = 140) {
  return [
    new Paragraph({
      keepNext: true,
      children: [
        new TextRun({
          text: "5   Finding & Recommendation",
          bold: true,
          size: BODY_SIZE,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      keepNext: true,
      spacing: { after: afterDept },
      children: [
        new TextRun({
          text: `5.${page.deptNum}   Department   ${page.deptLabel || ""}`,
          size: BODY_SIZE,
          font: FONT,
        }),
      ],
    }),
  ];
}

function buildSopTableRows(sopRows, showTitle = true) {
  if (!sopRows?.length) return [];
  const titlePara = showTitle
    ? [
        new Paragraph({
          keepNext: true,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Standard Operating Procedure Related (SOP Review)",
              bold: true,
              size: BODY_SIZE,
              font: FONT,
            }),
          ],
        }),
      ]
    : [];

  return [
    ...titlePara,
    makeTable(
      [
        makeHeaderRow(
          ["No", "Standard Operating Procedure Related", "Review", "Auditee Comment", "Follow-Up Detail"],
          {
            columnWidthsDxa: SOP_COL_DXA,
            compact: true,
            size: FINDING_TABLE_DATA_SIZE,
            nowrapCells: [0],
            center: [true, false, false, false, false],
          },
        ),
        ...sopRows.map((row, idx) =>
          makeDataRow(
            [
              row.__continuedRow ? "" : String(row.no ?? idx + 1),
              row.sopRelated || "",
              row.reviewComment || (row.__continuedRow ? "" : "-"),
              row.__continuedRow ? "" : row.auditeeComment || "-",
              row.__continuedRow ? "" : row.followUpDetail || "-",
            ],
            {
              columnWidthsDxa: SOP_COL_DXA,
              compact: true,
              size: FINDING_TABLE_DATA_SIZE,
              nowrapCells: [0],
              center: [true, false, false, false, false],
            },
          ),
        ),
      ],
      {
        columnWidthsDxa: SOP_COL_DXA,
        contentWidthDxa: PORTRAIT_CONTENT_WIDTH,
        alignment: AlignmentType.CENTER,
      },
    ),
  ];
}

function buildAuditTableRows(auditRows, showTitle = true, options = {}) {
  if (!auditRows?.length) return [];
  const portrait = options.portrait === true;
  const columnWidthsDxa = portrait ? AUDIT_COL_DXA_PORTRAIT : AUDIT_COL_DXA;
  const contentWidthDxa = portrait ? PORTRAIT_CONTENT_WIDTH : LANDSCAPE_CONTENT_WIDTH;
  const titlePara = showTitle
    ? [
        new Paragraph({
          keepNext: true,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Audit Review — Findings Detail",
              bold: true,
              size: BODY_SIZE,
              font: FONT,
            }),
          ],
        }),
      ]
    : [];

  return [
    ...titlePara,
    makeTable(
      [
        makeHeaderRowBlue(AUDIT_HEADERS, null, {
          columnWidthsDxa,
          cellSizes: AUDIT_TABLE_CELL_SIZES,
          nowrapCells: [0],
        }),
        ...auditRows.map((row, idx) =>
          makeDataRow(
            [
              row.__continuedRow ? "" : String(row.no ?? idx + 1),
              row.__continuedRow ? "" : row.riskId || "",
              row.riskDetails || "",
              row.__continuedRow ? "" : formatRiskLevelCell(row.riskLevel),
              row.__continuedRow ? "" : row.apCode || "",
              row.substantiveTest || "",
              row.methodology || "",
              row.findingResult || "",
              row.findingDescription || "",
              row.auditeeComment || (row.__continuedRow ? "" : "-"),
              row.followUpDetail || (row.__continuedRow ? "" : "-"),
            ],
            {
              columnWidthsDxa,
              cellSizes: AUDIT_TABLE_CELL_SIZES,
              compact: true,
              nowrapCells: [0],
              center: [true, false, false, true, false, false, false, false, false, false, false],
            },
          ),
        ),
      ],
      {
        columnWidthsDxa,
        contentWidthDxa,
        borderColor: "1E3A8A",
      },
    ),
  ];
}

/** Portrait: cover, exec summary dept box, SOP — no wide audit grid. */
function buildFindingPortraitContent(page) {
  const pageChildren = [];

  if (page.isFirstPageForDept) {
    pageChildren.push(
      textParagraph("Findings & Recommendations", {
        bold: true,
        size: TITLE_SIZE,
        alignment: AlignmentType.CENTER,
        after: 200,
      }),
    );
  }

  if (page.isFirstPageForDept || page.showDeptHeader) {
    pageChildren.push(...deptSectionHeader(page));
  }

  if (page.isFirstPageForDept && page.executiveSummary) {
    pageChildren.push(...buildDeptExecutiveSummaryBlock(page.executiveSummary));
  }

  if (page.sopRows?.length) {
    pageChildren.push(...buildSopTableRows(page.sopRows, page.isFirstSopChunk));
  }

  return pageChildren;
}

/** Landscape: audit table only — fits OnlyOffice / Word page width. */
function buildFindingLandscapeContent(page) {
  const pageChildren = [];

  if (page.isFirstPageForDept && !page.auditFollowsSopOnPriorPage) {
    pageChildren.push(
      textParagraph("Findings & Recommendations", {
        bold: true,
        size: TITLE_SIZE,
        alignment: AlignmentType.CENTER,
        after: 160,
      }),
    );
  }

  const needsDeptHeader =
    page.showDeptHeader ||
    page.auditFollowsSopOnPriorPage ||
    (page.isFirstPageForDept && page.auditRows?.length > 0) ||
    (page.auditRows?.length > 0 && page.isFirstAuditChunk && !page.sopRows?.length);

  if (needsDeptHeader) {
    pageChildren.push(...deptSectionHeader(page, 100));
  }

  if (page.auditRows?.length) {
    pageChildren.push(...buildAuditTableRows(page.auditRows, page.isFirstAuditChunk));
  }

  return pageChildren;
}

/** Gabung chunk preview per dept → satu tabel audit utuh (Word yang paginate baris). */
function aggregateFindingPagesToSections(pages) {
  const order = [];
  const byDept = new Map();

  for (const page of pages || []) {
    const key = page.deptKey;
    if (!key) continue;
    if (!byDept.has(key)) {
      byDept.set(key, {
        deptKey: key,
        deptLabel: page.deptLabel,
        areaAudit: page.areaAudit,
        executiveSummary: null,
        sopRows: [],
        auditRows: [],
      });
      order.push(key);
    }
    const acc = byDept.get(key);
    if (page.isFirstPageForDept && page.executiveSummary) {
      acc.executiveSummary = page.executiveSummary;
    }
    acc.sopRows.push(...(page.sopRows || []));
    acc.auditRows.push(...(page.auditRows || []));
  }

  return order.map((key) => byDept.get(key));
}

/** Executive summary dept — system block (hilang saat unlock Audit Review). */
function wrapDeptExecSummary(deptKey, executiveSummary) {
  if (!executiveSummary) return [];
  return wrapWithBlockMarkers(
    systemFindingExecBlockId(deptKey),
    buildDeptExecutiveSummaryBlock(executiveSummary),
  );
}

function isDeptPublishedInPayload(payload, deptKey) {
  const map = payload?.effectivePublishByDept || {};
  if (map[deptKey] === true) return true;
  if (map[deptKey] === false) return false;
  if (payload?.auditVisibleByDept?.[deptKey] === false) return false;
  if (payload?.auditVisibleByDept?.[deptKey] === true) return true;
  return false;
}

function normalizePreviewFindingPage(raw, payload) {
  const deptKey = raw.deptKey || raw.dept?.deptKey || "";
  const published = isDeptPublishedInPayload(payload, deptKey);
  const hasAudit = published && (raw.auditRows || []).length > 0;
  const hasSop = (raw.sopRows || []).length > 0;
  const executiveSummary =
    published && raw.isFirstPageForDept && raw.executiveSummary
      ? raw.executiveSummary
      : null;

  return {
    deptKey,
    deptLabel: raw.deptLabel || raw.dept?.deptLabel || "",
    deptNum: Number(raw.deptNum) || payload.deptIndexMap?.[deptKey] || 1,
    executiveSummary,
    sopRows: raw.sopRows || [],
    auditRows: published ? raw.auditRows || [] : [],
    isFirstPageForDept: raw.isFirstPageForDept === true,
    isFirstSopChunk: raw.isFirstSopChunk !== false,
    isFirstAuditChunk: raw.isFirstAuditChunk !== false,
    showDeptHeader:
      raw.isFirstPageForDept === true ||
      (hasAudit && raw.isFirstAuditChunk && !hasSop),
  };
}

function auditFollowsSopOnPriorPreviewPage(pages, payload, pageIndex, page) {
  if (page.sopRows.length > 0 || !page.auditRows.length) return false;
  for (let i = pageIndex - 1; i >= 0; i -= 1) {
    const prev = normalizePreviewFindingPage(pages[i], payload);
    if (prev.deptKey !== page.deptKey) break;
    if (prev.sopRows.length > 0) return true;
  }
  return false;
}

/**
 * HTML Preview chunks → Word sections.
 * SOP rows for the same department are merged into one table so Word/OnlyOffice
 * can pack continuation rows on the same page (no forced blank space per preview chunk).
 * A new page/section starts only at the first page of each department.
 */
function buildFindingPartsFromPreviewPages(payload) {
  const pages = payload.findingPages || [];
  if (!pages.length) return [];

  const ordered = [];
  let addedFindingsTitle = false;
  /** @type {{ deptKey: string, blocks: unknown[], sopRows: object[] } | null} */
  let portraitBuf = null;
  /** @type {{ deptKey: string, prefixBlocks: unknown[], auditRows: object[], showTitle: boolean, wrapAudit: boolean } | null} */
  let landscapeBuf = null;

  const findingsTitleBlocks = () => {
    if (addedFindingsTitle) return [];
    addedFindingsTitle = true;
    return [
      textParagraph("Findings & Recommendations", {
        bold: true,
        size: TITLE_SIZE,
        alignment: AlignmentType.CENTER,
        after: 200,
      }),
    ];
  };

  const flushPortraitBuf = () => {
    if (!portraitBuf) return;
    const blocks = [...portraitBuf.blocks];
    if (portraitBuf.sopRows.length > 0) {
      blocks.push(
        ...wrapWithBlockMarkers(
          systemFindingSopBlockId(portraitBuf.deptKey),
          buildSopTableRows(portraitBuf.sopRows, true),
        ),
      );
    }
    if (blocks.length > 0) {
      ordered.push({ orientation: "portrait", blocks });
    }
    portraitBuf = null;
  };

  const flushLandscapeBuf = () => {
    if (!landscapeBuf) return;
    const blocks = [...landscapeBuf.prefixBlocks];
    if (landscapeBuf.auditRows.length > 0) {
      const auditTable = buildAuditTableRows(
        landscapeBuf.auditRows,
        landscapeBuf.showTitle,
      );
      blocks.push(
        ...(landscapeBuf.wrapAudit
          ? wrapWithBlockMarkers(systemFindingAuditBlockId(landscapeBuf.deptKey), auditTable)
          : auditTable),
      );
    }
    if (blocks.length > 0) {
      ordered.push({ orientation: "landscape", blocks });
    }
    landscapeBuf = null;
  };

  const ensurePortraitBuf = (page) => {
    if (portraitBuf && portraitBuf.deptKey === page.deptKey) return;
    flushPortraitBuf();
    flushLandscapeBuf();
    portraitBuf = {
      deptKey: page.deptKey,
      blocks: [pageBreakParagraph(), ...findingsTitleBlocks()],
      sopRows: [],
    };
  };

  pages.forEach((raw, pageIndex) => {
    const page = normalizePreviewFindingPage(raw, payload);
    const published = isDeptPublishedInPayload(payload, page.deptKey);
    const hasSop = page.sopRows.length > 0;
    const hasAudit = page.auditRows.length > 0;
    const hasExec = published && page.isFirstPageForDept && page.executiveSummary;
    if (!hasSop && !hasAudit && !hasExec) return;

    const auditFollowsSop =
      hasAudit && (hasSop || auditFollowsSopOnPriorPreviewPage(pages, payload, pageIndex, page));

    if (page.isFirstPageForDept) {
      if (portraitBuf && portraitBuf.deptKey !== page.deptKey) {
        flushPortraitBuf();
      }
      if (landscapeBuf && landscapeBuf.deptKey !== page.deptKey) {
        flushLandscapeBuf();
      }
      ensurePortraitBuf(page);
      portraitBuf.blocks.push(...deptSectionHeader(page));
      if (hasExec) {
        portraitBuf.blocks.push(...wrapDeptExecSummary(page.deptKey, page.executiveSummary));
      }
    }

    if (hasSop) {
      if (!portraitBuf || portraitBuf.deptKey !== page.deptKey) {
        if (landscapeBuf) flushLandscapeBuf();
        if (!page.isFirstPageForDept) {
          portraitBuf = {
            deptKey: page.deptKey,
            blocks: [],
            sopRows: [],
          };
        } else {
          ensurePortraitBuf(page);
        }
      }
      portraitBuf.sopRows.push(...page.sopRows);
    }

    if (!hasAudit) return;

    flushPortraitBuf();

    const needsNewLandscape =
      !landscapeBuf ||
      landscapeBuf.deptKey !== page.deptKey ||
      (page.isFirstAuditChunk && landscapeBuf.auditRows.length > 0);

    if (needsNewLandscape) {
      flushLandscapeBuf();
      const prefixBlocks = [];
      if (ordered.length === 0 && !portraitBuf) {
        prefixBlocks.push(pageBreakParagraph());
      }
      if (page.isFirstPageForDept && !auditFollowsSop) {
        prefixBlocks.push(...findingsTitleBlocks());
      }
      const needsLandscapeDeptHeader =
        page.showDeptHeader ||
        auditFollowsSop ||
        (page.isFirstAuditChunk && !hasSop);
      if (needsLandscapeDeptHeader) {
        prefixBlocks.push(...deptSectionHeader(page, 100));
      }
      landscapeBuf = {
        deptKey: page.deptKey,
        prefixBlocks,
        auditRows: [],
        showTitle: page.isFirstAuditChunk,
        wrapAudit: page.isFirstAuditChunk,
      };
    }

    landscapeBuf.auditRows.push(...page.auditRows);
  });

  flushPortraitBuf();
  flushLandscapeBuf();

  return ordered;
}

/**
 * Fallback: one table per dept when preview chunks are unavailable.
 */
function buildFindingPagesOrdered(payload) {
  if (payload?.source === "html-preview") {
    return buildFindingPartsFromPreviewPages(payload);
  }

  if (Array.isArray(payload.findingPages) && payload.findingPages.length > 0) {
    return buildFindingPartsFromPreviewPages(payload);
  }

  let sections = payload.findingSections || [];
  if (!sections.length && payload.findingPages?.length) {
    sections = aggregateFindingPagesToSections(payload.findingPages);
  }
  if (!sections.length) return [];

  const ordered = [];
  let addedFindingsTitle = false;
  let isFirstFindingBlock = true;

  const findingsTitle = () =>
    textParagraph("Findings & Recommendations", {
      bold: true,
      size: TITLE_SIZE,
      alignment: AlignmentType.CENTER,
      after: 200,
    });

  sections.forEach((section, sectionIdx) => {
    const deptNum = payload.deptIndexMap?.[section.deptKey] ?? sectionIdx + 1;
    const sopRows = section.sopRows || [];
    const auditRows = section.auditRows || [];
    const hasSop = sopRows.length > 0;
    const hasAudit = auditRows.length > 0;
    if (!hasSop && !hasAudit) return;

    const page = {
      deptKey: section.deptKey,
      deptLabel: section.deptLabel,
      deptNum,
      executiveSummary: section.executiveSummary,
      isFirstPageForDept: true,
      isFirstSopChunk: true,
      isFirstAuditChunk: true,
    };

    const prefixBreak = (landscape = false) => {
      const blocks = [];
      if (!landscape) blocks.push(pageBreakParagraph());
      if (isFirstFindingBlock) isFirstFindingBlock = false;
      if (!addedFindingsTitle) {
        blocks.push(findingsTitle());
        addedFindingsTitle = true;
      }
      return blocks;
    };

    if (hasSop && hasAudit) {
      const portraitBlocks = [
        ...prefixBreak(false),
        ...deptSectionHeader(page),
        ...wrapDeptExecSummary(section.deptKey, section.executiveSummary),
        ...wrapWithBlockMarkers(
          systemFindingSopBlockId(section.deptKey),
          buildSopTableRows(sopRows, true),
        ),
      ];
      ordered.push({ orientation: "portrait", blocks: portraitBlocks });

      ordered.push({
        orientation: "landscape",
        blocks: [
          ...deptSectionHeader(page, 100),
          ...wrapWithBlockMarkers(
            systemFindingAuditBlockId(section.deptKey),
            buildAuditTableRows(auditRows, true),
          ),
        ],
      });
      return;
    }

    if (hasAudit) {
      if (section.executiveSummary) {
        const portraitBlocks = [
          ...prefixBreak(false),
          ...deptSectionHeader(page),
          ...wrapDeptExecSummary(section.deptKey, section.executiveSummary),
        ];
        ordered.push({ orientation: "portrait", blocks: portraitBlocks });
      }

      const landscapeBlocks = [
        ...(section.executiveSummary ? [] : prefixBreak(true)),
        ...deptSectionHeader(page, 100),
        ...wrapWithBlockMarkers(
          systemFindingAuditBlockId(section.deptKey),
          buildAuditTableRows(auditRows, true),
        ),
      ];
      ordered.push({ orientation: "landscape", blocks: landscapeBlocks });
      return;
    }

    const portraitBlocks = [
      ...prefixBreak(false),
      ...deptSectionHeader(page),
      ...wrapDeptExecSummary(section.deptKey, section.executiveSummary),
      ...wrapWithBlockMarkers(
        systemFindingSopBlockId(section.deptKey),
        buildSopTableRows(sopRows, true),
      ),
    ];
    ordered.push({ orientation: "portrait", blocks: portraitBlocks });
  });

  return ordered;
}

function resolveFindingDetailPages(payload) {
  return payload.findingDetailPages?.length ? payload.findingDetailPages : [];
}

/** Narasi Finding & Recommendation per department — dari DB (bukan modul / Word). */
function buildDeptFindingNarrativePages(payload) {
  const items = Array.isArray(payload.deptFindingNarratives) ? payload.deptFindingNarratives : [];
  if (!items.length) return [];

  const blocks = [];
  const deptIndexMap = payload.deptIndexMap || {};

  items.forEach((item, idx) => {
    const deptNum = deptIndexMap[item.deptKey] ?? idx + 1;
    const findingHtml = String(item.findingHtml || "").trim();
    const recommendationHtml = String(item.recommendationHtml || "").trim();
    if (!findingHtml && !recommendationHtml) return;

    const pageChildren = [
      pageBreakParagraph(),
      textParagraph("Findings & Recommendations", {
        bold: true,
        size: TITLE_SIZE,
        alignment: AlignmentType.CENTER,
        after: 200,
      }),
      textParagraph("5   Finding & Recommendation", { bold: true, size: BODY_SIZE }),
      textParagraph(`5.${deptNum}   Department   ${item.deptLabel || item.deptKey}`, {
        size: BODY_SIZE,
      }),
    ];

    if (findingHtml) {
      pageChildren.push(
        textParagraph(`5.${deptNum}.1   Finding`, { bold: true, after: 80, size: BODY_SIZE }),
        ...htmlToDocxParagraphs(findingHtml, { size: BODY_SIZE }),
      );
    }
    if (recommendationHtml) {
      pageChildren.push(
        textParagraph("Recommendation", { bold: true, after: 80, size: BODY_SIZE }),
        ...htmlToDocxParagraphs(recommendationHtml, { size: BODY_SIZE }),
      );
    }

    blocks.push(...pageChildren);
  });

  return blocks;
}

function buildFindingDetailPages(payload) {
  const blocks = [];
  const items = resolveFindingDetailPages(payload);

  items.forEach((item, itemIdx) => {
    const { section, finding, findingIndex } = item;
    const deptNum = payload.deptIndexMap?.[section?.deptKey] ?? 1;
    const riskRating = riskLevelLabel(finding?.riskLevel);
    const riskRatingText = riskRating ? `[${riskRating}]` : "[Low, Moderate, High]";

    const infoBox = borderedBoxTable([
      textParagraph(`Area Audit : ${section?.areaAudit ?? section?.deptLabel ?? "-"}`, {
        size: BODY_SIZE,
      }),
      textParagraph(`Audit Program Code : ${finding?.apCode || "-"}`, { size: BODY_SIZE }),
      textParagraph(`Risk : ${finding?.risk || finding?.riskId || "-"}`, { size: BODY_SIZE }),
      textParagraph(`Risk Description : ${finding?.riskDetails || "-"}`, { size: BODY_SIZE }),
      textParagraph(`Effect if not mitigate : ${finding?.effectIfNotMitigate || "-"}`, {
        size: BODY_SIZE,
      }),
      textParagraph(`Risk Rating : ${riskRatingText}`, { size: BODY_SIZE }),
    ]);

    const pageChildren = [
      pageBreakParagraph(),
      textParagraph("Findings & Recommendations", {
        bold: true,
        size: TITLE_SIZE,
        alignment: AlignmentType.CENTER,
        after: 200,
      }),
      textParagraph("5   Finding & Recommendation", { bold: true, size: BODY_SIZE }),
      textParagraph(`5.${deptNum}   Department   ${section?.deptLabel || ""}`, { size: BODY_SIZE }),
      textParagraph(
        `5.${deptNum}.${findingIndex}   Finding :   ${finding?.findingDescription || finding?.findingResult || "-"}`,
        { bold: true, after: 120, size: BODY_SIZE },
      ),
      infoBox,
      textParagraph("Recommendation", { bold: true, after: 60, size: BODY_SIZE }),
      textParagraph(finding?.recommendation || "", { after: 120, size: BODY_SIZE }),
      textParagraph("Audit Response", { bold: true, after: 60, size: BODY_SIZE }),
      textParagraph(
        "Auditee agrees to ________________________________ by __________________",
        { after: 80, size: BODY_SIZE },
      ),
      textParagraph("Management Response", { bold: true, after: 60, size: BODY_SIZE }),
      textParagraph(
        "Management agrees to ________________________________ by __________________",
        { after: 80, size: BODY_SIZE },
      ),
    ];

    blocks.push(...pageChildren);
  });
  return blocks;
}

function resolveConclusionPages(payload) {
  return resolveConclusionPagesFromPayload(payload);
}

function buildConclusionBodyParagraphs(text) {
  const raw = String(text || "").trim();
  if (!raw) return [textParagraph("-", { size: NARRATIVE_SECTION_FONT })];
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return [textParagraph(raw, { size: NARRATIVE_SECTION_FONT })];
  }
  return paragraphs.map((p, idx) =>
    textParagraph(p, {
      size: NARRATIVE_SECTION_FONT,
      after: idx < paragraphs.length - 1 ? 80 : 0,
    }),
  );
}

function buildConclusionPages(payload) {
  const blocks = [];
  const pages = resolveConclusionPages(payload);
  pages.forEach((pageSections, pageIdx) => {
    const pageChildren = [pageBreakParagraph()];
    if (pageIdx === 0) {
      pageChildren.push(
        textParagraph("Conclusion", { bold: true, size: 32, alignment: AlignmentType.CENTER, after: 240 }),
        textParagraph("6   Conclusion", { bold: true, after: 160, size: NARRATIVE_SECTION_FONT }),
      );
    }
    (pageSections || []).forEach((seg) => {
      const conclusionBlock = [];
      if (seg.showHeader !== false) {
        conclusionBlock.push(
          textParagraph(`6.${seg.sectionNumber}   Department   ${seg.deptLabel || ""}`, {
            bold: true,
            size: INFO_FONT,
          }),
        );
      }
      conclusionBlock.push(
        ...buildConclusionBodyParagraphs(seg.text),
        textParagraph("", { after: 120 }),
      );
      pageChildren.push(...conclusionBlock);
    });
    blocks.push(...pageChildren);
  });
  return blocks;
}

function buildAppendixPages(payload) {
  const blocks = [];
  const pages = resolveAppendixPagesFromPayload(payload);
  if (!pages.length) return blocks;

  blocks.push(pageBreakParagraph());
  let addedAppendicesHeading = false;

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      blocks.push(pageBreakParagraph());
    }
    if (page.showAppendicesHeading && !addedAppendicesHeading) {
      blocks.push(
        textParagraph("Appendices", { bold: true, size: 32, alignment: AlignmentType.CENTER, after: 240 }),
      );
      addedAppendicesHeading = true;
    }
    (page.segments || []).forEach((seg) => {
      if (seg.title && !seg.isContinued) {
        const sectionNum = Number(seg.appendixIndex) + 1;
        blocks.push(
          textParagraph(`7.${sectionNum}   ${seg.title}`, { bold: true, size: NARRATIVE_SECTION_FONT, after: 80 }),
        );
      }
      if (seg.type === "table") {
        if (seg.subtitle && !seg.isContinued) {
          blocks.push(textParagraph(seg.subtitle, { after: 80, size: NARRATIVE_SECTION_FONT }));
        }
        const appendixColDxa = widthsPctToDxa([20, 12, 28, 28, 12], PORTRAIT_CONTENT_WIDTH);
        blocks.push(
          makeTable(
            [
              makeHeaderRow(
                ["Department", "AP No", "Risk Factor", "Risk Indicator", "Risk Level"],
                { columnWidthsDxa: appendixColDxa, headerFill: "8F8F8F", size: INFO_FONT },
              ),
              ...(seg.rows || []).map((row) =>
                makeDataRow(
                  [
                    row.department || "",
                    row.apNo || "",
                    row.riskFactor || "",
                    row.riskIndicator || "",
                    row.riskLevel || "",
                  ],
                  { columnWidthsDxa: appendixColDxa, size: INFO_FONT },
                ),
              ),
            ],
            { columnWidthsDxa: appendixColDxa, contentWidthDxa: PORTRAIT_CONTENT_WIDTH },
          ),
        );
      } else if (String(seg.content ?? "").trim()) {
        String(seg.content)
          .split(/\n/)
          .filter((line) => line.length > 0)
          .forEach((line) => blocks.push(textParagraph(line, { size: NARRATIVE_SECTION_FONT })));
      }
    });
  });
  return blocks;
}

function sectionProps(landscape = false, margins = PAGE_MARGINS) {
  const size = landscape ? PAGE_SIZE_LANDSCAPE : PAGE_SIZE_PORTRAIT;
  return {
    page: {
      margin: margins,
      size: landscape
        ? {
            width: size.width,
            height: size.height,
            orientation: PageOrientation.LANDSCAPE,
          }
        : { width: size.width, height: size.height },
      pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
    },
  };
}

const FOOTER = { default: createReportDocumentFooter() };
const INFO_PAGE_FOOTER = { default: createInfoPageFooter(INFO_FONT) };

function pushSection(sections, landscape, children, margins = PAGE_MARGINS) {
  let kids = stripLeadingPageBreakOnlyParagraphs(children);
  if (landscape) {
    kids = stripTrailingPageBreakOnlyParagraphs(kids);
  } else {
    kids = stripTrailingSpacerParagraphs(kids);
    kids = stripTrailingPageBreakOnlyParagraphs(kids);
  }
  if (!kids.length) return;
  const sectionMargins = landscape ? LANDSCAPE_TABLE_MARGINS : margins;
  sections.push({
    properties: {
      ...sectionProps(landscape, sectionMargins),
      type: SectionType.NEXT_PAGE,
    },
    footers: FOOTER,
    children: kids,
  });
}

function pushHtmlBodySection(sections, children) {
  pushSection(sections, false, children, HTML_BODY_MARGINS);
}

/**
 * Interleave portrait + landscape sections in document order (OnlyOffice-friendly).
 */
/** Teks bebas user di section Findings (mis. "TEST") — dipertahankan saat lock/unlock modul. */
function buildUserFindingsFreeBlock(payload) {
  const html = payload.userFindingsFreeHtml;
  if (!String(html || "").trim()) return [];
  const paras = htmlToDocxParagraphs(html, { bodyAlignment: AlignmentType.JUSTIFY });
  if (!paras.length) return [];
  return paras;
}

function splitPortraitBlocksToParts(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  const parts = [];
  let buf = [];
  for (const block of blocks) {
    if (block?.[PAGE_BREAK_ONLY]) {
      if (buf.length > 0) {
        parts.push({ orientation: "portrait", blocks: buf });
        buf = [];
      }
      continue;
    }
    buf.push(block);
  }
  if (buf.length > 0) {
    parts.push({ orientation: "portrait", blocks: buf });
  }
  return parts;
}

function assembleDocumentSections(frontMatter, findingParts, tailBlocks, options = {}) {
  const oneSectionPerPortraitPart = options.oneSectionPerPortraitPart === true;
  const sections = [];
  let portraitBuf = [...frontMatter];
  let stripPortraitLeadingBreak = false;

  const flushPortrait = () => {
    if (stripPortraitLeadingBreak) {
      portraitBuf = stripLeadingPageBreakOnlyParagraphs(portraitBuf);
      stripPortraitLeadingBreak = false;
    }
    if (portraitBuf.length > 0) {
      pushSection(sections, false, portraitBuf);
      portraitBuf = [];
    }
  };

  const pushPortraitPart = (blocks) => {
    if (oneSectionPerPortraitPart) {
      flushPortrait();
      let kids = blocks || [];
      if (sections.length > 0) {
        kids = stripLeadingPageBreakOnlyParagraphs(kids);
      }
      if (kids.length > 0) {
        pushSection(sections, false, kids);
      }
      return;
    }
    portraitBuf.push(...(blocks || []));
  };

  findingParts.forEach((part) => {
    if (part.orientation === "landscape") {
      flushPortrait();
      let kids = part.blocks || [];
      if (sections.length > 0 || portraitBuf.length > 0) {
        kids = stripLeadingPageBreakOnlyParagraphs(kids);
      }
      pushSection(sections, true, kids);
      stripPortraitLeadingBreak = true;
    } else {
      pushPortraitPart(part.blocks);
    }
  });

  if (oneSectionPerPortraitPart) {
    flushPortrait();
  } else {
    portraitBuf.push(...tailBlocks);
    flushPortrait();
  }

  if (sections.length === 0) {
    pushSection(sections, false, frontMatter);
  }

  return sections;
}

function coverSectionProps() {
  return {
    page: {
      margin: COVER_MARGIN,
      size: { width: PAGE_SIZE_PORTRAIT.width, height: PAGE_SIZE_PORTRAIT.height },
      pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
    },
    titlePage: true,
  };
}

export async function buildTemplateConsolidatedReportDocx(payload) {
  const coverSection = {
    properties: coverSectionProps(),
    children: buildCoverPage(payload),
  };

  const infoSections = [
    {
      properties: {
        ...sectionProps(false),
        type: SectionType.NEXT_PAGE,
      },
      footers: INFO_PAGE_FOOTER,
      children: buildInfoFieldsPage(payload),
    },
    {
      properties: {
        ...sectionProps(false),
        type: SectionType.NEXT_PAGE,
      },
      footers: FOOTER,
      children: buildInfoTeamPage(payload),
    },
    {
      properties: {
        ...sectionProps(false),
        type: SectionType.NEXT_PAGE,
      },
      footers: FOOTER,
      children: buildApprovalPage(payload),
    },
  ];

  const tocSection = {
    properties: {
      ...sectionProps(false),
      type: SectionType.NEXT_PAGE,
    },
    footers: FOOTER,
    children: buildTocPage(payload),
  };

  const narrativeParts =
    payload?.source === "html-preview"
      ? buildNarrativePartsFromPreview(payload)
      : (() => {
          const htmlBodyBlocks = [
            ...buildHtmlContentPages(
              "Executive Summary",
              payload.executiveSummaryPages,
              payload.executiveSummaryHtml,
              undefined,
              { pageBreakBeforeTitle: false },
            ),
            ...buildHtmlContentPages(
              "Audit Objectives and Scope",
              payload.auditObjectivesScopePages,
              payload.auditObjectivesScopeHtml,
              undefined,
              { pageBreakBeforeTitle: true },
            ),
            ...buildHtmlContentPages(
              "Audit Approach and Methodology",
              payload.auditApproachMethodologyPages,
              payload.auditApproachMethodologyHtml,
              undefined,
              { pageBreakBeforeTitle: true },
            ),
          ];
          if (!htmlBodyBlocks.length) return [];
          const htmlBodySections = [];
          pushHtmlBodySection(htmlBodySections, htmlBodyBlocks);
          return htmlBodySections.map((section) => ({
            orientation: "portrait",
            blocks: section.children || [],
          }));
        })();

  const findingParts = buildFindingPagesOrdered(payload);
  const userFindingsFree = buildUserFindingsFreeBlock(payload);
  if (userFindingsFree.length > 0) {
    findingParts.push({ orientation: "portrait", blocks: userFindingsFree });
  }

  const usePreviewFindingChunks =
    Array.isArray(payload.findingPages) && payload.findingPages.length > 0;
  const tailBlocks = [
    ...buildDeptFindingNarrativePages(payload),
    ...(usePreviewFindingChunks ? [] : buildFindingDetailPages(payload)),
    ...buildConclusionPages(payload),
    ...buildAppendixPages(payload),
  ];

  const useHtmlPreviewPageSections = payload?.source === "html-preview";
  const bodyParts = useHtmlPreviewPageSections
    ? [
        ...narrativeParts,
        ...findingParts,
        ...splitPortraitBlocksToParts(tailBlocks),
      ]
    : [...narrativeParts, ...findingParts];

  const sections = [
    coverSection,
    ...infoSections,
    tocSection,
    ...assembleDocumentSections(
      [],
      bodyParts,
      useHtmlPreviewPageSections ? [] : tailBlocks,
      { oneSectionPerPortraitPart: useHtmlPreviewPageSections },
    ),
  ];

  const doc = new Document({
    sections,
    features: {
      updateFields: true,
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return normalizeReportDocx(buffer);
}

export { formatDeptTocTitle };
