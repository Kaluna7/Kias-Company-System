import crypto from "crypto";

/**
 * "Paper" = User Section yang disimpan terpisah (lihat `reportSections.js`).
 *
 * - USER papers: disimpan dari OnlyOffice, tidak di-regenerate dari modul.
 * - MODULE_DRIVEN_PAPER (`findings-module`): satu-satunya bagian SYSTEM di area
 *   Findings — tabel SOP / audit / exec-summary dept.
 *
 * Regenerate DOCX = DOCX user terakhir + update SYSTEM saja (bukan replace penuh).
 */
export const REPORT_PAPER = {
  FRONT_MATTER: "front-matter",
  EXECUTIVE_SUMMARY: "executive-summary",
  AUDIT_OBJECTIVES: "audit-objectives",
  AUDIT_APPROACH: "audit-approach",
  /** Teks bebas user di area findings (bukan tabel modul). */
  FINDINGS_FREE: "findings-free",
  CONCLUSION: "conclusion",
  APPENDICES: "appendices",
};

/** Di-reset / di-regenerate dari modul — bukan disimpan sebagai narasi utuh dari Word. */
export const MODULE_DRIVEN_PAPER = "findings-module";

export const USER_EDITABLE_PAPERS = [
  REPORT_PAPER.FRONT_MATTER,
  REPORT_PAPER.EXECUTIVE_SUMMARY,
  REPORT_PAPER.AUDIT_OBJECTIVES,
  REPORT_PAPER.AUDIT_APPROACH,
  REPORT_PAPER.FINDINGS_FREE,
  REPORT_PAPER.CONCLUSION,
  REPORT_PAPER.APPENDICES,
];

/** Mapping paper → field legacy di consolidated_report_state. */
export const PAPER_LEGACY_FIELD = {
  [REPORT_PAPER.FRONT_MATTER]: "wordFrontMatterHtml",
  [REPORT_PAPER.EXECUTIVE_SUMMARY]: "executiveSummaryHtml",
  [REPORT_PAPER.AUDIT_OBJECTIVES]: "auditObjectivesScopeHtml",
  [REPORT_PAPER.AUDIT_APPROACH]: "auditApproachMethodologyHtml",
  [REPORT_PAPER.FINDINGS_FREE]: "userFindingsFreeHtml",
  [REPORT_PAPER.CONCLUSION]: "conclusionValues",
  [REPORT_PAPER.APPENDICES]: "wordAppendicesHtml",
};

export function hashPaperContent(value) {
  const raw =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "").trim();
  if (!raw) return "";
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/** @param {object} extracted dari docxToPreviewState */
export function mapExtractedDocxToPapers(extracted, userFindingsFreeHtml = "") {
  if (!extracted?.ok) return {};
  return {
    [REPORT_PAPER.FRONT_MATTER]: extracted.wordFrontMatterHtml || "",
    [REPORT_PAPER.EXECUTIVE_SUMMARY]: extracted.executiveSummaryHtml || "",
    [REPORT_PAPER.AUDIT_OBJECTIVES]: extracted.auditObjectivesScopeHtml || "",
    [REPORT_PAPER.AUDIT_APPROACH]: extracted.auditApproachMethodologyHtml || "",
    [REPORT_PAPER.FINDINGS_FREE]: userFindingsFreeHtml || "",
    [REPORT_PAPER.CONCLUSION]: extracted.conclusionValues || {},
    [REPORT_PAPER.APPENDICES]: extracted.wordAppendicesHtml || "",
  };
}

/** Merge hanya paper yang berubah (save per paper). */
export function mergeChangedPapers(existingPapers = {}, incomingByPaper = {}) {
  const papers = { ...existingPapers };
  const changedPaperIds = [];

  for (const paperId of USER_EDITABLE_PAPERS) {
    const incoming = incomingByPaper[paperId];
    if (incoming == null) continue;

    const hash = hashPaperContent(incoming);
    if (!hash) continue;

    const prev = papers[paperId];
    if (prev?.hash === hash) continue;

    papers[paperId] = {
      html: typeof incoming === "string" ? incoming : undefined,
      data: typeof incoming === "object" ? incoming : undefined,
      hash,
      revision: Number(prev?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    changedPaperIds.push(paperId);
  }

  return { papers, changedPaperIds };
}

/** Legacy fields untuk template builder + HTML preview. */
export function legacyFieldsFromPapers(papers = {}, existingState = {}) {
  const out = { ...existingState };
  for (const [paperId, field] of Object.entries(PAPER_LEGACY_FIELD)) {
    const entry = papers[paperId];
    if (!entry) continue;
    if (field === "conclusionValues" && entry.data) {
      out.conclusionValues = entry.data;
    } else if (entry.html != null && String(entry.html).trim()) {
      out[field] = entry.html;
    }
  }
  return out;
}

/** Seed reportPapers dari state lama (migrasi sekali). */
export function seedPapersFromLegacyState(state = {}) {
  const papers = { ...(state.reportPapers || {}) };
  for (const [paperId, field] of Object.entries(PAPER_LEGACY_FIELD)) {
    if (papers[paperId]?.hash) continue;
    const value = state[field];
    if (value == null || (typeof value === "string" && !value.trim())) continue;
    if (field === "conclusionValues" && typeof value === "object") {
      const hash = hashPaperContent(value);
      if (!hash) continue;
      papers[paperId] = { data: value, hash, revision: 1, updatedAt: state.hubSyncedAt };
    } else if (typeof value === "string" && value.trim()) {
      papers[paperId] = {
        html: value,
        hash: hashPaperContent(value),
        revision: 1,
        updatedAt: state.hubSyncedAt,
      };
    }
  }
  return papers;
}
