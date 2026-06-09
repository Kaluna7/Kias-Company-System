/**
 * Registry resmi: System Sections vs User Sections.
 *
 * Prinsip:
 * - USER  → diedit di OnlyOffice, disimpan ke hub/DB, tidak pernah di-regenerate dari modul.
 * - SYSTEM → dihasilkan dari modul (SOP Review, Audit Review), boleh di-patch/hapus/sisip
 *            tanpa menyentuh blok USER.
 *
 * Regenerate DOCX = DOCX terakhir + ekstrak USER + update SYSTEM + gabung.
 * Bukan: HTML preview → generate penuh → replace seluruh file.
 */

import { REPORT_PAPER, MODULE_DRIVEN_PAPER } from "./reportPapers";
import { BLOCK_KIND } from "./reportBlocks";

export const SECTION_SOURCE = {
  USER: "user",
  SYSTEM: "system",
};

/**
 * @typedef {object} ReportSectionDef
 * @property {string} key — section_key (DB / API)
 * @property {"user"|"system"} sourceType
 * @property {string} [paperId] — REPORT_PAPER untuk narasi utuh
 * @property {string} [legacyField] — field di consolidated_report_state
 * @property {string} [blockIdPrefix] — prefix block Word (sys: / user:)
 * @property {string} [description]
 */

/** @type {ReportSectionDef[]} */
export const REPORT_SECTION_REGISTRY = [
  {
    key: "cover",
    sourceType: SECTION_SOURCE.SYSTEM,
    paperId: REPORT_PAPER.FRONT_MATTER,
    legacyField: "wordFrontMatterHtml",
    description: "Cover & halaman pembuka — template awal; narasi bisa diedit user lalu disimpan sebagai paper.",
  },
  {
    key: "executive_summary",
    sourceType: SECTION_SOURCE.USER,
    paperId: REPORT_PAPER.EXECUTIVE_SUMMARY,
    legacyField: "executiveSummaryHtml",
    blockIdPrefix: "user:narrative:executive-summary",
    description: "Executive Summary laporan — teks bebas OnlyOffice.",
  },
  {
    key: "audit_objectives_scope",
    sourceType: SECTION_SOURCE.USER,
    paperId: REPORT_PAPER.AUDIT_OBJECTIVES,
    legacyField: "auditObjectivesScopeHtml",
    blockIdPrefix: "user:narrative:audit-objectives",
    description: "Objectives & Scope — teks bebas OnlyOffice.",
  },
  {
    key: "audit_approach_methodology",
    sourceType: SECTION_SOURCE.USER,
    paperId: REPORT_PAPER.AUDIT_APPROACH,
    legacyField: "auditApproachMethodologyHtml",
    blockIdPrefix: "user:narrative:audit-approach",
    description: "Approach & Methodology — teks bebas OnlyOffice.",
  },
  {
    key: "findings_free",
    sourceType: SECTION_SOURCE.USER,
    paperId: REPORT_PAPER.FINDINGS_FREE,
    legacyField: "userFindingsFreeHtml",
    description:
      "Teks bebas user di area Findings (finding/recommendation narasi) — tidak dari modul.",
  },
  {
    key: "findings_module_tables",
    sourceType: SECTION_SOURCE.SYSTEM,
    paperId: MODULE_DRIVEN_PAPER,
    blockIdPrefix: "sys:finding:",
    description:
      "Tabel modul di Findings & Recommendations: SOP (selalu), Audit + exec-summary dept (lock/unlock).",
  },
  {
    key: "conclusion",
    sourceType: SECTION_SOURCE.USER,
    paperId: REPORT_PAPER.CONCLUSION,
    legacyField: "conclusionValues",
    blockIdPrefix: "user:conclusion:",
    description: "Conclusion per department — teks OnlyOffice.",
  },
  {
    key: "appendices",
    sourceType: SECTION_SOURCE.USER,
    paperId: REPORT_PAPER.APPENDICES,
    legacyField: "wordAppendicesHtml",
    blockIdPrefix: "user:appendix:",
    description: "Lampiran — konten diedit user; tabel evidence/asset di masa depan bisa SYSTEM terpisah.",
  },
];

const byKey = new Map(REPORT_SECTION_REGISTRY.map((s) => [s.key, s]));

export function getReportSection(key) {
  return byKey.get(key) || null;
}

export function sectionsBySource(sourceType) {
  return REPORT_SECTION_REGISTRY.filter((s) => s.sourceType === sourceType);
}

export function userSectionKeys() {
  return sectionsBySource(SECTION_SOURCE.USER).map((s) => s.key);
}

export function systemSectionKeys() {
  return sectionsBySource(SECTION_SOURCE.SYSTEM).map((s) => s.key);
}

/** Section yang tidak boleh disentuh saat modul lock/unlock / SOP berubah. */
export function mustPreserveOnModuleSync() {
  return sectionsBySource(SECTION_SOURCE.USER);
}

/** Hanya bagian ini yang boleh di-patch/delete/insert di DOCX saat modul berubah. */
export function moduleDrivenSectionKeys() {
  return ["findings_module_tables"];
}

export function sectionSourceType(sectionKey) {
  return getReportSection(sectionKey)?.sourceType || SECTION_SOURCE.USER;
}

export function isSystemSection(sectionKey) {
  return sectionSourceType(sectionKey) === SECTION_SOURCE.SYSTEM;
}

export function isUserSection(sectionKey) {
  return sectionSourceType(sectionKey) === SECTION_SOURCE.USER;
}

/** Mapping ke konsep DB `report_sections` (belum tabel terpisah — field di consolidated_report_state). */
export function toReportSectionRow(sectionKey, content, reportYear) {
  const def = getReportSection(sectionKey);
  if (!def) return null;
  return {
    report_year: reportYear,
    section_key: sectionKey,
    source_type: def.sourceType,
    content,
    paper_id: def.paperId || null,
    legacy_field: def.legacyField || null,
  };
}

export { BLOCK_KIND, SECTION_SOURCE as SOURCE_TYPE };
