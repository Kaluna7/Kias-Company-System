/** Shared layout tokens aligned with HTML preview (210mm, px-16/24, text-[11px]). */

export const PAGE_SIZE_PORTRAIT = {
  width: 11906,
  height: 16838,
};

export const PAGE_SIZE_LANDSCAPE = {
  width: 16838,
  height: 11906,
  orientation: "landscape",
};

/** ~20mm top/bottom, ~25mm left/right */
export const PAGE_MARGINS = {
  top: 1134,
  right: 1417,
  bottom: 1134,
  left: 1417,
};

/** 2.54 cm all sides (1 inch) — Executive Summary, Audit Objectives, Audit Approach */
export const HTML_BODY_MARGIN_CM = 2.54;
export const HTML_BODY_MARGINS = {
  top: 1440,
  right: 1440,
  bottom: 1440,
  left: 1440,
};

/** 1.5 cm left/right — landscape audit table sections */
export const LANDSCAPE_TABLE_MARGIN_SIDE_CM = 1.5;
const landscapeSideMarginTwips = Math.round((LANDSCAPE_TABLE_MARGIN_SIDE_CM / 2.54) * 1440);

export const LANDSCAPE_TABLE_MARGINS = {
  top: PAGE_MARGINS.top,
  right: landscapeSideMarginTwips,
  bottom: PAGE_MARGINS.bottom,
  left: landscapeSideMarginTwips,
};

/** Printable width inside margins (twips) — for fixed table columns in Word/OnlyOffice */
export const PORTRAIT_CONTENT_WIDTH =
  PAGE_SIZE_PORTRAIT.width - PAGE_MARGINS.left - PAGE_MARGINS.right;
export const LANDSCAPE_CONTENT_WIDTH =
  PAGE_SIZE_LANDSCAPE.width - LANDSCAPE_TABLE_MARGINS.left - LANDSCAPE_TABLE_MARGINS.right;

/** Body area inside page margins (twips). */
export const PAGE_BODY_HEIGHT =
  PAGE_SIZE_PORTRAIT.height - PAGE_MARGINS.top - PAGE_MARGINS.bottom;

/** Reserve space for document footer on pages 2+ so fixed layouts stay on one sheet. */
export const FOOTER_RESERVE_TWIPS = 720;

/** Printable height when footer is shown (info pages 2–4, findings, etc.). */
export const CONTENT_BODY_HEIGHT = PAGE_BODY_HEIGHT - FOOTER_RESERVE_TWIPS;

export const SOP_TABLE_WIDTHS_PCT = [4, 42, 18, 18, 18];
/** Audit grid: narrow Risk ID / Details / AP Code; wide Finding Description */
export const AUDIT_TABLE_WIDTHS_PCT = [4, 6, 5, 6, 7, 7, 8, 13, 25, 9.5, 9.5];
/** Minimum width for "No" column so row numbers stay on one line */
export const FINDING_TABLE_NO_COL_MIN_TWIPS = 520;

export const FONT = "Times New Roman";
export const BODY_SIZE = 22; // 11pt
export const SMALL_SIZE = 18; // 9pt
export const TABLE_SIZE = 12; // 6pt — appendix / misc tables
export const AUDIT_TABLE_SIZE = 11; // legacy header default in helpers
/** 10pt — SOP Review & Audit Findings table data (matches HTML text-[10px]) */
export const FINDING_TABLE_DATA_SIZE = 20;
/** Per-column half-points for audit findings grid (11 columns) — uniform 10pt */
export const AUDIT_TABLE_CELL_SIZES = Array(11).fill(FINDING_TABLE_DATA_SIZE);
export const TITLE_SIZE = 32; // 16pt
export const H1_SIZE = 28; // 14pt
