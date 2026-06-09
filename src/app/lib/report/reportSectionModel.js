/**
 * Model section laporan — cek SEBELUM DOCX / HTML render.
 * USER sections tidak boleh hilang dari model saat SYSTEM unlock.
 */

import {
  REPORT_SECTION_REGISTRY,
  SECTION_SOURCE,
} from "./reportSections";
import {
  seedPapersFromLegacyState,
  REPORT_PAPER,
} from "./reportPapers";

function legacyUserHasContent(state, field) {
  const v = state?.[field];
  if (field === "conclusionValues") {
    if (!v || typeof v !== "object") return false;
    return Object.values(v).some((t) => String(t ?? "").trim().length > 0);
  }
  if (field === "appendices") {
    return Array.isArray(v) && v.length > 0;
  }
  return String(v ?? "").trim().length > 0;
}

function paperHasContent(papers, paperId, state, legacyField) {
  const entry = papers[paperId];
  if (entry?.hash) return true;
  if (legacyField) return legacyUserHasContent(state, legacyField);
  return false;
}

/**
 * @param {object} state consolidated_report_state row (parsed)
 * @returns {{ sections: object[], summary: object, userPapers: string[], reportBlocksManifest: string[] }}
 */
export function buildReportSectionModel(state = {}) {
  const papers = seedPapersFromLegacyState(state);
  const findingSections = Array.isArray(state.findingSections) ? state.findingSections : [];
  const sections = [];

  for (const def of REPORT_SECTION_REGISTRY) {
    const row = {
      id: def.key,
      type: def.sourceType,
      paperId: def.paperId ?? null,
      /** Section terdaftar di model (paper USER selalu ada setelah report dibuat). */
      inModel: true,
      /** Ada konten tersimpan (boleh kosong placeholder). */
      hasContent: false,
      detail: {},
    };

    if (def.sourceType === SECTION_SOURCE.USER) {
      if (def.paperId) {
        row.hasContent = paperHasContent(papers, def.paperId, state, def.legacyField);
      }
      if (def.key === "appendices") {
        row.inModel = true;
        row.hasContent =
          legacyUserHasContent(state, "appendices") ||
          Boolean(papers[REPORT_PAPER.APPENDICES]?.hash);
      }
      if (def.key === "conclusion") {
        const keys = Object.keys(state.conclusionValues || {}).filter((k) =>
          String(state.conclusionValues[k] ?? "").trim(),
        );
        row.detail.deptWithText = keys;
      }
      if (def.key === "findings_free") {
        row.detail.htmlLength = String(state.userFindingsFreeHtml || "").length;
      }
    }

    if (def.key === "findings_module_tables") {
      row.detail = {
        deptCount: findingSections.length,
        depts: findingSections.map((s) => ({
          deptKey: s.deptKey,
          sopRows: s.sopRows?.length ?? 0,
          auditRows: s.auditRows?.length ?? 0,
          published: s.isPublishedToReport === true,
        })),
        manifestBlockCount: (state.reportBlocks?.manifest || []).length,
      };
      row.hasContent = findingSections.some(
        (s) =>
          (s.sopRows?.length || 0) > 0 ||
          (s.auditRows?.length || 0) > 0 ||
          Boolean(s.executiveSummary),
      );
    }

    sections.push(row);
  }

  const userSections = sections.filter((s) => s.type === "user");
  const systemSections = sections.filter((s) => s.type === "system");

  return {
    sections,
    summary: {
      userInModel: userSections.length,
      userWithContent: userSections.filter((s) => s.hasContent).length,
      systemWithContent: systemSections.filter((s) => s.hasContent).length,
      findingDepts: findingSections.length,
      hubRevision: Number(state.hubRevision) || 0,
      onlyOfficeSyncRevision: Number(state.onlyOfficeSyncRevision) || 0,
    },
    auditVisibleByDept: state.auditVisibleByDept || {},
    userPapers: Object.keys(papers),
    reportBlocksManifest: state.reportBlocks?.manifest || [],
  };
}
