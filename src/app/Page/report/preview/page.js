"use client";

export const dynamic = "force-dynamic";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react";
import { sortByRiskId } from "@/app/utils/sortByRiskId";
import {
  buildDeptExecutiveSummaryFromRow,
  executiveSummaryRowHasContent,
  isAuditReviewLocked,
  parseStoredJsonList,
} from "@/app/utils/parseStoredJsonList";
import { AUDIT_REVIEW_PUBLISH_CHANGED_KEY } from "@/app/lib/audit-review/reportPublishLockClient";
import { useReportAuditPublishRealtime } from "@/app/lib/audit-review/useReportAuditPublishRealtime";
import { isDeptPublishedToReport } from "@/app/lib/report/applyPublishStateToFindingSections";
import {
  applyPublishStateToFindingSections,
  filterFindingSectionsForDisplay,
} from "@/app/lib/report/applyPublishStateToFindingSections";
import {
  buildEffectivePublishMap,
  computeCoverSnapshotHash,
  computePreviewSnapshotHash,
  findingSectionsLookCorrupted,
  mergeModuleSectionsForHub,
  syncAuditVisibleFromLockedByDept,
} from "@/app/lib/report/previewAuditVisibility";
import { computeModuleTablesHash } from "@/app/lib/report/moduleTablesHash";
import { filterFindingPagesForPreview } from "@/app/lib/report/filterPreviewPayloadForDocx";
import { buildConclusionDeptSegments } from "@/app/lib/report/conclusionSegments";
import { buildAppendixPages } from "@/app/lib/report/appendixPages";
import {
  collectHiddenAuditEdits,
  mergePreservedFindingSections,
  stripFindingSectionsForClient,
} from "@/app/lib/report/mergePreservedFindingSections";
import {
  getReportCollaborationStatus,
  notifyOnlyOfficeSessionOpened,
  syncReportDocxFromPreview,
} from "@/app/lib/report/exportReportClient";
import {
  getPreviewTabClientId,
  pushOnlyOfficeRedirectToPeers,
  pushPreviewStateToPeers,
} from "@/app/lib/report/previewWebSocketClient";
import {
  clearClientReportProgress,
  getClientReportResetGeneration,
  getClientResetGenerationKey,
  markClientReportReset,
} from "@/app/lib/report/reportProgressStorage";
import { usePreviewHubAutoRefresh } from "@/app/lib/report/usePreviewHubAutoRefresh";
import { getHubRevision } from "@/app/lib/report/reportPreviewHub";
import { useSopReviewRealtime } from "@/app/lib/sop-review/useSopReviewRealtime";
import { loadFindingSectionsFromModules } from "@/app/lib/report/loadFindingSectionsFromModules";
import { pickNarrativeFromReportState } from "@/app/lib/report/reportStateNarrative";
import { usePreviewCollaboration } from "@/app/lib/report/usePreviewCollaboration";
import PreviewCollaborationBar from "./PreviewCollaborationBar";
import { buildPersistPayloadWithProtectedNarrative } from "@/app/lib/report/mergeReportStateForPersist";
import {
  BLOCK_KIND,
  systemFindingSopBlockId,
  systemFindingAuditBlockId,
  reportBlockHtmlProps,
} from "@/app/lib/report/reportBlocks";
import { formatDeptTocTitle } from "@/app/lib/report/docx/templateTitles";
import {
  filterMeaningfulHtmlPages,
  htmlPageHasVisibleContent,
} from "@/app/lib/report/docx/htmlPageUtils";
import { resolveAuditTeamRows } from "@/app/lib/report/auditTeamDefaults";
import {
  COVER_FONT,
  COVER_GOLD,
  COVER_NAVY,
  COVER_SUBTITLE,
  COVER_TAGLINE,
  COVER_YEAR_WHITE,
  COVER_YEAR_SIZE,
} from "@/app/lib/report/coverLayout";
import {
  parseDateForHtmlInput,
  resolvePreparedByRows,
} from "@/app/lib/report/preparedByDefaults";
import { AUDIT_TABLE_WIDTHS_PCT } from "@/app/lib/report/docx/templateStyles";

const REPORT_DEPARTMENTS = [
  { key: "finance", label: "FINANCE", apiPath: "finance" },
  { key: "accounting", label: "ACCOUNTING", apiPath: "accounting" },
  { key: "hrd", label: "HRD", apiPath: "hrd" },
  { key: "ga", label: "GENERAL & AFFAIR", apiPath: "g&a" },
  { key: "sdp", label: "STORE DESIGN & PLANNER", apiPath: "sdp" },
  { key: "tax", label: "TAX", apiPath: "tax" },
  { key: "lp", label: "SECURITY", apiPath: "l&p" },
  { key: "mis", label: "MANAGEMENT INFORMATION SYS.", apiPath: "mis" },
  { key: "merch", label: "MERCHANDISE", apiPath: "merch" },
  { key: "ops", label: "OPERATIONAL", apiPath: "ops" },
  { key: "whs", label: "WAREHOUSE", apiPath: "whs" },
];

function auditTableColgroup() {
  return AUDIT_TABLE_WIDTHS_PCT.map((w, i) => (
    <col key={`audit-col-${i}`} style={{ width: `${w}%` }} />
  ));
}

function computeReportTotalPages({
  executiveSummaryEndPage,
  auditObjectivesEndPage,
  auditApproachEndPage,
  findingsPageStartNumber,
  findingPagesLength,
  findingDetailPagesLength,
  showConclusionPaper,
  conclusionPagesLength,
  showAppendixPaper,
  appendixPageBase,
  appendixPagesLength,
}) {
  let max = 4;
  max = Math.max(max, executiveSummaryEndPage || 0);
  max = Math.max(max, auditObjectivesEndPage || 0);
  max = Math.max(max, auditApproachEndPage || 0);

  if (findingPagesLength > 0) {
    max = Math.max(max, findingsPageStartNumber + findingPagesLength - 1);
  }
  if (findingDetailPagesLength > 0) {
    max = Math.max(
      max,
      findingsPageStartNumber + findingPagesLength + findingDetailPagesLength - 1,
    );
  }

  const conclusionStartPage =
    findingsPageStartNumber + findingPagesLength + findingDetailPagesLength;

  if (showConclusionPaper) {
    const conclusionCount = conclusionPagesLength > 0 ? conclusionPagesLength : 1;
    max = Math.max(max, conclusionStartPage + conclusionCount);
  }

  if (showAppendixPaper) {
    const appendixCount = Math.max(appendixPagesLength, 1);
    max = Math.max(max, appendixPageBase + appendixCount - 1);
  }

  return max;
}

function ReportPageFooter({ pageNumber, totalPages, textSize = "text-[6px]", wrapperClass = "" }) {
  return (
    <div className={`w-full mt-auto ${wrapperClass}`}>
      <div className="border-t border-gray-300 mb-2" />
      <div className={`flex items-center ${textSize} text-gray-700`}>
        <div className="flex-1 text-left">
          SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
        </div>
        <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
        <div className="flex-1 text-right">
          PAGE <span className="mx-1">{pageNumber}</span> of{" "}
          <span className="ml-1">{totalPages}</span>
        </div>
      </div>
    </div>
  );
}

// Konfigurasi untuk \"Department completion date\".
// - monthIndex: bulan audit (1 = Jan, 2 = Feb, ...), dipakai untuk hitung tanggal selesai
//   berdasarkan tahun audit (year) dan akhir bulan tsb.
// - Urutan array menentukan urutan tampil; PAGE akan dihitung dinamis
//   dari halaman pertama modul department (misalnya 8).
const REPORT_DEPARTMENT_COMPLETION_ROWS = [
  { deptKey: "finance", name: "FINANCE", monthIndex: 1 },
  { deptKey: "hrd", name: "HUMAN RESOURCES", monthIndex: 2 },
  { deptKey: "ops", name: "OPERATIONAL", monthIndex: 4 },
  { deptKey: "merch", name: "MERCHANDISE", monthIndex: 5 },
  { deptKey: "whs", name: "WAREHOUSE", monthIndex: 7 },
  { deptKey: "lp", name: "SECURITY", monthIndex: 8 },
  { deptKey: "accounting", name: "ACCOUNTING", monthIndex: 8 },
  { deptKey: "mis", name: "MANAGEMENT INFORMATION SYS.", monthIndex: 11 },
  { deptKey: "ga", name: "GENERAL & AFFAIR", monthIndex: 11 },
];

const DEFAULT_APPENDICES = [
  {
    id: "appendix-a",
    type: "text",
    title: "Appendix A - Audit Timelines",
    content: "",
  },
  {
    id: "appendix-b",
    type: "text",
    title: "Appendix B - Samples Selection Methodology",
    content:
      "Overview of Sampling Methods:\n[Description of the random and judgmental sampling methods used.]\n\nPopulation Description:\n[Details of the total population from which samples were drawn (e.g., number of transactions, documents).]\n\nSample Size Calculation:\n[Explanation of how the sample size was determined, including confidence levels and margins of error.]\n\nSelection Criteria:\n[Specific criteria used for judgmental sampling, including definitions of high-risk areas.]",
  },
  {
    id: "appendix-c",
    type: "table",
    title: "Appendix C - Risk Assessments",
    content: "Risk Matrix",
    tableRows: Array.from({ length: 12 }, () => ({
      department: "",
      apNo: "",
      riskFactor: "",
      riskIndicator: "",
      riskLevel: "",
    })),
  },
];

/** Conclusion & Appendices narrative text — 11pt; appendix tables stay 10pt. */
const CONCLUSION_APPENDIX_TEXT_CLASS = "text-[11px]";

/** Keep long/unbroken text inside table-fixed cells (no bleed into next column). */
const APPENDIX_TABLE_CELL_WRAP =
  "max-w-0 min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word]";
const APPENDIX_TABLE_INPUT =
  "w-full min-w-0 min-h-8 px-2 py-1 text-[10px] bg-transparent border-none focus:outline-none resize-none break-words [overflow-wrap:anywhere] [word-break:break-word]";
const EXECUTIVE_SUMMARY_PAGE_SAFE_PX = 190;
const EXECUTIVE_SUMMARY_FIRST_PAGE_EXTRA_PX = 72;
const AUDIT_APPROACH_PAGE_SAFE_PX = 240;
const AUDIT_APPROACH_FIRST_PAGE_EXTRA_PX = 100;
const EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS = 320;
/** Short lists stay one block so bullets are not forced to the next page alone. */
const LIST_KEEP_TOGETHER_MAX_ITEMS = 12;
const LIST_KEEP_TOGETHER_MAX_CHARS = 1400;
const CONCLUSION_PARAGRAPH_SPLIT_CHARS = 280;
/** Keep each SOP row as one <tr>; long text wraps inside cells (pagination splits whole rows). */
const SOP_RELATED_ROW_SPLIT_CHARS = 0;
const SOP_REVIEW_ROW_SPLIT_CHARS = 0;
/** Keep each audit row as one <tr>; long text wraps inside cells (pagination splits whole rows). */
const AUDIT_RISK_DETAILS_SPLIT_CHARS = 0;
const AUDIT_SUBSTANTIVE_TEST_SPLIT_CHARS = 0;
const AUDIT_METHODOLOGY_SPLIT_CHARS = 0;
const AUDIT_FINDING_RESULT_SPLIT_CHARS = 0;
const AUDIT_FINDING_DESCRIPTION_SPLIT_CHARS = 0;
const AUDIT_AUDITEE_COMMENT_SPLIT_CHARS = 0;
const AUDIT_FOLLOW_UP_DETAIL_SPLIT_CHARS = 0;

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitLongPlainText(text, maxChars = EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  if (normalized.length <= maxChars) return [normalized];

  const chunks = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    let splitAt = Math.max(
      remaining.lastIndexOf(". ", maxChars),
      remaining.lastIndexOf("; ", maxChars),
      remaining.lastIndexOf(", ", maxChars),
      remaining.lastIndexOf(" ", maxChars),
    );

    if (splitAt <= Math.floor(maxChars * 0.5)) {
      splitAt = maxChars;
    }

    const part = remaining.slice(0, splitAt).trim();
    if (part) chunks.push(part);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.length > 0 ? chunks : [normalized];
}

function splitConclusionTextIntoChunks(text) {
  const paragraphs = String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  return paragraphs.flatMap((paragraph) =>
    splitLongPlainText(paragraph, CONCLUSION_PARAGRAPH_SPLIT_CHARS).filter(Boolean),
  );
}

function paginateConclusionSegments(segments, heights, options = {}) {
  const spacing = options.spacing ?? 18;
  const limitFirst = options.limitFirst ?? 700;
  const limitPage = options.limitPage ?? 780;
  const chunks = [];
  let chunk = [];
  let sum = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const h = heights[i] ?? 80;
    const limit = chunks.length === 0 && chunk.length === 0 ? limitFirst : limitPage;

    if (h > limit) {
      if (chunk.length > 0) {
        chunks.push(chunk);
        chunk = [];
        sum = 0;
      }
      const textParts = splitConclusionTextIntoChunks(segment.text);
      if (textParts.length <= 1) {
        chunks.push([segment]);
        continue;
      }
      const approxPartH = h / textParts.length;
      textParts.forEach((text, partIdx) => {
        const part = {
          ...segment,
          text,
          showHeader: partIdx === 0,
          chunkIndex: partIdx,
        };
        if (sum + approxPartH + spacing > limit && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
        }
        chunk.push(part);
        sum += approxPartH + spacing;
      });
      continue;
    }

    if (sum + h + spacing > limit && chunk.length > 0) {
      chunks.push(chunk);
      chunk = [];
      sum = 0;
    }
    chunk.push(segment);
    sum += h + spacing;
  }

  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

function splitTableCellText(text, maxChars) {
  const value = String(text ?? "").trim();
  if (!value) return [];
  if (!maxChars || maxChars < 1) return [value];
  return splitLongPlainText(value, maxChars).filter(Boolean);
}

function estimateWrappedLines(text, charsPerLine) {
  const value = String(text ?? "");
  if (!value.trim()) return 1;
  return value
    .split(/\r?\n/)
    .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / Math.max(1, charsPerLine))), 0);
}

function expandSopRowsForPagination(rows = []) {
  return rows.flatMap((row) => {
    const sopChunks = splitTableCellText(row.sopRelated, SOP_RELATED_ROW_SPLIT_CHARS);
    const reviewChunks = splitTableCellText(row.reviewComment, SOP_REVIEW_ROW_SPLIT_CHARS);
    const parts = Math.max(sopChunks.length, reviewChunks.length, 1);

    return Array.from({ length: parts }, (_, idx) => ({
      ...row,
      no: idx === 0 ? row.no : "",
      sopRelated: sopChunks[idx] || "",
      reviewComment: reviewChunks[idx] || "",
      auditeeComment: idx === 0 ? row.auditeeComment : "",
      followUpDetail: idx === 0 ? row.followUpDetail : "",
      __continuedRow: idx > 0,
    }));
  });
}

function getDefaultReportCoverInfo(year) {
  const y = Number(year) || new Date().getFullYear();
  return {
    periodStart: `JANUARY ${y}`,
    periodEnd: `DECEMBER ${y}`,
    auditCoverage: "FINANCIAL PROCESSES AND COMPLIANCE",
    departmentCoverage: "ALL DEPARTMENT",
    area: "BALI, JAKARTA, MEDAN AND BATAM",
  };
}

function expandAuditRowsForPagination(rows = []) {
  return rows.flatMap((row) => {
    const riskDetailsChunks = splitTableCellText(row.riskDetails, AUDIT_RISK_DETAILS_SPLIT_CHARS);
    const substantiveTestChunks = splitTableCellText(row.substantiveTest, AUDIT_SUBSTANTIVE_TEST_SPLIT_CHARS);
    const methodologyChunks = splitTableCellText(row.methodology, AUDIT_METHODOLOGY_SPLIT_CHARS);
    const findingResultChunks = splitTableCellText(row.findingResult, AUDIT_FINDING_RESULT_SPLIT_CHARS);
    const findingDescriptionChunks = splitTableCellText(row.findingDescription, AUDIT_FINDING_DESCRIPTION_SPLIT_CHARS);
    const auditeeCommentChunks = splitTableCellText(row.auditeeComment, AUDIT_AUDITEE_COMMENT_SPLIT_CHARS);
    const followUpDetailChunks = splitTableCellText(row.followUpDetail, AUDIT_FOLLOW_UP_DETAIL_SPLIT_CHARS);
    const parts = Math.max(
      riskDetailsChunks.length,
      substantiveTestChunks.length,
      methodologyChunks.length,
      findingResultChunks.length,
      findingDescriptionChunks.length,
      auditeeCommentChunks.length,
      followUpDetailChunks.length,
      1,
    );

    return Array.from({ length: parts }, (_, idx) => ({
      ...row,
      no: idx === 0 ? row.no : "",
      riskId: idx === 0 ? row.riskId : "",
      riskLevel: idx === 0 ? row.riskLevel : "",
      apCode: idx === 0 ? row.apCode : "",
      riskDetails: riskDetailsChunks[idx] || "",
      substantiveTest: substantiveTestChunks[idx] || "",
      methodology: methodologyChunks[idx] || "",
      findingResult: findingResultChunks[idx] || "",
      findingDescription: findingDescriptionChunks[idx] || "",
      auditeeComment: auditeeCommentChunks[idx] || "",
      followUpDetail: followUpDetailChunks[idx] || "",
      __continuedRow: idx > 0,
    }));
  });
}


function isSerializedEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function createDefaultExecutiveSummaryHtml(year) {
  return `
      <p><strong>1.&nbsp;&nbsp;Executive Summary</strong></p>
      <p>
        This executive summary provides a high-level overview of the internal audit performed for the fiscal year ending ${year}. The objective of the audit was to evaluate the effectiveness of key internal controls, risk management practices, and compliance with applicable policies and regulations across the organization.
      </p>
      <p><strong>1.1&nbsp;&nbsp;Introduction</strong></p>
      <p>
        The purpose of this internal audit report is to present an independent assessment of the organization's internal control environment and its alignment with strategic objectives. The audit focused on identifying control gaps, areas of non-compliance, and opportunities to enhance process efficiency and governance.
      </p>
      <p>
        Our work was conducted in accordance with generally accepted internal auditing standards and the company's internal audit charter. The scope and approach were designed to provide reasonable assurance over key financial and operational processes.
      </p>
      <p><strong>1.2&nbsp;&nbsp;Scope of the Audit</strong></p>
      <p>
        The audit covered activities and processes across the following departments:
      </p>
      <ul>
        <li><strong>Finance:</strong> Cash management, budgeting, treasury, and financial reporting.</li>
        <li><strong>Accounting:</strong> General ledger, accounts payable, accounts receivable, and closing processes.</li>
        <li><strong>Human Resources (HRD):</strong> Recruitment, payroll, employee data management, and benefits administration.</li>
        <li><strong>General Affairs:</strong> Facility management and administration of general services.</li>
        <li><strong>Operational:</strong> Store operations, stock management, and customer-facing processes.</li>
        <li><strong>Warehouse:</strong> Inventory management, inbound and outbound logistics, and stock accuracy.</li>
        <li><strong>Security (L&amp;P):</strong> Loss prevention, store security, and safeguarding of company assets.</li>
        <li><strong>Merchandise:</strong> Vendor management, pricing, and assortment planning.</li>
        <li><strong>MIS:</strong> IT governance, application controls, user access management, and system support.</li>
        <li><strong>Tax:</strong> Compliance with tax regulations and timely submission of tax returns.</li>
      </ul>
      <p><strong>1.3&nbsp;&nbsp;Key Findings</strong></p>
      <p>
        Overall, the audit identified a combination of strengths and weaknesses across the audited areas. While several controls are operating effectively, there are also gaps that may expose the organization to operational, financial, and compliance risks.
      </p>
      <p><strong>1.4&nbsp;&nbsp;Conclusion</strong></p>
      <p><strong>1.5&nbsp;&nbsp;Summary of Key Recommendations</strong></p>
    `;
}

function createDefaultAuditObjectivesScopeHtml() {
  return `
      <p><strong>2.&nbsp;&nbsp;Audit Objectives and Scope</strong></p>
      <p><strong>2.1&nbsp;&nbsp;Objectives</strong></p>
      <p>The overarching objectives of this audit were:</p>
      <ul>
        <li>To evaluate the adequacy and effectiveness of internal controls across multiple departments.</li>
        <li>To assess compliance with organizational policies, external regulations, and industry best practices.</li>
        <li>To identify opportunities for process improvements and operational efficiency.</li>
        <li>To assess the risk management practices in place within each department.</li>
      </ul>
      <p><strong>2.2&nbsp;&nbsp;Scope</strong></p>
      <p>The audit covered the following departments:</p>
      <ul>
        <li><strong>Finance:</strong> Focused on cash management, budgeting, and financial reporting.</li>
        <li><strong>Accounting:</strong> Reviewed general ledger, accounts payable, accounts receivable, and financial closing procedures.</li>
        <li><strong>Human Resources (HRD):</strong> Examined employee recruitment, onboarding, payroll, and compliance with labor laws.</li>
        <li><strong>General Affairs:</strong> Reviewed procurement, office services, and facilities management.</li>
        <li><strong>Store Design &amp; Planning:</strong> Assessed project management processes and resource allocation for new store developments.</li>
        <li><strong>Tax:</strong> Focused on tax reporting, filing, and reconciliation.</li>
        <li><strong>Security:</strong> Reviewed physical security measures, access controls, and incident response processes.</li>
        <li><strong>Management Information Systems (MIS):</strong> Assessed data security, access controls, and disaster recovery planning.</li>
        <li><strong>Merchandise:</strong> Focused on inventory management, vendor relationships, and pricing strategies.</li>
        <li><strong>Operational:</strong> Examined the effectiveness of day-to-day operational processes.</li>
        <li><strong>Warehouse:</strong> Reviewed inventory control, stock management, and logistics efficiency.</li>
      </ul>
    `;
}

function createDefaultAuditApproachMethodologyHtml() {
  return `
      <p><strong>3.&nbsp;&nbsp;Audit Approach and Methodology</strong></p>
      <p><strong>3.1&nbsp;&nbsp;Audit Approach</strong></p>
      <p>The audit followed a risk-based approach, focusing on areas with higher potential for non-compliance, operational inefficiencies, and financial risks. The methods used included:</p>
      <p><strong>Document Review:</strong> Reviewed policies, procedures, financial statements, trial balances, HR records, security logs, and project management documentation.</p>
      <p><strong>Interviews:</strong> Conducted discussions with department heads and key personnel to understand current processes, controls, and challenges.</p>
      <p><strong>Data Analysis:</strong> Analyzed financial data, tax filings, inventory reports, and payroll records to identify discrepancies and unusual trends.</p>
      <p><strong>Process Walkthroughs:</strong> Observed key processes in operation, such as cash handling, inventory management, and onboarding procedures.</p>
      <p><strong>Sampling:</strong> Selected representative transactions, employee files, and inventory records for detailed testing.</p>
      <p><strong>3.2&nbsp;&nbsp;Standards Followed</strong></p>
      <p>The audit was conducted in accordance with the <strong>International Standards for the Professional Practice of Internal Auditing (IIA Standards)</strong> and complied with the company&apos;s internal audit charter, internal policies, and applicable regulatory requirements.</p>
      <p><strong>3.3&nbsp;&nbsp;Sampling Methodology</strong></p>
      <p>The sampling methodology for this internal audit employed two primary approaches: <strong>random sampling</strong> and <strong>judgmental sampling</strong>. Each method was tailored to enhance the effectiveness of the audit while ensuring comprehensive coverage of high-risk areas.</p>
      <p><strong>1. Random Sampling Method</strong></p>
      <p><strong>Definition:</strong> Selecting a subset of transactions or records from the entire population so that each item has an equal chance of being included.</p>
      <p><strong>Purpose:</strong> Provide an unbiased representation of the population, reducing selection bias and ensuring that findings reflect the overall situation.</p>
      <p><strong>Implementation:</strong></p>
      <ul>
        <li><strong>Population Identification:</strong> Define the entire population from which samples will be drawn.</li>
        <li><strong>Sample Size Determination:</strong> Calculate an appropriate sample size based on the population size, desired confidence level, and margin of error.</li>
        <li><strong>Random Selection Process:</strong> Use random number generators or statistical tools to select items, ensuring each has an equal chance of inclusion.</li>
      </ul>
      <p><strong>Advantages:</strong></p>
      <ul>
        <li>Minimizes selection bias.</li>
        <li>Provides a broader and more objective view of the population.</li>
      </ul>
      <p><strong>Limitations:</strong></p>
      <ul>
        <li>May not focus sufficiently on high-risk areas.</li>
        <li>Important or unusual transactions may be excluded by chance.</li>
      </ul>
      <p><strong>2. Judgmental Sampling Method</strong></p>
      <p><strong>Definition:</strong> Selecting specific transactions or records based on predefined criteria and the auditor&apos;s professional judgment.</p>
      <p><strong>Purpose:</strong> Target high-risk areas or transactions that are more likely to reveal issues, ensuring a focused audit approach.</p>
      <p><strong>Implementation:</strong></p>
      <ul>
        <li><strong>Risk Assessment:</strong> Identify high-risk areas, unusual transactions, or areas with significant judgment.</li>
        <li><strong>Criteria Development:</strong> Establish selection criteria such as transaction value, frequency, or recent changes in procedures.</li>
        <li><strong>Selection Process:</strong> Choose transactions based on the established criteria, documenting the rationale for each selection.</li>
      </ul>
      <p><strong>Advantages:</strong></p>
      <ul>
        <li>Focuses on high-risk areas, increasing the likelihood of identifying issues.</li>
        <li>Allows flexibility and professional judgment in targeting critical areas.</li>
      </ul>
      <p><strong>Limitations:</strong></p>
      <ul>
        <li>Results may be influenced by auditor judgment and may not be fully representative.</li>
        <li>Requires clear documentation to support the basis for selection.</li>
      </ul>
      <p><strong>4.&nbsp;&nbsp;Methodology</strong></p>
      <p>The following points outline the audit methodology used during the internal audit, structured into several key phases:</p>
      <p><strong>4.1&nbsp;&nbsp;Planning Phase</strong></p>
      <ul>
        <li>Define audit objectives and scope.</li>
        <li>Identify key risks and areas of concern through preliminary assessments.</li>
        <li>Develop an audit plan outlining the timeline, resources needed, and specific areas to be tested.</li>
      </ul>
      <p><strong>4.2&nbsp;&nbsp;Fieldwork Phase</strong></p>
      <ul>
        <li><strong>Data Collection:</strong> Gather relevant documents, records, and transaction data from various departments.</li>
        <li><strong>Interviews:</strong> Conduct interviews with key personnel to understand processes, controls, and any issues faced.</li>
        <li><strong>Observations:</strong> Observe operational processes in real time to assess compliance with established procedures.</li>
      </ul>
      <p><strong>4.3&nbsp;&nbsp;Testing Phase</strong></p>
      <ul>
        <li><strong>Substantive Testing:</strong> Perform detailed testing of selected transactions to verify accuracy and compliance with policies.</li>
        <li><strong>Control Testing:</strong> Evaluate the effectiveness of internal controls by testing their design and operational effectiveness.</li>
        <li><strong>Analytical Procedures:</strong> Use analytical techniques to identify trends, anomalies, or unexpected variances in financial and operational data.</li>
      </ul>
      <p><strong>4.4&nbsp;&nbsp;Documentation Phase</strong></p>
      <ul>
        <li>Maintain detailed documentation of all findings, evidence collected, and testing performed.</li>
        <li>Document sampling decisions and any deviations from the original audit plan.</li>
      </ul>
      <p><strong>4.5&nbsp;&nbsp;Reporting Phase</strong></p>
      <ul>
        <li>Compile findings into a comprehensive audit report, summarizing key issues identified and risk ratings.</li>
        <li>Present the report to management, highlighting critical areas that require immediate attention.</li>
      </ul>
      <p><strong>4.6&nbsp;&nbsp;Follow-Up Phase</strong></p>
      <ul>
        <li>Establish a follow-up plan to monitor the implementation of agreed recommendations.</li>
        <li>Schedule follow-up audits as necessary to ensure that corrective actions have been taken and are effective.</li>
      </ul>
      <p>By employing a structured audit methodology, supported by both random and judgmental sampling methods, this internal audit provides a thorough assessment of the company&apos;s controls and processes, ensuring a comprehensive evaluation of risks and compliance.</p>
    `;
}

function ensureAuditApproachMethodologyCompleteness(html) {
  const normalized = normalizeHtmlWithFallback(html, createDefaultAuditApproachMethodologyHtml());
  const hasJudgmental = /Judgmental Sampling Method/i.test(normalized);
  const hasMethodologySection = /4\.\s*(?:&nbsp;|\s)*Methodology/i.test(normalized);
  if (hasJudgmental && hasMethodologySection) return normalized;

  const fullDefault = createDefaultAuditApproachMethodologyHtml();
  const marker = "<p><strong>2. Judgmental Sampling Method</strong></p>";
  const markerIndex = fullDefault.indexOf(marker);
  if (markerIndex < 0) return normalized;
  return `${normalized}${fullDefault.slice(markerIndex)}`;
}

function normalizeExecutiveSummaryHtml(html, year) {
  const normalized = String(html || "").trim();
  return normalized || createDefaultExecutiveSummaryHtml(year);
}

function normalizeHtmlWithFallback(html, fallbackHtml) {
  const normalized = String(html || "").trim();
  return normalized || String(fallbackHtml || "");
}

function sanitizeExecutiveSummaryHtml(html, year) {
  if (typeof document === "undefined") {
    return normalizeExecutiveSummaryHtml(html, year);
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = normalizeExecutiveSummaryHtml(html, year);

  const allowedTags = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "UL",
    "OL",
    "LI",
  ]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tagName = node.tagName.toUpperCase();

    if (tagName === "DIV") {
      const p = document.createElement("p");
      Array.from(node.childNodes).forEach((child) => {
        p.appendChild(cleanNode(child));
      });
      return p;
    }

    if (!allowedTags.has(tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        fragment.appendChild(cleanNode(child));
      });
      return fragment;
    }

    const el = document.createElement(tagName.toLowerCase());
    Array.from(node.childNodes).forEach((child) => {
      el.appendChild(cleanNode(child));
    });
    return el;
  };

  const cleanedWrapper = document.createElement("div");
  Array.from(wrapper.childNodes).forEach((child) => {
    cleanedWrapper.appendChild(cleanNode(child));
  });

  return normalizeExecutiveSummaryHtml(cleanedWrapper.innerHTML, year);
}

function sanitizeHtmlWithFallback(html, fallbackHtml) {
  if (typeof document === "undefined") {
    return normalizeHtmlWithFallback(html, fallbackHtml);
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = normalizeHtmlWithFallback(html, fallbackHtml);

  const allowedTags = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "UL",
    "OL",
    "LI",
  ]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }
    const tagName = node.tagName.toUpperCase();
    if (tagName === "DIV") {
      const p = document.createElement("p");
      Array.from(node.childNodes).forEach((child) => p.appendChild(cleanNode(child)));
      return p;
    }
    if (!allowedTags.has(tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => fragment.appendChild(cleanNode(child)));
      return fragment;
    }
    const el = document.createElement(tagName.toLowerCase());
    Array.from(node.childNodes).forEach((child) => el.appendChild(cleanNode(child)));
    return el;
  };

  const cleanedWrapper = document.createElement("div");
  Array.from(wrapper.childNodes).forEach((child) => cleanedWrapper.appendChild(cleanNode(child)));
  return normalizeHtmlWithFallback(cleanedWrapper.innerHTML, fallbackHtml);
}

function blockPlainText(blockHtml) {
  return String(blockHtml || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isColonLabelParagraph(plainText) {
  const t = String(plainText || "").trim();
  return (
    t.endsWith(":") &&
    t.length <= 72 &&
    !/^\d+(\.\d+)*[\s.]/.test(t)
  );
}

function shouldKeepListIntact(items) {
  const totalLen = items.reduce(
    (sum, li) => sum + (li.textContent || "").trim().length,
    0,
  );
  if (
    items.some(
      (li) =>
        (li.textContent || "").trim().length > EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS,
    )
  ) {
    return false;
  }
  return (
    items.length <= LIST_KEEP_TOGETHER_MAX_ITEMS &&
    totalLen <= LIST_KEEP_TOGETHER_MAX_CHARS
  );
}

/** Merge consecutive "Advantages:" + ul + "Limitations:" + ul (etc.) into one pagination unit. */
function mergeColonLabelListRuns(blocks) {
  const result = [];
  let i = 0;
  while (i < blocks.length) {
    const t = blockPlainText(blocks[i]);
    const next = blocks[i + 1] || "";
    if (
      isColonLabelParagraph(t) &&
      (next.trim().startsWith("<ul") || next.trim().startsWith("<ol"))
    ) {
      let combined = blocks[i] + next;
      let j = i + 2;
      while (j < blocks.length) {
        const tj = blockPlainText(blocks[j]);
        const nextJ = blocks[j + 1] || "";
        if (
          isColonLabelParagraph(tj) &&
          (nextJ.trim().startsWith("<ul") || nextJ.trim().startsWith("<ol"))
        ) {
          combined += blocks[j] + nextJ;
          j += 2;
          continue;
        }
        break;
      }
      result.push(combined);
      i = j;
      continue;
    }
    result.push(blocks[i]);
    i += 1;
  }
  return result.length > 0 ? result : blocks;
}

function splitRichTextHtmlIntoBlocks(html, fallbackHtml) {
  const normalized = sanitizeHtmlWithFallback(html, fallbackHtml);

  if (typeof document === "undefined") {
    return [normalized];
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = normalized;

  const blocks = [];
  const nodes = Array.from(wrapper.childNodes);
  const getNextMeaningfulNodeInfo = (startIndex) => {
    for (let i = startIndex + 1; i < nodes.length; i += 1) {
      const candidate = nodes[i];
      if (candidate.nodeType === Node.TEXT_NODE) {
        if ((candidate.textContent || "").trim()) {
          return { index: i, node: candidate };
        }
        continue;
      }
      if (candidate.nodeType === Node.ELEMENT_NODE) {
        return { index: i, node: candidate };
      }
    }
    return { index: -1, node: null };
  };

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) {
        splitLongPlainText(text).forEach((chunk) => {
          blocks.push(`<p>${escapeHtml(chunk)}</p>`);
        });
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tagName = node.tagName.toUpperCase();
    if (tagName === "P") {
      const plainText = (node.textContent || "").trim();
      const { index: nextNodeIndex, node: nextNode } = getNextMeaningfulNodeInfo(nodeIndex);
      const nextTagName =
        nextNode?.nodeType === Node.ELEMENT_NODE ? nextNode.tagName.toUpperCase() : "";
      const isSectionHeading = /^\d+(\.\d+)*[\s.]/.test(plainText);

      // Keep subsection headings together with the list/body immediately after them
      // so a heading like "4.2 Fieldwork Phase" doesn't get stranded near the footer.
      if (
        isSectionHeading &&
        (nextTagName === "UL" || nextTagName === "OL")
      ) {
        blocks.push(`${node.outerHTML}${nextNode.outerHTML}`);
        nodeIndex = nextNodeIndex;
        continue;
      }

      if (
        isColonLabelParagraph(plainText) &&
        (nextTagName === "UL" || nextTagName === "OL")
      ) {
        blocks.push(`${node.outerHTML}${nextNode.outerHTML}`);
        nodeIndex = nextNodeIndex;
        continue;
      }

      if (
        isSectionHeading &&
        nextTagName === "P" &&
        (nextNode.textContent || "").trim()
      ) {
        blocks.push(`${node.outerHTML}${nextNode.outerHTML}`);
        nodeIndex = nextNodeIndex;
        continue;
      }

      if (plainText.length > EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS) {
        splitLongPlainText(plainText).forEach((chunk) => {
          blocks.push(`<p>${escapeHtml(chunk)}</p>`);
        });
        continue;
      }

      if (node.outerHTML?.trim()) {
        blocks.push(node.outerHTML);
      }
      continue;
    }

    if (tagName === "UL" || tagName === "OL") {
      const items = Array.from(node.children).filter(
        (child) => child.tagName?.toUpperCase() === "LI",
      );

      if (items.length === 0) {
        if (node.outerHTML?.trim()) blocks.push(node.outerHTML);
        continue;
      }

      if (shouldKeepListIntact(items)) {
        blocks.push(node.outerHTML);
        continue;
      }

      items.forEach((item, idx) => {
        const liText = (item.textContent || "").trim();
        const liChunks =
          liText.length > EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS
            ? splitLongPlainText(liText, Math.max(220, EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS - 40))
            : [null];

        if (liChunks[0] === null) {
          if (tagName === "OL") {
            blocks.push(`<ol start="${idx + 1}"><li>${item.innerHTML}</li></ol>`);
          } else {
            blocks.push(`<ul><li>${item.innerHTML}</li></ul>`);
          }
          return;
        }

        liChunks.forEach((chunk) => {
          if (tagName === "OL") {
            blocks.push(`<ol start="${idx + 1}"><li>${escapeHtml(chunk)}</li></ol>`);
          } else {
            blocks.push(`<ul><li>${escapeHtml(chunk)}</li></ul>`);
          }
        });
      });
      continue;
    }

    if (node.outerHTML?.trim()) {
      blocks.push(node.outerHTML);
    }
  }

  const merged = mergeColonLabelListRuns(
    blocks.length > 0 ? blocks : [normalized],
  );
  return merged.length > 0 ? merged : [normalized];
}

/** Section number at block start (e.g. 1.3 from "1.3 Key Findings"). */
function getBlockSectionNumber(blockHtml) {
  const text = String(blockHtml || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = text.match(/^1\.(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Keep 1.3–1.5 in one pagination block (flows below Scope without extra page breaks). */
function mergeExecutiveSummarySubsections13To15(blocks) {
  const result = [];
  let i = 0;
  while (i < blocks.length) {
    const section = getBlockSectionNumber(blocks[i]);
    if (section === 3) {
      let combined = "";
      let j = i;
      while (j < blocks.length) {
        const sec = getBlockSectionNumber(blocks[j]);
        if (j > i && sec !== null && sec < 3) break;
        if (j > i && sec !== null && sec > 5) break;
        combined += blocks[j];
        if (sec === 5) {
          j += 1;
          while (j < blocks.length && getBlockSectionNumber(blocks[j]) === null) {
            combined += blocks[j];
            j += 1;
          }
          break;
        }
        j += 1;
      }
      result.push(combined);
      i = j;
      continue;
    }
    result.push(blocks[i]);
    i += 1;
  }
  return result.length > 0 ? result : blocks;
}

function splitExecutiveSummaryIntoBlocks(html, year) {
  const blocks = splitRichTextHtmlIntoBlocks(
    html,
    createDefaultExecutiveSummaryHtml(year),
  );
  return mergeExecutiveSummarySubsections13To15(blocks);
}

function parseJsonList(value) {
  return parseStoredJsonList(value);
}

function deriveAuditYearFromReviewRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const years = rows
    .map((row) => row?.completion_date || row?.updated_at || null)
    .filter(Boolean)
    .map((value) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
    })
    .filter((y) => y != null);
  return years.length > 0 ? Math.max(...years) : null;
}

/** Uses latest Audit Review executive-summary row (same lock state as Unlock/Lock button). */
async function fetchAuditReviewPublishState(apiPath, reportYear) {
  try {
    const yearQ = Number.isFinite(reportYear)
      ? `?year=${encodeURIComponent(String(reportYear))}`
      : "";
    const res = await fetch(
      `/api/audit-review/${apiPath}/publish-status${yearQ}${yearQ ? "&" : "?"}_=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return { isLocked: false, row: null, auditYear: reportYear ?? null };
    }
    const json = await res.json().catch(() => ({}));
    const isLocked = json.isPublished === true || json.isLocked === true;
    return {
      isLocked,
      row: isLocked ? json.row ?? null : null,
      auditYear: json.auditYear ?? reportYear ?? null,
    };
  } catch {
    return { isLocked: false, row: null, auditYear: reportYear ?? null };
  }
}

function formatExecutiveSummaryItem(item) {
  if (item == null) return "-";
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (typeof item === "object") {
    const name = item?.name ? String(item.name) : "";
    const region = item?.region ? String(item.region) : "";
    if (name && region) return `${name} - ${region}`;
    if (name) return name;
    if (region) return region;
    return Object.values(item)
      .filter((value) => value != null && value !== "")
      .map((value) => String(value))
      .join(" - ") || "-";
  }
  return String(item);
}

function ReportPreviewPageContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const router = useRouter();
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const defaultCoverInfo = getDefaultReportCoverInfo(year);
  const [periodStart, setPeriodStart] = useState(defaultCoverInfo.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultCoverInfo.periodEnd);
  const [auditCoverage, setAuditCoverage] = useState(defaultCoverInfo.auditCoverage);
  const [departmentCoverage, setDepartmentCoverage] = useState(
    defaultCoverInfo.departmentCoverage,
  );
  const [area, setArea] = useState(defaultCoverInfo.area);

  const [findingSections, setFindingSections] = useState([]);
  /** Data modul utuh dari hub — fallback USER section saat client state kosong setelah unlock. */
  const [hubModuleSections, setHubModuleSections] = useState([]);
  const [findingsLoadCompleted, setFindingsLoadCompleted] = useState(false);
  const [findingsReloadToken, setFindingsReloadToken] = useState(0);
  const resetHandledRef = useRef(false);
  const skipPersistUntilRef = useRef(0);
  /** First load always pulls module APIs fresh (avoids stale DB snapshot on open). */
  const sopModuleRefreshRef = useRef(true);
  const findingsLoadInProgressRef = useRef(false);
  const moduleLoadSeqRef = useRef(0);
  const [reportStateHydrated, setReportStateHydrated] = useState(false);
  const findingSectionsRef = useRef([]);
  const savedFindingSectionsRef = useRef([]);
  const hiddenAuditEditsRef = useRef({});
  const persistReportStateRef = useRef(null);
  const buildReportExportPayloadRef = useRef(null);
  const hubRevisionInitRef = useRef(null);
  const onlyOfficeSyncRevisionRef = useRef(0);
  const hubRevisionRef = useRef(0);
  const skipPersistOnceRef = useRef(false);
  const narrativeSnapshotRef = useRef(null);
  const lastDbNarrativeRef = useRef(null);
  /** Lock/unlock from Audit Review before DB publish-status catches up. */
  const pendingPublishByDeptRef = useRef({});

  const {
    publishStatusByDept,
    publishStatusRef,
    refreshPublishStatus,
    applyPublishEvent,
    syncPublishFromLockedByDept,
  } = useReportAuditPublishRealtime(year);

  /** HTML preview visibility — overrides DB when user unlocks (saved to report state). */
  const [auditVisibleByDept, setAuditVisibleByDept] = useState({});
  const auditVisibleByDeptRef = useRef({});

  const effectivePublishByDept = useMemo(
    () => buildEffectivePublishMap(publishStatusByDept, auditVisibleByDept, findingSections),
    [publishStatusByDept, auditVisibleByDept, findingSections],
  );

  const displayFindingSections = useMemo(
    () => filterFindingSectionsForDisplay(findingSections, effectivePublishByDept),
    [findingSections, effectivePublishByDept],
  );

  function auditRowsForDept(deptKey, visibleOnly = true) {
    const section = findingSections.find((s) => s.deptKey === deptKey);
    if (!section) return [];
    const show =
      !visibleOnly || isDeptPublishedToReport(deptKey, effectivePublishByDept);
    if (!show) return [];
    if (section.auditRows?.length) return section.auditRows;
    const hubSec = lastDbNarrativeRef.current?.findingSections?.find(
      (s) => s.deptKey === deptKey,
    );
    if (hubSec?.auditRows?.length) return hubSec.auditRows;
    const hidden = hiddenAuditEditsRef.current[deptKey];
    return Array.isArray(hidden) ? hidden : [];
  }

  useEffect(() => {
    auditVisibleByDeptRef.current = auditVisibleByDept;
  }, [auditVisibleByDept]);

  const prevPublishStatusRef = useRef({});
  const publishStatusSeededRef = useRef(false);

  /** WebSocket/batch: dept baru di-lock → muat ulang data audit ke HTML preview. */
  useEffect(() => {
    if (!findingsLoadCompleted) return;

    const prev = prevPublishStatusRef.current;
    const isInitialSeed =
      !publishStatusSeededRef.current && Object.keys(publishStatusByDept).length > 0;

    let shouldReload = false;
    for (const [deptKey, locked] of Object.entries(publishStatusByDept)) {
      const wasLocked = prev[deptKey] === true;
      if (locked === true && !wasLocked) {
        pendingPublishByDeptRef.current[deptKey] = true;
        setAuditVisibleByDept((prevVis) => {
          const next = { ...prevVis, [deptKey]: true };
          auditVisibleByDeptRef.current = next;
          return next;
        });
        shouldReload = true;
      }
      if (locked === false && wasLocked) {
        pendingPublishByDeptRef.current[deptKey] = false;
        setAuditVisibleByDept((prevVis) => {
          const next = { ...prevVis, [deptKey]: false };
          auditVisibleByDeptRef.current = next;
          return next;
        });
        shouldReload = true;
      }
    }
    prevPublishStatusRef.current = { ...publishStatusByDept };
    if (Object.keys(publishStatusByDept).length > 0) {
      publishStatusSeededRef.current = true;
    }
    if (isInitialSeed) return;
    if (shouldReload) {
      setMeasuredChunks(null);
      setFindingsReloadToken((t) => t + 1);
    }
  }, [publishStatusByDept, findingsLoadCompleted]);

  /** Chunk berdasarkan ukuran riil (ukur setelah render), seperti Word: isi halaman sampai penuh lalu next page. */
  const [measuredChunks, setMeasuredChunks] = useState(null);
  const measureContainerRef = useRef(null);
  /** Hanya untuk Conclusion: nilai textarea per department. */
  const [conclusionValues, setConclusionValues] = useState({});
  /** Hanya untuk Conclusion: chunk per halaman (dari pengukuran); null = pakai fallback. */
  const [conclusionChunks, setConclusionChunks] = useState(null);
  const conclusionMeasureRef = useRef(null);
  /** true = tampilkan form isi conclusion + Save; false = tampilkan Add Conclusion atau halaman hasil. */
  const [showConclusionForm, setShowConclusionForm] = useState(false);
  /** deptKey yang sedang generate conclusion via AI, atau null. */
  const [conclusionAiLoadingDept, setConclusionAiLoadingDept] = useState(null);
  /** Finding & Recommendation: per department, array indeks finding yang dipilih (checkbox = multi). */
  const [selectedFindingByDept, setSelectedFindingByDept] = useState({});
  /** Modal pilih finding: deptKey yang dibuka (null = tertutup). */
  const [findingModalDeptKey, setFindingModalDeptKey] = useState(null);
  /** Checkbox di modal: array indeks yang dicentang. */
  const [modalCheckedIndices, setModalCheckedIndices] = useState([]);
  /** Audit team: nama + role, bisa diubah via popup.
   *  Default-nya kosong; baru muncul setelah user klik + Add Member.
   */
  const [auditTeam, setAuditTeam] = useState([]);
  const [isAuditTeamModalOpen, setIsAuditTeamModalOpen] = useState(false);
  const [newAuditName, setNewAuditName] = useState("");
  const [newAuditRole, setNewAuditRole] = useState("MEMBER");
  const [preparedBy, setPreparedBy] = useState([]);
  const [isPreparedByModalOpen, setIsPreparedByModalOpen] = useState(false);
  const [newPreparedName, setNewPreparedName] = useState("");
  const [newPreparedRole, setNewPreparedRole] = useState("MEMBER");
  const [newPreparedDate, setNewPreparedDate] = useState("");
  const [auditCommitteeName, setAuditCommitteeName] = useState("");
  const [auditCommitteeDate, setAuditCommitteeDate] = useState("");
  const [presidentDirectorName, setPresidentDirectorName] = useState("");
  const [presidentDirectorDate, setPresidentDirectorDate] = useState("");

  const preparedByDisplayRows = useMemo(
    () => resolvePreparedByRows(preparedBy),
    [preparedBy],
  );

  const pendingFieldUpdatesRef = useRef({});
  const fieldUpdateTimerRef = useRef(null);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const aiStatusTimerRef = useRef(null);
  /** Avoid hydration mismatch from browser extensions (fdprocessedid on buttons/inputs). */
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const flushPendingFieldUpdates = () => {
    if (fieldUpdateTimerRef.current) {
      window.clearTimeout(fieldUpdateTimerRef.current);
      fieldUpdateTimerRef.current = null;
    }
    const pending = pendingFieldUpdatesRef.current;
    const entries = Object.entries(pending);
    if (entries.length === 0) return;

    pendingFieldUpdatesRef.current = {};
    setFindingSections((prev) =>
      prev.map((section) => {
        const sectionEntries = entries.filter(([key]) => key.startsWith(`${section.deptKey}|`));
        if (sectionEntries.length === 0) return section;

        const sopMap = new Map();
        const auditMap = new Map();
        sectionEntries.forEach(([key, value]) => {
          const [, rowKey, field, rowType] = key.split("|");
          const mapRef = rowType === "sop" ? sopMap : auditMap;
          const bucket = mapRef.get(rowKey) || {};
          bucket[field] = value;
          mapRef.set(rowKey, bucket);
        });

        return {
          ...section,
          sopRows: (section.sopRows || []).map((row, idx) => {
            const rowKey = String(row.sourceIndex ?? idx);
            const updates = sopMap.get(rowKey);
            return updates ? { ...row, ...updates } : row;
          }),
          auditRows: (section.auditRows || []).map((row, idx) => {
            const rowKey = String(row.sourceIndex ?? idx);
            const updates = auditMap.get(rowKey);
            return updates ? { ...row, ...updates } : row;
          }),
        };
      }),
    );
  };

  const enqueueRowFieldUpdate = (rowType, deptKey, rowKey, field, value) => {
    const key = `${deptKey}|${rowKey}|${field}|${rowType}`;
    pendingFieldUpdatesRef.current[key] = value;
    if (fieldUpdateTimerRef.current) {
      window.clearTimeout(fieldUpdateTimerRef.current);
    }
    fieldUpdateTimerRef.current = window.setTimeout(() => {
      flushPendingFieldUpdates();
      fieldUpdateTimerRef.current = null;
    }, 180);
  };

  const autoResizePlainTextarea = (target) => {
    if (!target) return;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  const formattedAuditCommitteeDate = auditCommitteeDate
    ? new Date(auditCommitteeDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const formattedPresidentDirectorDate = presidentDirectorDate
    ? new Date(presidentDirectorDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const [richTextEditorSection, setRichTextEditorSection] = useState(null);
  const [appendices, setAppendices] = useState(DEFAULT_APPENDICES);
  const [showAppendixEditor, setShowAppendixEditor] = useState(false);

  const moduleSectionsSource = useMemo(
    () => (hubModuleSections.length > 0 ? hubModuleSections : findingSections),
    [hubModuleSections, findingSections],
  );

  const sectionHasModuleTableData = useCallback((section) => {
    return (
      (section.sopRows?.length || 0) > 0 ||
      (section.auditRows?.length || 0) > 0 ||
      executiveSummaryRowHasContent(
        buildDeptExecutiveSummaryFromRow(section.executiveSummary),
      )
    );
  }, []);

  /** SYSTEM: tabel modul SOP/Audit — visibility lock/unlock saja. */
  const hasSystemFindingModules = useMemo(
    () => moduleSectionsSource.some(sectionHasModuleTableData),
    [moduleSectionsSource, sectionHasModuleTableData],
  );

  /**
   * USER: dept untuk Conclusion — dari modul ATAU teks tersimpan (tidak ikut SYSTEM unlock).
   */
  const conclusionDeptSections = useMemo(() => {
    const fromModules = moduleSectionsSource.filter(sectionHasModuleTableData);
    if (fromModules.length > 0) return fromModules;
    const keys = Object.keys(conclusionValues || {}).filter((k) =>
      String(conclusionValues[k] ?? "").trim(),
    );
    return keys.map((deptKey) => {
      const fromHub = moduleSectionsSource.find((s) => s.deptKey === deptKey);
      const fromRows = REPORT_DEPARTMENT_COMPLETION_ROWS.find((r) => r.deptKey === deptKey);
      return {
        deptKey,
        deptLabel: fromHub?.deptLabel || fromRows?.name || deptKey,
        sopRows: [],
        auditRows: [],
      };
    });
  }, [moduleSectionsSource, conclusionValues, sectionHasModuleTableData]);

  /** USER paper — tetap render meski SYSTEM unlock (perbaikan Kasus B). */
  const showConclusionPaper = findingsLoadCompleted;
  const showAppendixPaper = findingsLoadCompleted && appendices.length > 0;
  const [executiveSummaryHtml, setExecutiveSummaryHtml] = useState(() =>
    createDefaultExecutiveSummaryHtml(year),
  );
  const [auditObjectivesScopeHtml, setAuditObjectivesScopeHtml] = useState(() =>
    createDefaultAuditObjectivesScopeHtml(),
  );
  const [auditApproachMethodologyHtml, setAuditApproachMethodologyHtml] = useState(() =>
    createDefaultAuditApproachMethodologyHtml(),
  );
  const [draftRichTextHtml, setDraftRichTextHtml] = useState(() =>
    createDefaultExecutiveSummaryHtml(year),
  );
  const [executiveSummaryChunks, setExecutiveSummaryChunks] = useState(null);
  const [auditObjectivesScopeChunks, setAuditObjectivesScopeChunks] = useState(null);
  const [auditApproachMethodologyChunks, setAuditApproachMethodologyChunks] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const executiveSummaryEditorRef = useRef(null);
  const draftRichTextRef = useRef(createDefaultExecutiveSummaryHtml(year));
  const executiveSummaryMeasureBlocksRef = useRef(null);
  const executiveSummaryFirstSlotRef = useRef(null);
  const executiveSummaryNextSlotRef = useRef(null);
  const auditObjectivesMeasureBlocksRef = useRef(null);
  const auditObjectivesFirstSlotRef = useRef(null);
  const auditObjectivesNextSlotRef = useRef(null);
  const auditApproachMeasureBlocksRef = useRef(null);
  const auditApproachFirstSlotRef = useRef(null);
  const auditApproachNextSlotRef = useRef(null);
  const appendicesStorageKey = `report-preview-appendices-${year}`;
  const executiveSummaryStorageKey = `report-preview-executive-summary-${year}`;
  const auditObjectivesScopeStorageKey = `report-preview-audit-objectives-scope-${year}`;
  const auditApproachMethodologyStorageKey = `report-preview-audit-approach-methodology-${year}`;
  const executiveSummaryBlocks = useMemo(
    () => splitExecutiveSummaryIntoBlocks(executiveSummaryHtml, year),
    [executiveSummaryHtml, year],
  );
  const auditObjectivesScopeDefaultHtml = useMemo(
    () => createDefaultAuditObjectivesScopeHtml(),
    [],
  );
  const auditApproachMethodologyDefaultHtml = useMemo(
    () => createDefaultAuditApproachMethodologyHtml(),
    [],
  );
  const auditObjectivesScopeBlocks = useMemo(
    () => splitRichTextHtmlIntoBlocks(auditObjectivesScopeHtml, auditObjectivesScopeDefaultHtml),
    [auditObjectivesScopeHtml, auditObjectivesScopeDefaultHtml],
  );
  const auditApproachMethodologyBlocks = useMemo(
    () =>
      splitRichTextHtmlIntoBlocks(
        auditApproachMethodologyHtml,
        auditApproachMethodologyDefaultHtml,
      ),
    [auditApproachMethodologyHtml, auditApproachMethodologyDefaultHtml],
  );

  function normalizeAppendix(item, idx) {
    const isRiskAssessment =
      String(item?.title || "").toLowerCase().includes("risk assessments") ||
      item?.type === "table";

    if (isRiskAssessment) {
      return {
        id: item?.id || `appendix-${idx + 1}`,
        type: "table",
        title: item?.title || "Appendix C - Risk Assessments",
        content: item?.content || "Risk Matrix",
        tableRows:
          Array.isArray(item?.tableRows) && item.tableRows.length > 0
            ? item.tableRows.map((row) => ({
                department: row?.department || "",
                apNo: row?.apNo || "",
                riskFactor: row?.riskFactor || "",
                riskIndicator: row?.riskIndicator || "",
                riskLevel: row?.riskLevel || "",
              }))
            : Array.from({ length: 12 }, () => ({
                department: "",
                apNo: "",
                riskFactor: "",
                riskIndicator: "",
                riskLevel: "",
              })),
      };
    }

    return {
      id: item?.id || `appendix-${idx + 1}`,
      type: "text",
      title: item?.title || `Appendix ${idx + 1}`,
      content: item?.content || "",
    };
  }

  function mergeWithDefaultAppendices(savedItems) {
    const normalizedDefaults = DEFAULT_APPENDICES.map((item, idx) => normalizeAppendix(item, idx));
    const normalizedSaved = Array.isArray(savedItems)
      ? savedItems.map((item, idx) => normalizeAppendix(item, idx))
      : [];

    const savedById = new Map(normalizedSaved.map((item) => [item.id, item]));
    const defaultIds = new Set(normalizedDefaults.map((item) => item.id));

    const mergedDefaults = normalizedDefaults.map((defaultItem) => {
      const savedItem = savedById.get(defaultItem.id);
      if (!savedItem) return defaultItem;
      return {
        ...defaultItem,
        ...savedItem,
        tableRows:
          savedItem.type === "table"
            ? savedItem.tableRows || defaultItem.tableRows
            : defaultItem.tableRows,
      };
    });

    const extraAppendices = normalizedSaved.filter((item) => !defaultIds.has(item.id));
    return [...mergedDefaults, ...extraAppendices];
  }

  function updateAppendixTableCell(appendixId, rowIdx, field, value) {
    setAppendices((prev) =>
      prev.map((item) =>
        item.id === appendixId
          ? {
              ...item,
              tableRows: (item.tableRows || []).map((row, index) =>
                index === rowIdx ? { ...row, [field]: value } : row,
              ),
            }
          : item,
      ),
    );
  }

  function addAppendixTableRow(appendixId) {
    setAppendices((prev) =>
      prev.map((item) =>
        item.id === appendixId
          ? {
              ...item,
              tableRows: [
                ...(item.tableRows || []),
                {
                  department: "",
                  apNo: "",
                  riskFactor: "",
                  riskIndicator: "",
                  riskLevel: "",
                },
              ],
            }
          : item,
      ),
    );
  }

  function removeAppendixTableRow(appendixId, rowIdx) {
    setAppendices((prev) =>
      prev.map((item) =>
        item.id === appendixId
          ? {
              ...item,
              tableRows: (item.tableRows || []).filter((_, index) => index !== rowIdx),
            }
          : item,
      ),
    );
  }

  const getRichTextSectionHtml = (section) => {
    if (section === "auditObjectivesScope") return auditObjectivesScopeHtml;
    if (section === "auditApproachMethodology") return auditApproachMethodologyHtml;
    return executiveSummaryHtml;
  };

  const getRichTextSectionDefaultHtml = (section) => {
    if (section === "auditObjectivesScope") return createDefaultAuditObjectivesScopeHtml();
    if (section === "auditApproachMethodology") return createDefaultAuditApproachMethodologyHtml();
    return createDefaultExecutiveSummaryHtml(year);
  };

  const setRichTextSectionHtml = (section, html) => {
    if (section === "auditObjectivesScope") {
      setAuditObjectivesScopeHtml(html);
      return;
    }
    if (section === "auditApproachMethodology") {
      setAuditApproachMethodologyHtml(ensureAuditApproachMethodologyCompleteness(html));
      return;
    }
    setExecutiveSummaryHtml(html);
  };

  const getRichTextEditorTitle = (section) => {
    if (section === "auditObjectivesScope") return "Edit Audit Objectives and Scope";
    if (section === "auditApproachMethodology") return "Edit Audit Approach and Methodology";
    return "Edit Executive Summary";
  };

  const syncExecutiveSummaryDraftFromEditor = () => {
    if (!executiveSummaryEditorRef.current) return;
    const fallback = getRichTextSectionDefaultHtml(richTextEditorSection);
    setDraftRichTextHtml(sanitizeHtmlWithFallback(executiveSummaryEditorRef.current.innerHTML, fallback));
  };

  const applyExecutiveSummaryCommand = (command, value = undefined) => {
    if (!executiveSummaryEditorRef.current) return;
    executiveSummaryEditorRef.current.focus();
    document.execCommand(command, false, value);
    syncExecutiveSummaryDraftFromEditor();
  };

  const openRichTextEditor = (section) => {
    setDraftRichTextHtml(getRichTextSectionHtml(section));
    setRichTextEditorSection(section);
  };

  const closeRichTextEditor = () => {
    setDraftRichTextHtml(getRichTextSectionHtml(richTextEditorSection));
    setRichTextEditorSection(null);
  };

  const saveRichTextEditor = () => {
    const fallback = getRichTextSectionDefaultHtml(richTextEditorSection);
    const nextHtml = sanitizeHtmlWithFallback(
      executiveSummaryEditorRef.current?.innerHTML ?? draftRichTextHtml,
      fallback,
    );
    setRichTextSectionHtml(richTextEditorSection, nextHtml);
    setDraftRichTextHtml(nextHtml);
    setRichTextEditorSection(null);
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (fieldUpdateTimerRef.current) {
        window.clearTimeout(fieldUpdateTimerRef.current);
        fieldUpdateTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!reportStateHydrated) return;
    try {
      const raw = localStorage.getItem(appendicesStorageKey);
      if (!raw) {
        setAppendices(DEFAULT_APPENDICES);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setAppendices(mergeWithDefaultAppendices(parsed));
      } else {
        setAppendices(DEFAULT_APPENDICES);
      }
    } catch {
      setAppendices(DEFAULT_APPENDICES);
    }
  }, [appendicesStorageKey, reportStateHydrated]);

  const resetPreviewClientState = useCallback((options = {}) => {
    if (resetHandledRef.current && options.force !== true) return;
    resetHandledRef.current = true;
    skipPersistUntilRef.current = Date.now() + 5000;
    skipPersistOnceRef.current = true;

    clearClientReportProgress(year);
    setAppendices(DEFAULT_APPENDICES);
    const defaultExec = createDefaultExecutiveSummaryHtml(year);
    setExecutiveSummaryHtml(defaultExec);
    setDraftRichTextHtml(defaultExec);
    setAuditObjectivesScopeHtml(createDefaultAuditObjectivesScopeHtml());
    setAuditApproachMethodologyHtml(createDefaultAuditApproachMethodologyHtml());
    setConclusionValues({});
    setSelectedFindingByDept({});
    setShowConclusionForm(false);
    setAuditTeam([]);
    setPreparedBy([]);
    setAuditCommitteeName("");
    setAuditCommitteeDate("");
    setPresidentDirectorName("");
    setPresidentDirectorDate("");
    const resetCover = getDefaultReportCoverInfo(year);
    setPeriodStart(resetCover.periodStart);
    setPeriodEnd(resetCover.periodEnd);
    setAuditCoverage(resetCover.auditCoverage);
    setDepartmentCoverage(resetCover.departmentCoverage);
    setArea(resetCover.area);
    setAuditVisibleByDept({});
    auditVisibleByDeptRef.current = {};
    if (options.clearSections === true) {
      setFindingSections([]);
      setHubModuleSections([]);
    }
    hiddenAuditEditsRef.current = {};
    savedFindingSectionsRef.current = [];
    findingSectionsRef.current = [];
    lastDbNarrativeRef.current = null;
    narrativeSnapshotRef.current = null;
    hubRevisionInitRef.current = null;
    onlyOfficeSyncRevisionRef.current = 0;
    hubRevisionRef.current = 0;
    publishStatusSeededRef.current = false;
    prevPublishStatusRef.current = {};
    sopModuleRefreshRef.current = true;
    setMeasuredChunks(null);
    setConclusionChunks(null);
  }, [year]);

  // Cross-tab: Report page reset in another tab → clear stale preview state (no full-page overlay).
  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;
    const key = getClientResetGenerationKey(year);
    const onStorage = (event) => {
      if (event.key !== key) return;
      const nextGen = Number(event.newValue) || 0;
      const prevGen = Number(event.oldValue) || 0;
      if (nextGen <= prevGen) return;
      resetPreviewClientState({ clearSections: true, force: true });
      sopModuleRefreshRef.current = true;
      setFindingsReloadToken((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [year, resetPreviewClientState]);

  // Load report edits from database (shared across users/browsers).
  useEffect(() => {
    let cancelled = false;
    resetHandledRef.current = false;
    setReportStateHydrated(false);

    (async () => {
      try {
        const res = await fetch(`/api/report/state?year=${encodeURIComponent(String(year))}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled || !json.success) return;

        const serverResetGen = Number(json.resetGeneration) || 0;
        const clientResetGen = getClientReportResetGeneration(year);
        if (serverResetGen > clientResetGen) {
          markClientReportReset(year, serverResetGen);
          resetPreviewClientState({ clearSections: true, force: true });
          return;
        }

        if (!json.state) {
          clearClientReportProgress(year);
          return;
        }

        const saved = json.state;
        if (typeof saved.periodStart === "string" && saved.periodStart.trim()) {
          setPeriodStart(saved.periodStart);
        }
        if (typeof saved.periodEnd === "string" && saved.periodEnd.trim()) {
          setPeriodEnd(saved.periodEnd);
        }
        if (typeof saved.auditCoverage === "string") {
          setAuditCoverage(saved.auditCoverage);
        }
        if (typeof saved.departmentCoverage === "string") {
          setDepartmentCoverage(saved.departmentCoverage);
        }
        if (typeof saved.area === "string") {
          setArea(saved.area);
        }
        if (Array.isArray(saved.appendices) && saved.appendices.length > 0) {
          setAppendices(mergeWithDefaultAppendices(saved.appendices));
        }
        if (saved.executiveSummaryHtml) {
          const html = normalizeExecutiveSummaryHtml(saved.executiveSummaryHtml, year);
          setExecutiveSummaryHtml(html);
          setDraftRichTextHtml(html);
        }
        if (saved.auditObjectivesScopeHtml) {
          setAuditObjectivesScopeHtml(
            normalizeHtmlWithFallback(
              saved.auditObjectivesScopeHtml,
              createDefaultAuditObjectivesScopeHtml(),
            ),
          );
        }
        if (saved.auditApproachMethodologyHtml) {
          setAuditApproachMethodologyHtml(
            ensureAuditApproachMethodologyCompleteness(
              normalizeHtmlWithFallback(
                saved.auditApproachMethodologyHtml,
                createDefaultAuditApproachMethodologyHtml(),
              ),
            ),
          );
        }
        if (saved.conclusionValues && typeof saved.conclusionValues === "object") {
          setConclusionValues(saved.conclusionValues);
        }
        /** Baseline tabel modul dari DB — loadFindings akan merge dengan API live. */
        if (Array.isArray(saved.findingSections) && saved.findingSections.length > 0) {
          const initial = stripFindingSectionsForClient(saved.findingSections);
          setFindingSections(initial);
          setHubModuleSections(saved.findingSections);
          savedFindingSectionsRef.current = initial;
          findingSectionsRef.current = initial;
        }
        if (
          saved.hiddenAuditFindingEdits &&
          typeof saved.hiddenAuditFindingEdits === "object"
        ) {
          hiddenAuditEditsRef.current = saved.hiddenAuditFindingEdits;
        }
        if (saved.auditVisibleByDept && typeof saved.auditVisibleByDept === "object") {
          setAuditVisibleByDept(saved.auditVisibleByDept);
          auditVisibleByDeptRef.current = saved.auditVisibleByDept;
        }
        if (Array.isArray(saved.auditTeam)) {
          setAuditTeam(
            saved.auditTeam.filter(
              (m) => m && String(m.name ?? "").trim().length > 0,
            ),
          );
        }
        if (Array.isArray(saved.preparedBy)) {
          setPreparedBy(saved.preparedBy);
        }
        if (typeof saved.auditCommitteeName === "string") {
          setAuditCommitteeName(saved.auditCommitteeName);
        }
        if (saved.auditCommitteeDate != null) {
          setAuditCommitteeDate(parseDateForHtmlInput(saved.auditCommitteeDate));
        }
        if (typeof saved.presidentDirectorName === "string") {
          setPresidentDirectorName(saved.presidentDirectorName);
        }
        if (saved.presidentDirectorDate != null) {
          setPresidentDirectorDate(parseDateForHtmlInput(saved.presidentDirectorDate));
        }
        hubRevisionInitRef.current = {
          onlyOffice: Number(saved.onlyOfficeSyncRevision) || 0,
          moduleTables: Number(saved.moduleTablesRevision) || 0,
          hub: Number(saved.hubRevision) || 0,
        };
        lastDbNarrativeRef.current = saved;
      } catch (err) {
        console.warn("[REPORT-PREVIEW] load report state:", err);
      } finally {
        if (!cancelled) setReportStateHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, resetPreviewClientState]);

  const persistReportStateNow = useCallback(async (options = {}) => {
    if (Date.now() < skipPersistUntilRef.current && options.bypassSkipPersist !== true) return;
    if (!Number.isFinite(year)) return;
    /** DB menyimpan data modul utuh; visibility lewat auditVisibleByDept, bukan hapus auditRows. */
    const sectionsForDb = stripFindingSectionsForClient(findingSections);
    const hiddenAuditFindingEdits = {
      ...hiddenAuditEditsRef.current,
      ...collectHiddenAuditEdits(findingSections),
    };
    hiddenAuditEditsRef.current = hiddenAuditFindingEdits;
    savedFindingSectionsRef.current = sectionsForDb;

    const coverFields = {
      periodStart: String(periodStart ?? "").trim(),
      periodEnd: String(periodEnd ?? "").trim(),
      auditCoverage: String(auditCoverage ?? "").trim(),
      departmentCoverage: String(departmentCoverage ?? "").trim(),
      area: String(area ?? "").trim(),
      auditTeam,
      preparedBy,
      auditCommitteeName: String(auditCommitteeName ?? "").trim(),
      auditCommitteeDate: String(auditCommitteeDate ?? "").trim(),
      presidentDirectorName: String(presidentDirectorName ?? "").trim(),
      presidentDirectorDate: String(presidentDirectorDate ?? "").trim(),
    };

    const tablesPayload = {
      appendices,
      executiveSummaryHtml: sanitizeExecutiveSummaryHtml(executiveSummaryHtml, year),
      auditObjectivesScopeHtml: sanitizeHtmlWithFallback(
        auditObjectivesScopeHtml,
        createDefaultAuditObjectivesScopeHtml(),
      ),
      auditApproachMethodologyHtml: ensureAuditApproachMethodologyCompleteness(
        sanitizeHtmlWithFallback(
          auditApproachMethodologyHtml,
          createDefaultAuditApproachMethodologyHtml(),
        ),
      ),
      conclusionValues,
      auditVisibleByDept: auditVisibleByDeptRef.current,
      findingSections: sectionsForDb,
      hiddenAuditFindingEdits,
      onlyOfficeSyncRevision: onlyOfficeSyncRevisionRef.current,
      ...coverFields,
    };

    let dbState = lastDbNarrativeRef.current;
    const protectNarrative =
      options.protectOnlyOfficeNarrative === true ||
      (onlyOfficeSyncRevisionRef.current > 0 &&
        options.narrativeFromPreviewEdit !== true);

    if (protectNarrative) {
      try {
        const res = await fetch(`/api/report/state?year=${encodeURIComponent(String(year))}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (json.success && json.state) {
          dbState = json.state;
          lastDbNarrativeRef.current = json.state;
        }
      } catch {
        dbState = lastDbNarrativeRef.current;
      }
    }

    const useModuleTablesOnly =
      options.syncMode === "moduleTablesOnly" ||
      (protectNarrative && onlyOfficeSyncRevisionRef.current > 0);

    const stateBody = useModuleTablesOnly
      ? {
          findingSections: sectionsForDb,
          hiddenAuditFindingEdits,
          auditVisibleByDept: auditVisibleByDeptRef.current,
          ...coverFields,
        }
      : protectNarrative
        ? buildPersistPayloadWithProtectedNarrative({
            dbState,
            tablesPayload,
            onlyOfficeSyncRevision: onlyOfficeSyncRevisionRef.current,
          })
        : tablesPayload;

    try {
      return await fetch("/api/report/state", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          state: stateBody,
          syncMode: useModuleTablesOnly ? "moduleTablesOnly" : undefined,
          allowNarrativeOverwrite: options.narrativeFromPreviewEdit === true,
        }),
      });
    } catch (err) {
      console.warn("[REPORT-PREVIEW] save report state:", err);
      return null;
    }
  }, [
    year,
    appendices,
    executiveSummaryHtml,
    auditObjectivesScopeHtml,
    auditApproachMethodologyHtml,
    conclusionValues,
    findingSections,
    auditVisibleByDept,
    auditTeam,
    preparedBy,
    auditCommitteeName,
    auditCommitteeDate,
    presidentDirectorName,
    presidentDirectorDate,
    periodStart,
    periodEnd,
    auditCoverage,
    departmentCoverage,
    area,
  ]);

  persistReportStateRef.current = persistReportStateNow;

  // Persist module tables (debounced) — keep OnlyOffice narrative from DB.
  useEffect(() => {
    if (!reportStateHydrated || !findingsLoadCompleted || !Number.isFinite(year)) return;
    if (Date.now() < skipPersistUntilRef.current) return;
    if (skipPersistOnceRef.current) {
      skipPersistOnceRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      persistReportStateRef.current?.({
        syncMode:
          onlyOfficeSyncRevisionRef.current > 0 ? "moduleTablesOnly" : undefined,
        protectOnlyOfficeNarrative: onlyOfficeSyncRevisionRef.current > 0,
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    reportStateHydrated,
    findingsLoadCompleted,
    year,
    findingSections,
    auditVisibleByDept,
    publishStatusByDept,
  ]);

  // Persist narrative edited in HTML preview — skip when OnlyOffice owns narrative (DB sync).
  useEffect(() => {
    if (!reportStateHydrated || !findingsLoadCompleted || !Number.isFinite(year)) return;
    if (Date.now() < skipPersistUntilRef.current) return;
    if (onlyOfficeSyncRevisionRef.current > 0) return;

    const timer = window.setTimeout(() => {
      persistReportStateRef.current?.({ narrativeFromPreviewEdit: true });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    reportStateHydrated,
    findingsLoadCompleted,
    year,
    appendices,
    executiveSummaryHtml,
    auditObjectivesScopeHtml,
    auditApproachMethodologyHtml,
    conclusionValues,
  ]);

  // Persist cover / signature block (audit team, prepared by, management approval).
  useEffect(() => {
    if (!reportStateHydrated || !findingsLoadCompleted || !Number.isFinite(year)) return;
    if (Date.now() < skipPersistUntilRef.current) return;

    const timer = window.setTimeout(() => {
      persistReportStateRef.current?.({ narrativeFromPreviewEdit: true });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    reportStateHydrated,
    findingsLoadCompleted,
    year,
    auditTeam,
    preparedBy,
    auditCommitteeName,
    auditCommitteeDate,
    presidentDirectorName,
    presidentDirectorDate,
    periodStart,
    periodEnd,
    auditCoverage,
    departmentCoverage,
    area,
  ]);

  const acknowledgeHubRevisionRef = useRef(null);
  const corruptionHealAttemptsRef = useRef(0);

  useEffect(() => {
    const init = hubRevisionInitRef.current;
    if (!init || !reportStateHydrated) return;
    onlyOfficeSyncRevisionRef.current = init.onlyOffice;
    hubRevisionRef.current = Math.max(init.moduleTables, init.onlyOffice, init.hub || 0);
    hubRevisionInitRef.current = null;
  }, [reportStateHydrated]);

  const applyCoverFieldsFromReportState = useCallback((saved) => {
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.periodStart === "string" && saved.periodStart.trim()) {
      setPeriodStart(saved.periodStart);
    }
    if (typeof saved.periodEnd === "string" && saved.periodEnd.trim()) {
      setPeriodEnd(saved.periodEnd);
    }
    if (typeof saved.auditCoverage === "string") {
      setAuditCoverage(saved.auditCoverage);
    }
    if (typeof saved.departmentCoverage === "string") {
      setDepartmentCoverage(saved.departmentCoverage);
    }
    if (typeof saved.area === "string") {
      setArea(saved.area);
    }
    if (Array.isArray(saved.auditTeam)) {
      setAuditTeam(
        saved.auditTeam.filter((m) => m && String(m.name ?? "").trim().length > 0),
      );
    } else if (saved.auditTeam === null) {
      setAuditTeam([]);
    }
    if (Array.isArray(saved.preparedBy)) {
      setPreparedBy(saved.preparedBy);
    } else if (saved.preparedBy === null) {
      setPreparedBy([]);
    }
    if (typeof saved.auditCommitteeName === "string") {
      setAuditCommitteeName(saved.auditCommitteeName);
    }
    if (saved.auditCommitteeDate != null) {
      setAuditCommitteeDate(parseDateForHtmlInput(saved.auditCommitteeDate));
    }
    if (typeof saved.presidentDirectorName === "string") {
      setPresidentDirectorName(saved.presidentDirectorName);
    }
    if (saved.presidentDirectorDate != null) {
      setPresidentDirectorDate(parseDateForHtmlInput(saved.presidentDirectorDate));
    }
  }, []);

  /** OnlyOffice / DB narrative — kept when module tables reload. */
  const applyNarrativeFromReportState = useCallback(
    (saved) => {
      const narrative = pickNarrativeFromReportState(saved);
      if (!narrative) return;

      applyCoverFieldsFromReportState(saved);

      if (narrative.auditVisibleByDept && typeof narrative.auditVisibleByDept === "object") {
        setAuditVisibleByDept(narrative.auditVisibleByDept);
        auditVisibleByDeptRef.current = narrative.auditVisibleByDept;
      }
      if (Array.isArray(narrative.appendices) && narrative.appendices.length > 0) {
        setAppendices(mergeWithDefaultAppendices(narrative.appendices));
      }
      if (narrative.executiveSummaryHtml != null) {
        const html = normalizeExecutiveSummaryHtml(narrative.executiveSummaryHtml, year);
        setExecutiveSummaryHtml(html);
        setDraftRichTextHtml(html);
      }
      if (narrative.auditObjectivesScopeHtml != null) {
        setAuditObjectivesScopeHtml(
          normalizeHtmlWithFallback(
            narrative.auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        );
      }
      if (narrative.auditApproachMethodologyHtml != null) {
        setAuditApproachMethodologyHtml(
          ensureAuditApproachMethodologyCompleteness(
            normalizeHtmlWithFallback(
              narrative.auditApproachMethodologyHtml,
              createDefaultAuditApproachMethodologyHtml(),
            ),
          ),
        );
      }
      if (narrative.conclusionValues && typeof narrative.conclusionValues === "object") {
        setConclusionValues(narrative.conclusionValues);
      }
      if (Number(narrative.onlyOfficeSyncRevision) > 0) {
        onlyOfficeSyncRevisionRef.current = Number(narrative.onlyOfficeSyncRevision);
      }
      narrativeSnapshotRef.current = narrative;
      if (saved && typeof saved === "object") {
        lastDbNarrativeRef.current = saved;
      }
    },
    [year, applyCoverFieldsFromReportState],
  );

  const collabClientIdRef = useRef(getPreviewTabClientId());
  const applyingRemoteWsRef = useRef(false);
  const wsPushTimerRef = useRef(null);
  const wsPushEnabledRef = useRef(false);
  const [wsPushEnabled, setWsPushEnabled] = useState(false);

  /** Build payload pushed to peers via WebSocket (instant, no HTTP). */
  const buildPreviewSyncPayload = useCallback(() => {
    return {
      periodStart: String(periodStart ?? "").trim(),
      periodEnd: String(periodEnd ?? "").trim(),
      auditCoverage: String(auditCoverage ?? "").trim(),
      departmentCoverage: String(departmentCoverage ?? "").trim(),
      area: String(area ?? "").trim(),
      auditTeam,
      preparedBy,
      auditCommitteeName: String(auditCommitteeName ?? "").trim(),
      auditCommitteeDate: String(auditCommitteeDate ?? "").trim(),
      presidentDirectorName: String(presidentDirectorName ?? "").trim(),
      presidentDirectorDate: String(presidentDirectorDate ?? "").trim(),
      appendices,
      executiveSummaryHtml: sanitizeExecutiveSummaryHtml(executiveSummaryHtml, year),
      auditObjectivesScopeHtml: sanitizeHtmlWithFallback(
        auditObjectivesScopeHtml,
        createDefaultAuditObjectivesScopeHtml(),
      ),
      auditApproachMethodologyHtml: ensureAuditApproachMethodologyCompleteness(
        sanitizeHtmlWithFallback(
          auditApproachMethodologyHtml,
          createDefaultAuditApproachMethodologyHtml(),
        ),
      ),
      conclusionValues,
      auditVisibleByDept: auditVisibleByDeptRef.current,
    };
  }, [
    periodStart,
    periodEnd,
    auditCoverage,
    departmentCoverage,
    area,
    auditTeam,
    preparedBy,
    auditCommitteeName,
    auditCommitteeDate,
    presidentDirectorName,
    presidentDirectorDate,
    appendices,
    executiveSummaryHtml,
    auditObjectivesScopeHtml,
    auditApproachMethodologyHtml,
    conclusionValues,
    year,
  ]);

  /** Apply state received directly from WebSocket peer. */
  const applyPreviewStateFromWs = useCallback(
    (state) => {
      if (!state || typeof state !== "object") return;
      applyingRemoteWsRef.current = true;
      skipPersistOnceRef.current = true;

      applyCoverFieldsFromReportState(state);
      applyNarrativeFromReportState(state);

      if (state.auditVisibleByDept && typeof state.auditVisibleByDept === "object") {
        setAuditVisibleByDept(state.auditVisibleByDept);
        auditVisibleByDeptRef.current = state.auditVisibleByDept;
      }

      lastDbNarrativeRef.current = {
        ...(lastDbNarrativeRef.current || {}),
        ...state,
      };
      setMeasuredChunks(null);

      window.setTimeout(() => {
        applyingRemoteWsRef.current = false;
      }, 500);
    },
    [applyCoverFieldsFromReportState, applyNarrativeFromReportState],
  );

  const joinOnlyOfficeEditor = useCallback(
    async (editorPath, options = {}) => {
      if (!editorPath) return;
      if (options.syncBeforeOpen !== false && Number.isFinite(year)) {
        try {
          skipPersistUntilRef.current = 0;
          flushPendingFieldUpdates();
          await persistReportStateRef.current?.({
            narrativeFromPreviewEdit: true,
            bypassSkipPersist: true,
          });
          const overlay =
            typeof options.overlay === "object" && options.overlay
              ? options.overlay
              : buildReportExportPayloadRef.current?.() || {};
          await syncReportDocxFromPreview(year, overlay);
        } catch (e) {
          console.warn("[preview] OnlyOffice sync before open:", e);
        }
      }
      router.replace(editorPath);
      window.setTimeout(() => {
        if (!window.location.pathname.includes("/Page/report/editor")) {
          window.location.replace(editorPath);
        }
      }, 600);
    },
    [year, router],
  );

  const handleOnlyOfficeRedirect = useCallback(
    (data) => {
      if (!data?.editorPath) return;
      joinOnlyOfficeEditor(data.editorPath);
    },
    [joinOnlyOfficeEditor],
  );

  const {
    participants: collabParticipants,
    wsConnected: collabWsConnected,
    clientId: collabClientId,
  } = usePreviewCollaboration(year, {
    location: "preview",
    onPreviewStatePush: applyPreviewStateFromWs,
    onOnlyOfficeRedirect: handleOnlyOfficeRedirect,
  });

  useEffect(() => {
    collabClientIdRef.current = collabClientId || getPreviewTabClientId();
  }, [collabClientId]);

  /** Re-join OnlyOffice if a teammate is still editing (e.g. browser Back from editor). */
  useEffect(() => {
    if (!clientReady || !Number.isFinite(year)) return undefined;

    let cancelled = false;

    const redirectIfOnlyOfficeLive = async () => {
      const collab = await getReportCollaborationStatus(year);
      if (cancelled) return;
      if (collab.ok && collab.onlyOfficeOpen && collab.editorPath) {
        joinOnlyOfficeEditor(collab.editorPath);
      }
    };

    void redirectIfOnlyOfficeLive();

    const onPageShow = (ev) => {
      if (ev.persisted) void redirectIfOnlyOfficeLive();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [clientReady, year, joinOnlyOfficeEditor]);

  useEffect(() => {
    if (!clientReady || !Number.isFinite(year)) return;
    const someoneInOnlyOffice = collabParticipants.some((p) => p.location === "onlyoffice");
    if (!someoneInOnlyOffice) return;

    let cancelled = false;
    void getReportCollaborationStatus(year).then((collab) => {
      if (cancelled) return;
      if (collab.ok && collab.onlyOfficeOpen && collab.editorPath) {
        joinOnlyOfficeEditor(collab.editorPath);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clientReady, year, collabParticipants, joinOnlyOfficeEditor]);

  /** Push local edits to all preview peers via WebSocket (queued until connected). */
  const broadcastPreviewStateNow = useCallback(
    (override = {}, { force = false } = {}) => {
      if (applyingRemoteWsRef.current) return;
      if (!force && !wsPushEnabledRef.current) return;
      if (!Number.isFinite(year)) return;
      pushPreviewStateToPeers(year, {
        clientId: collabClientIdRef.current,
        state: { ...buildPreviewSyncPayload(), ...override },
      });
    },
    [year, buildPreviewSyncPayload],
  );

  const scheduleWsStatePush = useCallback(() => {
    if (applyingRemoteWsRef.current) return;
    if (!wsPushEnabledRef.current) return;
    if (!Number.isFinite(year)) return;
    if (wsPushTimerRef.current) {
      window.clearTimeout(wsPushTimerRef.current);
    }
    wsPushTimerRef.current = window.setTimeout(() => {
      wsPushTimerRef.current = null;
      broadcastPreviewStateNow();
    }, 80);
  }, [year, broadcastPreviewStateNow]);

  useEffect(() => {
    if (!reportStateHydrated) {
      wsPushEnabledRef.current = false;
      setWsPushEnabled(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      wsPushEnabledRef.current = true;
      setWsPushEnabled(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [reportStateHydrated]);

  useEffect(() => {
    if (!reportStateHydrated || !wsPushEnabled) return;
    scheduleWsStatePush();
  }, [
    reportStateHydrated,
    wsPushEnabled,
    scheduleWsStatePush,
    auditCommitteeName,
    auditCommitteeDate,
    presidentDirectorName,
    presidentDirectorDate,
    appendices,
    executiveSummaryHtml,
    auditObjectivesScopeHtml,
    auditApproachMethodologyHtml,
    conclusionValues,
    auditVisibleByDept,
    periodStart,
    periodEnd,
    auditCoverage,
    departmentCoverage,
    area,
  ]);

  useEffect(
    () => () => {
      if (wsPushTimerRef.current) {
        window.clearTimeout(wsPushTimerRef.current);
      }
      if (aiStatusTimerRef.current) {
        window.clearTimeout(aiStatusTimerRef.current);
      }
    },
    [],
  );

  const handleAiApply = useCallback(
    (patch) => {
      if (!patch || typeof patch !== "object") return;
      const wsOverride = {};

      if (patch.executiveSummaryHtml != null) {
        const html = normalizeExecutiveSummaryHtml(patch.executiveSummaryHtml, year);
        setExecutiveSummaryHtml(html);
        setDraftRichTextHtml(html);
        wsOverride.executiveSummaryHtml = sanitizeExecutiveSummaryHtml(html, year);
      }

      if (patch.conclusionValues && typeof patch.conclusionValues === "object") {
        setConclusionValues((prev) => {
          const next = { ...prev, ...patch.conclusionValues };
          wsOverride.conclusionValues = next;
          return next;
        });
        setShowConclusionForm(true);
      }

      if (Object.keys(wsOverride).length > 0) {
        window.setTimeout(() => {
          broadcastPreviewStateNow(wsOverride, { force: true });
        }, 0);
      }
    },
    [year, broadcastPreviewStateNow],
  );

  const clearAiStatusSoon = useCallback((delayMs = 2000) => {
    if (aiStatusTimerRef.current) {
      window.clearTimeout(aiStatusTimerRef.current);
    }
    aiStatusTimerRef.current = window.setTimeout(() => {
      setAiStatus("");
      aiStatusTimerRef.current = null;
    }, delayMs);
  }, []);

  const handleGenerateConclusionAi = useCallback(
    async (section) => {
      if (!section?.deptKey || !Number.isFinite(year)) return;
      const deptKey = section.deptKey;
      if (aiStatusTimerRef.current) {
        window.clearTimeout(aiStatusTimerRef.current);
        aiStatusTimerRef.current = null;
      }
      setConclusionAiLoadingDept(deptKey);
      setAiStatus(`Generating conclusion for ${section.deptLabel || deptKey}…`);

      try {
        const auditRows = auditRowsForDept(deptKey, false);
        const res = await fetch("/api/report/ai/assist", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            task: "conclusion_dept",
            deptKey,
            deptSection: {
              deptKey,
              deptLabel: section.deptLabel,
              executiveSummary: section.executiveSummary ?? null,
              sopRows: section.sopRows || [],
              auditRows: auditRows.length ? auditRows : section.auditRows || [],
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          throw new Error(json.error || `AI failed (${res.status})`);
        }
        const text = String(json.text || "").trim();
        if (!text) {
          throw new Error("AI tidak mengembalikan teks. Coba lagi.");
        }
        handleAiApply({ conclusionValues: { [deptKey]: text } });
        setAiStatus(`Conclusion generated for ${section.deptLabel || deptKey}.`);
        clearAiStatusSoon(2000);
      } catch (e) {
        if (aiStatusTimerRef.current) {
          window.clearTimeout(aiStatusTimerRef.current);
          aiStatusTimerRef.current = null;
        }
        setAiStatus("");
        window.alert(e?.message || "Generate conclusion failed");
      } finally {
        setConclusionAiLoadingDept(null);
      }
    },
    [year, handleAiApply, auditRowsForDept, clearAiStatusSoon],
  );

  /** Terapkan snapshot hub (narasi OnlyOffice + tabel modul) ke UI preview. */
  const applyHubSnapshot = useCallback(
    (snap, options = {}) => {
      if (!snap || snap.success === false) return;
      const freshModuleReload = options.freshModuleReload === true;

      skipPersistOnceRef.current = true;
      if (Number(snap.hubRevision) > 0) {
        hubRevisionRef.current = Number(snap.hubRevision);
        acknowledgeHubRevisionRef.current?.(snap.hubRevision);
      }
      if (Number(snap.onlyOfficeSyncRevision) > 0) {
        onlyOfficeSyncRevisionRef.current = Number(snap.onlyOfficeSyncRevision);
      }

      const narrativeSource = snap.state || snap.narrative;
      if (narrativeSource && typeof narrativeSource === "object") {
        lastDbNarrativeRef.current = snap.state || narrativeSource;
        const { auditVisibleByDept: _vis, ...narrativeOnly } = narrativeSource;
        applyNarrativeFromReportState(narrativeOnly);
      }

      const lockedByDeptSnap = snap.lockedByDept || {};
      const hubVisible = snap.auditVisibleByDept || auditVisibleByDeptRef.current || {};
      const syncedVisible = syncAuditVisibleFromLockedByDept(lockedByDeptSnap, hubVisible);
      for (const [deptKey, pending] of Object.entries(pendingPublishByDeptRef.current)) {
        if (pending === false) syncedVisible[deptKey] = false;
        else if (pending === true) syncedVisible[deptKey] = true;
      }
      setAuditVisibleByDept(syncedVisible);
      auditVisibleByDeptRef.current = syncedVisible;
      syncPublishFromLockedByDept(lockedByDeptSnap);
      if (snap.hiddenAuditFindingEdits && typeof snap.hiddenAuditFindingEdits === "object") {
        hiddenAuditEditsRef.current = {
          ...hiddenAuditEditsRef.current,
          ...snap.hiddenAuditFindingEdits,
        };
      }

      const moduleSections = Array.isArray(snap.sections) ? snap.sections : [];
      const dbSections = Array.isArray(snap.state?.findingSections) ? snap.state.findingSections : [];
      const sections = mergeModuleSectionsForHub(dbSections, moduleSections);
      const lockedByDept = lockedByDeptSnap;
      const preservedSource = freshModuleReload
        ? []
        : savedFindingSectionsRef.current.length > 0
          ? savedFindingSectionsRef.current
          : findingSectionsRef.current;
      const merged = mergePreservedFindingSections(
        sections,
        preservedSource,
        lockedByDept,
        hiddenAuditEditsRef.current,
        { freshModuleReload },
      );
      /** Module/hub rows selalu menang atas shell kosong dari client setelah unlock. */
      const withModuleRows = mergeModuleSectionsForHub(sections, merged);
      hiddenAuditEditsRef.current = {
        ...hiddenAuditEditsRef.current,
        ...collectHiddenAuditEdits(withModuleRows),
      };
      const clientSections = stripFindingSectionsForClient(withModuleRows);
      setFindingSections(clientSections);
      setHubModuleSections(sections);
      savedFindingSectionsRef.current = clientSections;
      findingSectionsRef.current = clientSections;
      /** Simpan data modul utuh untuk fallback renderer — jangan timpa dengan state tampilan. */
      lastDbNarrativeRef.current = {
        ...(snap.state || lastDbNarrativeRef.current || {}),
        findingSections: sections,
        auditVisibleByDept: syncedVisible,
      };
      setMeasuredChunks(null);

    },
    [applyNarrativeFromReportState, syncPublishFromLockedByDept],
  );

  const applyHubSnapshotRef = useRef(applyHubSnapshot);
  applyHubSnapshotRef.current = applyHubSnapshot;

  const onHubSnapshotAutoRefresh = useCallback(
    async (snap) => {
      applyHubSnapshot(snap, { freshModuleReload: true });
    },
    [applyHubSnapshot],
  );

  const { forceRefreshHub, acknowledgeHubRevision } = usePreviewHubAutoRefresh(
    year,
    onHubSnapshotAutoRefresh,
  );
  acknowledgeHubRevisionRef.current = acknowledgeHubRevision;
  const forceRefreshHubRef = useRef(forceRefreshHub);
  forceRefreshHubRef.current = forceRefreshHub;

  /** Pull latest SOP/Audit rows from module APIs (not stale DB snapshot). */
  const reloadModulesIntoPreview = useCallback(() => {
    sopModuleRefreshRef.current = true;
    void forceRefreshHub();
  }, [forceRefreshHub]);

  const onSopReviewDataChanged = useCallback(() => {
    reloadModulesIntoPreview();
  }, [reloadModulesIntoPreview]);

  useSopReviewRealtime(year, onSopReviewDataChanged);

  // Lock/unlock from Audit Review → update visibility + muat ulang findings di HTML preview.
  useEffect(() => {
    const applyVisibilityToSections = (deptKey, visible) => {
      setFindingSections((prev) => {
        const next = prev.map((section) =>
          section.deptKey === deptKey
            ? { ...section, isPublishedToReport: visible === true }
            : section,
        );
        savedFindingSectionsRef.current = next;
        findingSectionsRef.current = next;
        return next;
      });
      setMeasuredChunks(null);
    };

    const syncFromServer = async (detail) => {
      const eventReportYear =
        detail?.reportYear != null
          ? Number(detail.reportYear)
          : detail?.year != null
            ? Number(detail.year)
            : null;
      if (eventReportYear != null && Number.isFinite(eventReportYear) && eventReportYear !== year) {
        return;
      }
      if (detail?.deptKey) {
        const visible = detail.isLocked === true;
        applyPublishEvent(detail);
        pendingPublishByDeptRef.current[detail.deptKey] = visible;
        setAuditVisibleByDept((prev) => {
          const next = { ...prev, [detail.deptKey]: visible };
          auditVisibleByDeptRef.current = next;
          return next;
        });
        applyVisibilityToSections(detail.deptKey, visible);
      }
      flushPendingFieldUpdates();
      if (detail?.deptKey) {
        sopModuleRefreshRef.current = true;
        setMeasuredChunks(null);
        setFindingsReloadToken((t) => t + 1);
      }
      await forceRefreshHub();
      window.setTimeout(() => {
        refreshPublishStatus();
      }, 2500);
    };
    const onStorage = (e) => {
      if (e.key !== AUDIT_REVIEW_PUBLISH_CHANGED_KEY) return;
      try {
        const detail = JSON.parse(e.newValue || "{}");
        syncFromServer(detail);
      } catch {
        syncFromServer({});
      }
    };
    const onPublishChanged = (e) => syncFromServer(e.detail || {});
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, onPublishChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, onPublishChanged);
    };
  }, [year, refreshPublishStatus, forceRefreshHub, applyPublishEvent]);

  useEffect(() => {
    let focusDebounce = null;
    const lastFocusReloadRef = { at: 0 };
    const scheduleModuleReload = () => {
      window.clearTimeout(focusDebounce);
      focusDebounce = window.setTimeout(() => {
        const now = Date.now();
        if (now - lastFocusReloadRef.at < 30000) return;
        lastFocusReloadRef.at = now;
        reloadModulesIntoPreview();
      }, 300);
    };
    const onFocus = () => scheduleModuleReload();
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleModuleReload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(focusDebounce);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadModulesIntoPreview]);

  useEffect(() => {
    try {
      localStorage.setItem(appendicesStorageKey, JSON.stringify(appendices));
    } catch {
      // ignore localStorage failures
    }
  }, [appendices, appendicesStorageKey]);

  useEffect(() => {
    if (!reportStateHydrated) return;
    if (onlyOfficeSyncRevisionRef.current > 0) return;

    try {
      const raw = localStorage.getItem(executiveSummaryStorageKey);
      if (!raw) {
        const defaultHtml = createDefaultExecutiveSummaryHtml(year);
        setExecutiveSummaryHtml(defaultHtml);
        setDraftRichTextHtml(defaultHtml);
        return;
      }
      const savedHtml = normalizeExecutiveSummaryHtml(raw, year);
      setExecutiveSummaryHtml(savedHtml);
      setDraftRichTextHtml(savedHtml);
    } catch {
      const defaultHtml = createDefaultExecutiveSummaryHtml(year);
      setExecutiveSummaryHtml(defaultHtml);
      setDraftRichTextHtml(defaultHtml);
    }
  }, [executiveSummaryStorageKey, year, reportStateHydrated]);

  useEffect(() => {
    try {
      localStorage.setItem(
        executiveSummaryStorageKey,
        sanitizeExecutiveSummaryHtml(executiveSummaryHtml, year),
      );
    } catch {
      // ignore localStorage failures
    }
  }, [executiveSummaryHtml, executiveSummaryStorageKey, year]);

  useEffect(() => {
    draftRichTextRef.current = draftRichTextHtml;
  }, [draftRichTextHtml]);

  useEffect(() => {
    if (!reportStateHydrated) return;
    try {
      const raw = localStorage.getItem(auditObjectivesScopeStorageKey);
      setAuditObjectivesScopeHtml(
        normalizeHtmlWithFallback(raw, createDefaultAuditObjectivesScopeHtml()),
      );
    } catch {
      setAuditObjectivesScopeHtml(createDefaultAuditObjectivesScopeHtml());
    }
  }, [auditObjectivesScopeStorageKey, year, reportStateHydrated]);

  useEffect(() => {
    try {
      localStorage.setItem(
        auditObjectivesScopeStorageKey,
        sanitizeHtmlWithFallback(auditObjectivesScopeHtml, createDefaultAuditObjectivesScopeHtml()),
      );
    } catch {
      // ignore localStorage failures
    }
  }, [auditObjectivesScopeHtml, auditObjectivesScopeStorageKey, year]);

  useEffect(() => {
    if (!reportStateHydrated) return;
    try {
      const raw = localStorage.getItem(auditApproachMethodologyStorageKey);
      setAuditApproachMethodologyHtml(
        ensureAuditApproachMethodologyCompleteness(
          normalizeHtmlWithFallback(raw, createDefaultAuditApproachMethodologyHtml()),
        ),
      );
    } catch {
      setAuditApproachMethodologyHtml(createDefaultAuditApproachMethodologyHtml());
    }
  }, [auditApproachMethodologyStorageKey, year, reportStateHydrated]);

  useEffect(() => {
    try {
      localStorage.setItem(
        auditApproachMethodologyStorageKey,
        ensureAuditApproachMethodologyCompleteness(
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ),
      );
    } catch {
      // ignore localStorage failures
    }
  }, [auditApproachMethodologyHtml, auditApproachMethodologyStorageKey, year]);

  useEffect(() => {
    if (!richTextEditorSection || !executiveSummaryEditorRef.current) return;
    executiveSummaryEditorRef.current.innerHTML = normalizeExecutiveSummaryHtml(
      draftRichTextRef.current,
      year,
    );
  }, [richTextEditorSection, year]);

  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (
        !executiveSummaryMeasureBlocksRef.current ||
        !executiveSummaryFirstSlotRef.current ||
        !executiveSummaryNextSlotRef.current
      ) {
        const nextChunks = [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)];
        setExecutiveSummaryChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const blockNodes = Array.from(
        executiveSummaryMeasureBlocksRef.current.querySelectorAll("[data-executive-summary-block]"),
      );

      if (blockNodes.length === 0 || executiveSummaryBlocks.length === 0) {
        const nextChunks = [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)];
        setExecutiveSummaryChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const firstLimit = Math.max(
        120,
        executiveSummaryFirstSlotRef.current.clientHeight -
          EXECUTIVE_SUMMARY_PAGE_SAFE_PX -
          EXECUTIVE_SUMMARY_FIRST_PAGE_EXTRA_PX,
      );
      const nextLimit = Math.max(
        120,
        executiveSummaryNextSlotRef.current.clientHeight - EXECUTIVE_SUMMARY_PAGE_SAFE_PX,
      );

      if (!firstLimit || !nextLimit) {
        const nextChunks = [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)];
        setExecutiveSummaryChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const chunks = [];
      let current = [];
      let sum = 0;
      let limit = firstLimit;

      blockNodes.forEach((node, idx) => {
        const style = window.getComputedStyle(node);
        const marginTop = parseFloat(style.marginTop || "0") || 0;
        const marginBottom = parseFloat(style.marginBottom || "0") || 0;
        const height = node.offsetHeight + marginTop + marginBottom;

        if (sum + height > limit && current.length > 0) {
          const joined = current.join("");
          if (htmlPageHasVisibleContent(joined)) chunks.push(joined);
          current = [];
          sum = 0;
          limit = nextLimit;
        }

        current.push(executiveSummaryBlocks[idx]);
        sum += height;
      });

      if (current.length > 0) {
        const joined = current.join("");
        if (htmlPageHasVisibleContent(joined)) chunks.push(joined);
      }

      if (!cancelled) {
        const fallback = [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)];
        const nextChunks =
          chunks.length > 0 ? chunks : filterMeaningfulHtmlPages(fallback);
        setExecutiveSummaryChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
      }
    };

    const timer = window.setTimeout(measure, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [executiveSummaryHtml, executiveSummaryBlocks, year]);

  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (
        !auditObjectivesMeasureBlocksRef.current ||
        !auditObjectivesFirstSlotRef.current ||
        !auditObjectivesNextSlotRef.current
      ) {
        const nextChunks = [
          sanitizeHtmlWithFallback(
            auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        ];
        setAuditObjectivesScopeChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const blockNodes = Array.from(
        auditObjectivesMeasureBlocksRef.current.querySelectorAll("[data-audit-objectives-block]"),
      );

      if (blockNodes.length === 0 || auditObjectivesScopeBlocks.length === 0) {
        const nextChunks = [
          sanitizeHtmlWithFallback(
            auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        ];
        setAuditObjectivesScopeChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const firstLimit = Math.max(
        120,
        auditObjectivesFirstSlotRef.current.clientHeight -
          EXECUTIVE_SUMMARY_PAGE_SAFE_PX -
          EXECUTIVE_SUMMARY_FIRST_PAGE_EXTRA_PX,
      );
      const nextLimit = Math.max(
        120,
        auditObjectivesNextSlotRef.current.clientHeight - EXECUTIVE_SUMMARY_PAGE_SAFE_PX,
      );

      if (!firstLimit || !nextLimit) {
        const nextChunks = [
          sanitizeHtmlWithFallback(
            auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        ];
        setAuditObjectivesScopeChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const chunks = [];
      let current = [];
      let sum = 0;
      let limit = firstLimit;

      blockNodes.forEach((node, idx) => {
        const style = window.getComputedStyle(node);
        const marginTop = parseFloat(style.marginTop || "0") || 0;
        const marginBottom = parseFloat(style.marginBottom || "0") || 0;
        const height = node.offsetHeight + marginTop + marginBottom;

        if (sum + height > limit && current.length > 0) {
          const joined = current.join("");
          if (htmlPageHasVisibleContent(joined)) chunks.push(joined);
          current = [];
          sum = 0;
          limit = nextLimit;
        }

        current.push(auditObjectivesScopeBlocks[idx]);
        sum += height;
      });

      if (current.length > 0) {
        const joined = current.join("");
        if (htmlPageHasVisibleContent(joined)) chunks.push(joined);
      }

      if (!cancelled) {
        const fallback = [
          sanitizeHtmlWithFallback(
            auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        ];
        const nextChunks =
          chunks.length > 0 ? chunks : filterMeaningfulHtmlPages(fallback);
        setAuditObjectivesScopeChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
      }
    };

    const timer = window.setTimeout(measure, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auditObjectivesScopeBlocks, auditObjectivesScopeHtml]);

  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (
        !auditApproachMeasureBlocksRef.current ||
        !auditApproachFirstSlotRef.current ||
        !auditApproachNextSlotRef.current
      ) {
        const nextChunks = [
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ];
        setAuditApproachMethodologyChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const blockNodes = Array.from(
        auditApproachMeasureBlocksRef.current.querySelectorAll("[data-audit-approach-block]"),
      );

      if (blockNodes.length === 0 || auditApproachMethodologyBlocks.length === 0) {
        const nextChunks = [
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ];
        setAuditApproachMethodologyChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const firstLimit = Math.max(
        120,
        auditApproachFirstSlotRef.current.clientHeight -
          AUDIT_APPROACH_PAGE_SAFE_PX -
          AUDIT_APPROACH_FIRST_PAGE_EXTRA_PX,
      );
      const nextLimit = Math.max(
        120,
        auditApproachNextSlotRef.current.clientHeight - AUDIT_APPROACH_PAGE_SAFE_PX,
      );

      if (!firstLimit || !nextLimit) {
        const nextChunks = [
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ];
        setAuditApproachMethodologyChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
        return;
      }

      const chunks = [];
      let current = [];
      let sum = 0;
      let limit = firstLimit;

      blockNodes.forEach((node, idx) => {
        const style = window.getComputedStyle(node);
        const marginTop = parseFloat(style.marginTop || "0") || 0;
        const marginBottom = parseFloat(style.marginBottom || "0") || 0;
        const height = node.offsetHeight + marginTop + marginBottom;

        if (sum + height > limit && current.length > 0) {
          const joined = current.join("");
          if (htmlPageHasVisibleContent(joined)) chunks.push(joined);
          current = [];
          sum = 0;
          limit = nextLimit;
        }

        current.push(auditApproachMethodologyBlocks[idx]);
        sum += height;
      });

      if (current.length > 0) {
        const joined = current.join("");
        if (htmlPageHasVisibleContent(joined)) chunks.push(joined);
      }

      if (!cancelled) {
        const fallback = [
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ];
        const nextChunks =
          chunks.length > 0 ? chunks : filterMeaningfulHtmlPages(fallback);
        setAuditApproachMethodologyChunks((prev) =>
          isSerializedEqual(prev, nextChunks) ? prev : nextChunks,
        );
      }
    };

    const timer = window.setTimeout(measure, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auditApproachMethodologyBlocks, auditApproachMethodologyHtml]);

  useEffect(() => {
    if (!findingModalDeptKey) return;
    const current = selectedFindingByDept[findingModalDeptKey];
    setModalCheckedIndices(Array.isArray(current) && current.length > 0 ? [...current].sort((a, b) => a - b) : []);
  }, [findingModalDeptKey, selectedFindingByDept]);


  useEffect(() => {
    let cancelled = false;
    const loadSeq = ++moduleLoadSeqRef.current;
    setFindingsLoadCompleted(false);
    findingsLoadInProgressRef.current = true;
    const freshModuleReload = sopModuleRefreshRef.current;
    sopModuleRefreshRef.current = false;

    async function loadFindings() {
      try {
        let snap = null;
        try {
          const snapRes = await fetch(
            `/api/report/hub/snapshot?year=${encodeURIComponent(String(year))}&_=${Date.now()}`,
            { cache: "no-store", credentials: "include" },
          );
          snap = await snapRes.json().catch(() => ({}));
        } catch (err) {
          console.warn("[REPORT-PREVIEW] hub snapshot failed:", err);
        }

        if (!snap?.success) {
          const loaded = await loadFindingSectionsFromModules(year, {
            pendingPublishByDept: pendingPublishByDeptRef.current,
          });
          snap = {
            success: true,
            sections: loaded.sections,
            lockedByDept: loaded.lockedByDept,
            state: lastDbNarrativeRef.current,
          };
        }

        if (!cancelled && loadSeq === moduleLoadSeqRef.current && snap?.success) {
          const dbFallback =
            snap.state?.findingSections || lastDbNarrativeRef.current?.findingSections || [];
          if ((!snap.sections || snap.sections.length === 0) && dbFallback.length > 0) {
            snap.sections = dbFallback;
          }
          applyHubSnapshotRef.current?.(snap, { freshModuleReload });
          const moduleSectionsForCheck = Array.isArray(snap.sections) ? snap.sections : [];
          if (
            findingSectionsLookCorrupted(moduleSectionsForCheck, snap.lockedByDept || {}) &&
            !sopModuleRefreshRef.current &&
            corruptionHealAttemptsRef.current < 1
          ) {
            corruptionHealAttemptsRef.current += 1;
            sopModuleRefreshRef.current = true;
            window.setTimeout(() => void forceRefreshHubRef.current?.(), 0);
          }
          if (Object.keys(pendingPublishByDeptRef.current).length > 0) {
            pendingPublishByDeptRef.current = {};
          }
          const persistSeq = loadSeq;
          const clientSections = savedFindingSectionsRef.current;
          skipPersistOnceRef.current = true;
          void (async () => {
            if (persistSeq !== moduleLoadSeqRef.current) return;
            const persistRes = await persistReportStateRef.current?.({
              syncMode:
                onlyOfficeSyncRevisionRef.current > 0 ? "moduleTablesOnly" : undefined,
              protectOnlyOfficeNarrative: onlyOfficeSyncRevisionRef.current > 0,
            });
            if (persistSeq !== moduleLoadSeqRef.current) return;
            try {
              const persistJson = await persistRes?.json?.().catch(() => ({}));
              if (persistJson?.state) {
                acknowledgeHubRevisionRef.current?.(getHubRevision(persistJson.state));
              }
            } catch {
              /* ignore */
            }
            if (persistSeq !== moduleLoadSeqRef.current) return;
            if (!freshModuleReload) return;
            try {
              window.dispatchEvent(
                new CustomEvent("kias-report-modules-synced", {
                  detail: {
                    year,
                    reportYear: year,
                    moduleTablesHash: computeModuleTablesHash(clientSections),
                    onlyOfficeSyncRevision: onlyOfficeSyncRevisionRef.current,
                    source: "module-tables",
                  },
                }),
              );
            } catch {
              /* ignore */
            }
          })();
        }
      } finally {
        if (loadSeq === moduleLoadSeqRef.current) {
          findingsLoadInProgressRef.current = false;
          setFindingsLoadCompleted(true);
        }
      }
    }

    void loadFindings();

    return () => {
      cancelled = true;
    };
  }, [year, findingsReloadToken]);

  useEffect(() => {
    findingSectionsRef.current = findingSections;
  }, [findingSections]);

  // Tinggi area konten per halaman A4 (px), untuk pengukuran otomatis seperti Word.
  // Dibuat lebih konservatif agar baris terakhir tidak menyentuh footer; jika tinggi konten
  // melebihi batas ini, sisa baris otomatis pindah ke halaman berikutnya.
  const FINDING_SOP_TABLE_HEIGHT_PX = 660;
  // Audit table dibuat sedikit lebih konservatif karena kolom lebih banyak dan
  // teks panjang lebih mudah mendorong konten mendekati footer.
  const FINDING_AUDIT_TABLE_HEIGHT_PX = 560;
  const FINDING_FIRST_PAGE_TOP_BUFFER_PX = 48;
  const FINDING_FIRST_PAGE_EXEC_SUMMARY_BUFFER_PX = 84;
  const FINDING_TABLE_ROW_GUARD_PX = 6;
  const FINDING_TABLE_PAGE_END_GUARD_PX = 8;
  const FINDING_AUDIT_SECTION_CHROME_PX = 40;
  /**
   * Pagination pakai findingSections (source utuh), bukan displayFindingSections yang
   * sudah di-strip — cegah auditRows hilang di renderer meski DB/state masih punya data.
   */
  const paginatedFindingSections = useMemo(
    () =>
      findingSections
        .map((section) => {
          const locked = isDeptPublishedToReport(section.deptKey, effectivePublishByDept);
          const hubSec = lastDbNarrativeRef.current?.findingSections?.find(
            (s) => s.deptKey === section.deptKey,
          );
          const hubAudit = hubSec?.auditRows || [];
          const hubSop = hubSec?.sopRows || [];
          const rawSop = section.sopRows?.length ? section.sopRows : hubSop;
          const rawAudit = section.auditRows?.length
            ? section.auditRows
            : locked
              ? hubAudit.length
                ? hubAudit
                : hiddenAuditEditsRef.current[section.deptKey] || []
              : [];
          return {
            ...section,
            sopRows: expandSopRowsForPagination(rawSop),
            auditRows: locked ? expandAuditRowsForPagination(rawAudit) : [],
            executiveSummary: locked ? section.executiveSummary : null,
          };
        })
        .filter((section) => {
          const locked = isDeptPublishedToReport(section.deptKey, effectivePublishByDept);
          const hasSop = (section.sopRows?.length || 0) > 0;
          const hasAudit = locked && (section.auditRows?.length || 0) > 0;
          const hasExec =
            locked &&
            executiveSummaryRowHasContent(
              buildDeptExecutiveSummaryFromRow(section.executiveSummary),
            );
          return hasSop || hasAudit || hasExec;
        }),
    [findingSections, effectivePublishByDept],
  );

  /**
   * Ukur tinggi riil tabel dan bagi chunk agar tiap halaman terisi penuh (seperti Word).
   * Dipanggil setelah measurement block di-render.
   */
  useEffect(() => {
    if (!paginatedFindingSections.length || !measureContainerRef.current) return;
    const container = measureContainerRef.current;
    let cancelled = false;
    const sopChunksByDept = {};
    const auditChunksByDept = {};

    const measureTableChunks = (tableEl, rows, firstLimitHeight, nextLimitHeight) => {
      if (!rows.length) return [];
      const tbody = tableEl?.querySelector("tbody");
      const trs = tbody?.querySelectorAll("tr");
      if (!trs?.length) {
        return [
          {
            rows: [...rows],
            height: 0,
            limit: Math.max(120, firstLimitHeight - FINDING_TABLE_PAGE_END_GUARD_PX),
          },
        ];
      }
      const heights = Array.from(trs).map((tr) => tr.getBoundingClientRect().height);
      const chunks = [];
      let chunk = [];
      let sum = 0;
      let currentLimit = Math.max(120, firstLimitHeight - FINDING_TABLE_PAGE_END_GUARD_PX);
      for (let i = 0; i < rows.length; i++) {
        const h = (heights[i] ?? 40) + FINDING_TABLE_ROW_GUARD_PX;
        if (h > currentLimit && chunk.length > 0) {
          chunks.push({ rows: chunk, height: sum, limit: currentLimit });
          chunk = [];
          sum = 0;
          currentLimit = Math.max(120, nextLimitHeight - FINDING_TABLE_PAGE_END_GUARD_PX);
        }
        if (h > currentLimit && chunk.length === 0) {
          // Satu baris lebih tinggi dari halaman — tetap taruh sendiri supaya tidak menarik baris lain.
          chunks.push({ rows: [rows[i]], height: h, limit: currentLimit });
          continue;
        }
        if (sum + h > currentLimit && chunk.length > 0) {
          chunks.push({ rows: chunk, height: sum, limit: currentLimit });
          chunk = [];
          sum = 0;
          currentLimit = Math.max(120, nextLimitHeight - FINDING_TABLE_PAGE_END_GUARD_PX);
        }
        chunk.push(rows[i]);
        sum += h;
      }
      if (chunk.length > 0) chunks.push({ rows: chunk, height: sum, limit: currentLimit });
      return chunks;
    };

    const runMeasure = () => {
      if (cancelled || !container.isConnected) return;
      paginatedFindingSections.forEach((section) => {
        const firstPageBuffer =
          FINDING_FIRST_PAGE_TOP_BUFFER_PX +
          (section.executiveSummary ? FINDING_FIRST_PAGE_EXEC_SUMMARY_BUFFER_PX : 0);
        const sopTable = container.querySelector(`[data-measure-sop="${section.deptKey}"]`);
        if (sopTable && section.sopRows.length > 0) {
          sopChunksByDept[section.deptKey] = measureTableChunks(
            sopTable,
            section.sopRows,
            FINDING_SOP_TABLE_HEIGHT_PX - firstPageBuffer,
            FINDING_SOP_TABLE_HEIGHT_PX,
          );
        }
        if (section.auditRows.length > 0) {
          const auditTable = container.querySelector(
            `[data-measure-audit="${section.deptKey}"]`,
          );
          if (auditTable) {
            auditChunksByDept[section.deptKey] = measureTableChunks(
              auditTable,
              section.auditRows,
              FINDING_AUDIT_TABLE_HEIGHT_PX - firstPageBuffer,
              FINDING_AUDIT_TABLE_HEIGHT_PX,
            );
          }
        }
      });
      if (!cancelled) {
        const nextChunks = { sop: sopChunksByDept, audit: auditChunksByDept };
        setMeasuredChunks((prev) => (isSerializedEqual(prev, nextChunks) ? prev : nextChunks));
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(runMeasure);
    });
    return () => { cancelled = true; };
  }, [
    paginatedFindingSections,
    FINDING_AUDIT_TABLE_HEIGHT_PX,
    FINDING_FIRST_PAGE_EXEC_SUMMARY_BUFFER_PX,
    FINDING_FIRST_PAGE_TOP_BUFFER_PX,
    FINDING_SOP_TABLE_HEIGHT_PX,
  ]);

  useEffect(() => {
    const run = () => {
      document.querySelectorAll("[data-plain-autoresize]").forEach((el) => {
        autoResizePlainTextarea(el);
      });
    };
    run();
    const timer = window.setTimeout(run, 0);
    return () => window.clearTimeout(timer);
  }, [paginatedFindingSections, measuredChunks]);

  /** Hanya Conclusion: zona aman (px) di atas footer; isi halaman dulu baru next page. */
  const CONCLUSION_SAFE_ZONE_PX = 50;
  const CONCLUSION_PAGE_MAX_HEIGHT_PX = 780;
  const CONCLUSION_FIRST_PAGE_EXTRA_PX = 80;

  /**
   * Hanya Conclusion: ukur blok teks per department-chunk agar teks panjang bisa lanjut ke page berikutnya.
   */
  useEffect(() => {
    if (!showConclusionPaper || conclusionDeptSections.length === 0 || !conclusionMeasureRef.current) {
      return;
    }
    const conclusionSegments = buildConclusionDeptSegments(
      conclusionDeptSections,
      conclusionValues,
    );
    if (conclusionSegments.length === 0) {
      setConclusionChunks([]);
      return;
    }
    const container = conclusionMeasureRef.current;
    let cancelled = false;
    const runMeasure = () => {
      if (cancelled || !container.isConnected) return;
      const blocks = container.querySelectorAll("[data-conclusion-block]");
      if (!blocks.length || blocks.length !== conclusionSegments.length) return;
      const heights = Array.from(blocks).map((el) => el.getBoundingClientRect().height);
      const chunks = paginateConclusionSegments(conclusionSegments, heights, {
        spacing: 18,
        limitFirst: CONCLUSION_PAGE_MAX_HEIGHT_PX - CONCLUSION_FIRST_PAGE_EXTRA_PX,
        limitPage: CONCLUSION_PAGE_MAX_HEIGHT_PX,
      });
      if (!cancelled) setConclusionChunks(chunks);
    };
    requestAnimationFrame(() => requestAnimationFrame(runMeasure));
    const ro = new ResizeObserver(() => requestAnimationFrame(runMeasure));
    ro.observe(container);
    return () => { cancelled = true; ro.disconnect(); };
  }, [showConclusionPaper, conclusionDeptSections, conclusionValues]);

  const conclusionChunksLength = conclusionChunks?.length ?? 0;
  useEffect(() => {
    const run = () => {
      document.querySelectorAll("[data-conclusion-textarea]").forEach((ta) => {
        ta.style.height = "auto";
        ta.style.height = `${Math.max(80, ta.scrollHeight)}px`;
      });
    };
    run();
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, [conclusionValues, conclusionChunksLength]);

  /** Save conclusion: hanya department yang berisi data; hitung pagination (page 1 penuh dulu) lalu tutup form. */
  const handleSaveConclusion = () => {
    requestAnimationFrame(() => {
      const conclusionSegments = buildConclusionDeptSegments(
        conclusionDeptSections,
        conclusionValues,
      );
      if (conclusionSegments.length === 0) {
        setConclusionChunks([]);
        setShowConclusionForm(false);
        return;
      }
      const container = conclusionMeasureRef.current;
      if (!container?.isConnected) {
        setShowConclusionForm(false);
        return;
      }
      const blocks = container.querySelectorAll("[data-conclusion-block]");
      if (!blocks.length || blocks.length !== conclusionSegments.length) {
        setConclusionChunks(conclusionSegments.map((s) => [s]));
        setShowConclusionForm(false);
        return;
      }
      const heights = Array.from(blocks).map((el) => el.getBoundingClientRect().height);
      const chunks = paginateConclusionSegments(conclusionSegments, heights, {
        spacing: 18,
        limitFirst: CONCLUSION_PAGE_MAX_HEIGHT_PX - CONCLUSION_FIRST_PAGE_EXTRA_PX,
        limitPage: CONCLUSION_PAGE_MAX_HEIGHT_PX,
      });
      setConclusionChunks(chunks);
      setShowConclusionForm(false);
    });
  };

  /**
   * Batas paginasi Findings: max baris per halaman + zona aman di atas footer.
   * Jika konten akan masuk zona aman (atau menyentuh footer), sisa data otomatis ke next page.
   * @param {Object} opts
   * @param {number} opts.maxRowsPerPage - Max data per halaman (default 15)
   * @param {number} opts.safeZoneRem - Jarak minimum konten dari footer, rem (default 15)
   */
  function getFindingPageLimits(opts = {}) {
    const maxRowsPerPage = opts.maxRowsPerPage ?? 15;
    const safeZoneRem = opts.safeZoneRem ?? 15;
    // Halaman A4 297mm; perkiraan: header+judul ~80px, footer ~40px, safe zone = 15rem.
    // Supaya tabel tidak terpotong: SOP saja max 15; Audit saja max 15; bila SOP+Audit satu halaman, SOP max 6.
    return {
      sopRowsPerPage: Math.min(maxRowsPerPage, 15),
      auditRowsPerPage: Math.min(maxRowsPerPage, 15),
      maxSopRowsWithAudit: 6, // bila SOP > 6 baris, Audit pindah next page agar tidak terpotong
      safeZoneRem,
    };
  }

  const {
    sopRowsPerPage: SOP_ROWS_PER_PAGE,
    auditRowsPerPage: AUDIT_ROWS_PER_PAGE,
    maxSopRowsWithAudit: MAX_SOP_ROWS_WITH_AUDIT,
    safeZoneRem: FINDING_SAFE_ZONE_REM,
  } = getFindingPageLimits({ maxRowsPerPage: 15, safeZoneRem: 4.5 });

  // Kapasitas halaman (unit): batas total "tinggi" per halaman. Baris panjang = unit besar.
  const SOP_PAGE_CAPACITY_UNITS = 18;
  const AUDIT_PAGE_CAPACITY_UNITS = 18;

  /** Weight untuk baris sangat panjang (teks > 300 char). */
  const WEIGHT_VERY_LONG = 4;

  /** Jika halaman sudah berisi baris sangat panjang, max baris di halaman itu (supaya tidak terpotong). */
  const MAX_ROWS_WHEN_PAGE_HAS_VERY_LONG = 6;

  /**
   * Perkiraan tinggi baris SOP berdasarkan panjang teks. Teks sangat panjang dapat muat di satu halaman
   * asal jumlah baris di halaman itu dibatasi (lihat chunkRowsByContent).
   */
  function getSopRowWeight(row) {
    const sopLines = estimateWrappedLines(row.sopRelated, 60);
    const reviewLines = estimateWrappedLines(row.reviewComment, 24);
    const auditeeLines = estimateWrappedLines(row.auditeeComment, 22);
    const followUpLines = estimateWrappedLines(row.followUpDetail, 22);
    const maxLines = Math.max(sopLines, reviewLines, auditeeLines, followUpLines);
    const totalLines = sopLines + reviewLines + auditeeLines + followUpLines;

    if (maxLines >= 26 || totalLines >= 44) return 14;
    if (maxLines >= 20 || totalLines >= 34) return 12;
    if (maxLines >= 14 || totalLines >= 25) return 10;
    if (maxLines >= 10 || totalLines >= 18) return 8;
    if (maxLines >= 7 || totalLines >= 12) return 6;
    if (maxLines >= 4 || totalLines >= 7) return WEIGHT_VERY_LONG;
    if (maxLines >= 2 || totalLines >= 4) return 2;
    return 1;
  }

  function getAuditRowWeight(row) {
    const riskLines = estimateWrappedLines(row.riskDetails, 18);
    const codeLines = estimateWrappedLines(row.apCode, 14);
    const substantiveLines = estimateWrappedLines(row.substantiveTest, 12);
    const methodologyLines = estimateWrappedLines(row.methodology, 13);
    const resultLines = estimateWrappedLines(row.findingResult, 12);
    const descriptionLines = estimateWrappedLines(row.findingDescription, 18);
    const auditeeLines = estimateWrappedLines(row.auditeeComment, 14);
    const followUpLines = estimateWrappedLines(row.followUpDetail, 14);
    const maxLines = Math.max(
      riskLines,
      codeLines,
      substantiveLines,
      methodologyLines,
      resultLines,
      descriptionLines,
      auditeeLines,
      followUpLines,
    );
    const totalLines =
      riskLines +
      codeLines +
      substantiveLines +
      methodologyLines +
      resultLines +
      descriptionLines +
      auditeeLines +
      followUpLines;

    if (maxLines >= 24 || totalLines >= 56) return 14;
    if (maxLines >= 18 || totalLines >= 42) return 12;
    if (maxLines >= 13 || totalLines >= 30) return 10;
    if (maxLines >= 9 || totalLines >= 22) return 8;
    if (maxLines >= 6 || totalLines >= 15) return 6;
    if (maxLines >= 4 || totalLines >= 10) return WEIGHT_VERY_LONG;
    if (maxLines >= 2 || totalLines >= 5) return 2;
    return 1;
  }

  /**
   * Chunk baris per halaman: fit dan tidak terpotong.
   * - Total unit tidak boleh melebihi pageCapacityUnits.
   * - Max maxRowsPerPage baris; JIKA halaman sudah berisi baris sangat panjang (weight 4),
   *   max baris di halaman itu = MAX_ROWS_WHEN_PAGE_HAS_VERY_LONG agar baris panjang tidak terpotong
   *   dan tidak memakan banyak halaman kosong.
   */
  function chunkRowsByContent(rows, getWeight, maxRowsPerPage, pageCapacityUnits) {
    const chunks = [];
    let chunk = [];
    let totalUnits = 0;
    let hasVeryLongInChunk = false;
    for (const row of rows) {
      const w = getWeight(row);
      const isVeryLong = w >= WEIGHT_VERY_LONG;
      const wouldExceed = totalUnits + w > pageCapacityUnits;
      const atMaxRows = chunk.length >= maxRowsPerPage;
      const atMaxRowsWhenHasVeryLong = hasVeryLongInChunk && chunk.length >= MAX_ROWS_WHEN_PAGE_HAS_VERY_LONG;

      if ((wouldExceed || atMaxRows || atMaxRowsWhenHasVeryLong) && chunk.length > 0) {
        chunks.push(chunk);
        chunk = [];
        totalUnits = 0;
        hasVeryLongInChunk = false;
      }
      chunk.push(row);
      totalUnits += w;
      if (isVeryLong) hasVeryLongInChunk = true;
    }
    if (chunk.length > 0) chunks.push(chunk);
    return chunks;
  }

  function getChunkUnits(rows, getWeight) {
    return (rows || []).reduce((sum, row) => sum + getWeight(row), 0);
  }

  // Map untuk nomor sub‑section 5.x per department (5.1 Finance, 5.2 Accounting, dst.)
  const deptIndexMap = {};
  paginatedFindingSections.forEach((sec, i) => {
    deptIndexMap[sec.deptKey] = i + 1;
  });

  /**
   * Bagi data Findings & Recommendations per department menjadi beberapa halaman A4.
   * Max 15 baris per halaman; jika teks panjang sehingga konten akan menyentuh footer,
   * baris yang kelebihan (termasuk baris ke-15) dilanjutkan ke next page agar tidak terpotong.
   */
  const findingPages = (() => {
    const pages = [];
    paginatedFindingSections.forEach((section) => {
      const showAudit = isDeptPublishedToReport(section.deptKey, effectivePublishByDept);
      const auditRowsForSection = showAudit
        ? section.auditRows?.length
          ? section.auditRows
          : auditRowsForDept(section.deptKey, true)
        : [];
      const storedSopChunks = measuredChunks?.sop?.[section.deptKey];
      const measuredSopRowCount = (storedSopChunks || []).reduce(
        (sum, chunk) => sum + (chunk.rows?.length || 0),
        0,
      );
      const useMeasuredSop =
        storedSopChunks?.length > 0 &&
        measuredSopRowCount > 0 &&
        measuredSopRowCount === (section.sopRows?.length || 0);
      const sopChunkMetas = useMeasuredSop
        ? storedSopChunks.map((chunk) => ({
            rows: [...(chunk.rows || [])],
            height: chunk.height ?? 0,
            limit: chunk.limit ?? FINDING_SOP_TABLE_HEIGHT_PX,
          }))
        : chunkRowsByContent(
            section.sopRows,
            getSopRowWeight,
            SOP_ROWS_PER_PAGE,
            SOP_PAGE_CAPACITY_UNITS
          ).map((chunk) => ({ rows: chunk, height: null, limit: null }));
      const storedAuditChunks = measuredChunks?.audit?.[section.deptKey];
      const measuredAuditRowCount = (storedAuditChunks || []).reduce(
        (sum, chunk) => sum + (chunk.rows?.length || 0),
        0,
      );
      const useMeasuredAudit =
        storedAuditChunks?.length > 0 &&
        measuredAuditRowCount > 0 &&
        measuredAuditRowCount === auditRowsForSection.length;
      const auditChunkMetas =
        !showAudit || auditRowsForSection.length === 0
          ? []
          : useMeasuredAudit
            ? storedAuditChunks.map((chunk) => ({
                rows: [...(chunk.rows || [])],
                height: chunk.height ?? 0,
                limit: chunk.limit ?? FINDING_AUDIT_TABLE_HEIGHT_PX,
              }))
            : chunkRowsByContent(
                auditRowsForSection,
                getAuditRowWeight,
                AUDIT_ROWS_PER_PAGE,
                AUDIT_PAGE_CAPACITY_UNITS
              ).map((chunk) => ({ rows: chunk, height: null, limit: null }));

      if (sopChunkMetas.length === 0 && auditChunkMetas.length === 0) return;

      // Flag: header 5 / 5.x Department hanya di halaman pertama dept; judul SOP/Audit hanya di chunk pertama
      let isFirstPageForDept = true;
      let hasPushedSopChunk = false;
      let hasPushedAuditChunk = false;

      function markSopAndAuditFlags(sopRows, auditRows) {
        const isFirstSopChunk = sopRows.length > 0 && !hasPushedSopChunk;
        const isFirstAuditChunk = auditRows.length > 0 && !hasPushedAuditChunk;
        if (sopRows.length > 0) hasPushedSopChunk = true;
        if (auditRows.length > 0) hasPushedAuditChunk = true;
        return { isFirstSopChunk, isFirstAuditChunk };
      }

      // 1) Tampilkan semua halaman SOP Review terlebih dahulu.
      //    Pada chunk SOP TERAKHIR, jika masih ada data Audit dan jumlah baris SOP masih
      //    di bawah ambang batas (MAX_SOP_ROWS_WITH_AUDIT), maka chunk Audit pertama
      //    boleh ditempatkan DI BAWAH SOP di halaman yang sama. Kalau tidak, seluruh Audit
      //    pindah ke halaman berikutnya supaya tidak terpotong.
      if (sopChunkMetas.length > 0) {
        sopChunkMetas.forEach((chunkMeta, index) => {
          const chunk = chunkMeta.rows;
          const isLastSopChunk = index === sopChunkMetas.length - 1;
          let auditRows = [];
          if (isLastSopChunk && auditChunkMetas.length > 0 && chunk.length <= MAX_SOP_ROWS_WITH_AUDIT) {
            const candidateAuditMeta = auditChunkMetas[0] || null;
            const candidateAuditRows = candidateAuditMeta?.rows || [];
            const canFitUnderSop =
              candidateAuditRows.length > 0 &&
              (() => {
                if (
                  typeof chunkMeta.height === "number" &&
                  chunkMeta.limit &&
                  typeof candidateAuditMeta?.height === "number"
                ) {
                  const remainingHeight = Math.max(0, chunkMeta.limit - chunkMeta.height);
                  return remainingHeight >= candidateAuditMeta.height + FINDING_AUDIT_SECTION_CHROME_PX;
                }

                const sopChunkUnits = getChunkUnits(chunk, getSopRowWeight);
                const combinedUnits =
                  sopChunkUnits + getChunkUnits(candidateAuditRows, getAuditRowWeight);
                return combinedUnits <= Math.min(SOP_PAGE_CAPACITY_UNITS, AUDIT_PAGE_CAPACITY_UNITS) - 2;
              })();
            if (canFitUnderSop) {
              auditRows = (auditChunkMetas.shift() || {}).rows || [];
            }
          }
          const { isFirstSopChunk, isFirstAuditChunk } = markSopAndAuditFlags(chunk, auditRows);

          pages.push({
            dept: section,
            sopRows: chunk,
            auditRows,
            isFirstPageForDept,
            isFirstSopChunk,
            isFirstAuditChunk,
          });
          isFirstPageForDept = false;
        });
      }

      // 2) Jika tidak ada SOP (hanya Audit), atau masih ada sisa Audit setelah SOP selesai,
      //    tampilkan sebagai halaman-halaman lanjut yang hanya berisi Audit Review.
      if (sopChunkMetas.length === 0 && auditChunkMetas.length > 0) {
        const firstAudit = (auditChunkMetas.shift() || {}).rows || [];
        const { isFirstSopChunk, isFirstAuditChunk } = markSopAndAuditFlags([], firstAudit);
        pages.push({
          dept: section,
          sopRows: [],
          auditRows: firstAudit,
          isFirstPageForDept,
          isFirstSopChunk,
          isFirstAuditChunk,
        });
        isFirstPageForDept = false;
      }

      auditChunkMetas.forEach((chunkMeta) => {
        const chunk = chunkMeta.rows || [];
        const { isFirstSopChunk, isFirstAuditChunk } = markSopAndAuditFlags([], chunk);
        pages.push({
          dept: section,
          sopRows: [],
          auditRows: chunk,
          isFirstPageForDept,
          isFirstSopChunk,
          isFirstAuditChunk,
        });
        isFirstPageForDept = false;
      });
    });
    return pages;
  })();

  const executiveSummaryPages = filterMeaningfulHtmlPages(
    Array.isArray(executiveSummaryChunks) && executiveSummaryChunks.length > 0
      ? executiveSummaryChunks
      : [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)],
  );
  const auditObjectivesScopePages = filterMeaningfulHtmlPages(
    Array.isArray(auditObjectivesScopeChunks) && auditObjectivesScopeChunks.length > 0
      ? auditObjectivesScopeChunks
      : [
          sanitizeHtmlWithFallback(
            auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        ],
  );
  const auditApproachMethodologyPages = filterMeaningfulHtmlPages(
    Array.isArray(auditApproachMethodologyChunks) && auditApproachMethodologyChunks.length > 0
      ? auditApproachMethodologyChunks
      : [
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ],
  );
  const executiveSummaryStartPage = 5;
  const executiveSummaryEndPage = executiveSummaryStartPage + executiveSummaryPages.length - 1;
  const auditObjectivesStartPage = executiveSummaryEndPage + 1;
  const auditObjectivesEndPage = auditObjectivesStartPage + auditObjectivesScopePages.length - 1;
  const auditApproachStartPage = auditObjectivesEndPage + 1;
  const auditApproachEndPage =
    auditApproachStartPage + auditApproachMethodologyPages.length - 1;
  const departmentCompletionPageNumber = auditApproachEndPage + 1;
  const findingsPageStartNumber = departmentCompletionPageNumber + 1;

  // Pemetaan range halaman Findings & Recommendations per department.
  const deptFindingPageRanges = (() => {
    const map = {};
    findingPages.forEach((page, index) => {
      const key = page.dept.deptKey;
      const pageNumber = findingsPageStartNumber + index;
      if (!map[key]) {
        map[key] = { first: pageNumber, last: pageNumber };
      } else {
        map[key].last = pageNumber;
      }
    });
    return map;
  })();

  /**
   * Satu halaman per finding yang dipilih (checkbox multi). 1 select = 1 halaman, 2 select = 2 halaman.
   */
  const findingDetailPages = (() => {
    const list = [];
    findingSections.forEach((section) => {
      if (!isDeptPublishedToReport(section.deptKey, effectivePublishByDept)) return;
      const indices = selectedFindingByDept[section.deptKey];
      if (!Array.isArray(indices) || indices.length === 0) return;
      const auditRows = auditRowsForDept(section.deptKey, true);
      indices.forEach((rowIndex, i) => {
        const finding = auditRows[rowIndex] ?? null;
        if (!finding) return;
        list.push({ section, finding, findingIndex: i + 1, rowIndex });
      });
    });
    return list;
  })();

  /** Conclusion: pakai chunk dari Save (page 1 penuh dulu, sisanya next page); hanya ada setelah user klik Save. */
  const conclusionPages = (() => {
    if (!showConclusionPaper) return [];
    if (conclusionChunks && conclusionChunks.length > 0) return conclusionChunks;
    return [];
  })();

  const appendixPageBase =
    findingsPageStartNumber +
    findingPages.length +
    findingDetailPages.length +
    (showConclusionPaper ? (conclusionPages.length > 0 ? conclusionPages.length : 1) : 0) +
    1;
  const appendixPages = showAppendixPaper ? buildAppendixPages(appendices) : [];

  const totalPages = computeReportTotalPages({
    executiveSummaryEndPage,
    auditObjectivesEndPage,
    auditApproachEndPage,
    findingsPageStartNumber,
    findingPagesLength: findingPages.length,
    findingDetailPagesLength: findingDetailPages.length,
    showConclusionPaper,
    conclusionPagesLength: conclusionPages.length,
    showAppendixPaper,
    appendixPageBase,
    appendixPagesLength: appendixPages.length,
  });

  useEffect(() => {
    const renderedRows = findingPages.reduce(
      (sum, page) => sum + (page.auditRows?.length || 0),
      0,
    );
    console.log(
      "AUDIT_RENDER",
      JSON.stringify(
        {
          sectionsLength: findingSections.length,
          hubModuleSectionsLength: hubModuleSections.length,
          hasSystemFindingModules,
          showConclusionPaper,
          showAppendixPaper,
          appendixPagesLength: appendixPages.length,
          displaySectionsLength: displayFindingSections.length,
          paginatedSectionsLength: paginatedFindingSections.length,
          findingPagesLength: findingPages.length,
          renderedRows,
          depts: findingSections.map((section) => {
            const deptKey = section.deptKey;
            const locked = publishStatusByDept[deptKey] === true;
            const visible = auditVisibleByDept[deptKey] !== false;
            const effective = effectivePublishByDept[deptKey] === true;
            const displaySec = displayFindingSections.find((d) => d.deptKey === deptKey);
            const paginatedSec = paginatedFindingSections.find((p) => p.deptKey === deptKey);
            const pagesForDept = findingPages.filter((p) => p.dept.deptKey === deptKey);
            const pageAuditRows = pagesForDept.reduce(
              (n, p) => n + (p.auditRows?.length || 0),
              0,
            );
            return {
              deptKey,
              locked,
              visible,
              effective,
              stateAuditRowsLength: section.auditRows?.length ?? 0,
              displayAuditRowsLength: displaySec?.auditRows?.length ?? 0,
              paginatedAuditRowsLength: paginatedSec?.auditRows?.length ?? 0,
              pageAuditRows,
            };
          }),
        },
        null,
        2,
      ),
    );
  }, [
    findingSections,
    hubModuleSections,
    hasSystemFindingModules,
    showConclusionPaper,
    showAppendixPaper,
    appendixPages,
    displayFindingSections,
    paginatedFindingSections,
    findingPages,
    effectivePublishByDept,
    publishStatusByDept,
    auditVisibleByDept,
  ]);

  const refreshModulesIntoPreview = useCallback(async () => {
    sopModuleRefreshRef.current = true;
    await forceRefreshHub();
    return savedFindingSectionsRef.current;
  }, [forceRefreshHub]);

  const buildReportExportPayload = useCallback((findingSectionsOverride) => {
    const exportFindingSections = findingSectionsOverride ?? findingSections;
    const periodStartVal = String(periodStart ?? "").trim() || `JANUARY ${year}`;
    const periodEndVal = String(periodEnd ?? "").trim() || `DECEMBER ${year}`;
    const issuedDateVal = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const tocItems = [
      {
        title: "Executive Summary",
        page:
          executiveSummaryPages.length > 1
            ? `${executiveSummaryStartPage} - ${executiveSummaryEndPage}`
            : String(executiveSummaryStartPage),
      },
      {
        title: "Objective & Scope",
        page:
          auditObjectivesScopePages.length > 1
            ? `${auditObjectivesStartPage} - ${auditObjectivesEndPage}`
            : String(auditObjectivesStartPage),
      },
      {
        title: "Audit Approach & Methodology",
        page:
          auditApproachMethodologyPages.length > 1
            ? `${auditApproachStartPage} - ${auditApproachEndPage}`
            : String(auditApproachStartPage),
      },
      ...REPORT_DEPARTMENT_COMPLETION_ROWS.filter((row) =>
        displayFindingSections.some((section) => section.deptKey === row.deptKey),
      )
        .sort((a, b) => {
          const ra = deptFindingPageRanges[a.deptKey];
          const rb = deptFindingPageRanges[b.deptKey];
          return (ra?.first ?? Infinity) - (rb?.first ?? Infinity);
        })
        .map((row) => {
          const range = deptFindingPageRanges[row.deptKey];
          const page =
            range?.first && range?.last
              ? range.first === range.last
                ? String(range.first)
                : `${range.first} - ${range.last}`
              : "—";
          return { title: formatDeptTocTitle(row), page };
        }),
    ];

    const exportConclusionPages =
      conclusionPages.length > 0
        ? conclusionPages
            .map((page) =>
              (Array.isArray(page) ? page : []).filter((seg) => String(seg?.text ?? "").trim()),
            )
            .filter((page) => page.length > 0)
        : (() => {
            const segments = buildConclusionDeptSegments(
              conclusionDeptSections,
              conclusionValues,
            ).map((seg, i) => ({
              ...seg,
              sectionNumber: deptIndexMap[seg.deptKey] ?? i + 1,
            }));
            return segments.length > 0 ? [segments] : [];
          })();

    const totalPages = computeReportTotalPages({
      executiveSummaryEndPage,
      auditObjectivesEndPage,
      auditApproachEndPage,
      findingsPageStartNumber,
      findingPagesLength: findingPages.length,
      findingDetailPagesLength: findingDetailPages.length,
      showConclusionPaper,
      conclusionPagesLength: exportConclusionPages.length,
      showAppendixPaper,
      appendixPageBase,
      appendixPagesLength: appendixPages.length,
    });

    const appendixStartPage =
      findingsPageStartNumber +
      findingPages.length +
      findingDetailPages.length +
      (showConclusionPaper ? (conclusionPages.length > 0 ? conclusionPages.length : 1) : 0) +
      1;

    const departmentCompletionRows = REPORT_DEPARTMENT_COMPLETION_ROWS.filter((row) =>
      displayFindingSections.some((section) => section.deptKey === row.deptKey),
    )
      .sort((a, b) => {
        const ra = deptFindingPageRanges[a.deptKey];
        const rb = deptFindingPageRanges[b.deptKey];
        return (ra?.first ?? Infinity) - (rb?.first ?? Infinity);
      })
      .map((row) => {
        const month = row.monthIndex ?? 1;
        const lastDayDate = new Date(year, month, 0);
        const completionDate = lastDayDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const range = deptFindingPageRanges[row.deptKey];
        const pageRange =
          range?.first && range?.last
            ? range.first === range.last
              ? String(range.first)
              : `${range.first} - ${range.last}`
            : "—";
        return { name: row.name, completionDate, pageRange };
      });

    const conclusionTexts = [];
    if (conclusionChunks?.length > 0) {
      conclusionChunks.forEach((pageSections) => {
        pageSections.forEach((seg) => {
          if (seg?.text) conclusionTexts.push(String(seg.text));
        });
      });
    } else {
      exportFindingSections.forEach((section, idx) => {
        const text = (conclusionValues[section.deptKey] || "").trim();
        if (text) {
          conclusionTexts.push(`6.${idx + 1} ${section.deptLabel}: ${text}`);
        }
      });
    }

    return {
      year,
      periodStart: periodStartVal,
      periodEnd: periodEndVal,
      issuedDate: issuedDateVal,
      auditCoverage,
      departmentCoverage,
      area,
      executiveSummaryHtml,
      auditObjectivesScopeHtml,
      auditApproachMethodologyHtml,
      executiveSummaryPages: filterMeaningfulHtmlPages(executiveSummaryPages),
      auditObjectivesScopePages: filterMeaningfulHtmlPages(auditObjectivesScopePages),
      auditApproachMethodologyPages: filterMeaningfulHtmlPages(auditApproachMethodologyPages),
      auditTeam: resolveAuditTeamRows(auditTeam),
      preparedBy: preparedBy.length > 0 ? preparedBy : [],
      auditCommitteeName,
      auditCommitteeDate: formattedAuditCommitteeDate,
      presidentDirectorName,
      presidentDirectorDate: formattedPresidentDirectorDate,
      tableOfContents: tocItems,
      departmentCompletionRows,
      deptIndexMap,
      conclusionValues,
      conclusionChunks: conclusionTexts,
      conclusionPages: exportConclusionPages,
      source: "html-preview",
      coverSnapshotHash: computeCoverSnapshotHash({
        auditTeam: resolveAuditTeamRows(auditTeam),
        preparedBy,
        auditCommitteeName,
        auditCommitteeDate: formattedAuditCommitteeDate,
        presidentDirectorName,
        presidentDirectorDate: formattedPresidentDirectorDate,
        appendices,
      }),
      previewSnapshotHash: computePreviewSnapshotHash(
        auditVisibleByDept,
        exportFindingSections,
        {
          executiveSummaryHtml,
          auditObjectivesScopeHtml,
          auditApproachMethodologyHtml,
          conclusionValues,
          auditTeam: resolveAuditTeamRows(auditTeam),
          preparedBy,
          auditCommitteeName,
          auditCommitteeDate: formattedAuditCommitteeDate,
          presidentDirectorName,
          presidentDirectorDate: formattedPresidentDirectorDate,
          appendices,
        },
      ),
      moduleTablesHash: computeModuleTablesHash(exportFindingSections),
      auditVisibleByDept,
      effectivePublishByDept,
      findingSections: filterFindingSectionsForDisplay(
        exportFindingSections,
        effectivePublishByDept,
      ).map((section) => ({
        deptKey: section.deptKey,
        deptLabel: section.deptLabel,
        areaAudit: section.areaAudit,
        isPublishedToReport: section.isPublishedToReport === true,
        executiveSummary: section.executiveSummary,
        sopRows: section.sopRows || [],
        auditRows: section.auditRows || [],
        conclusionText: (conclusionValues[section.deptKey] || "").trim(),
      })),
      appendices,
      appendixPages: appendixPages.map((page) => ({
        showAppendicesHeading: page.showAppendicesHeading,
        segments: page.segments,
      })),
      findingPages: filterFindingPagesForPreview(
        findingPages.map((page) => ({
          deptKey: page.dept.deptKey,
          deptLabel: page.dept.deptLabel,
          deptNum: deptIndexMap[page.dept.deptKey] || 1,
          executiveSummary:
            page.isFirstPageForDept &&
            isDeptPublishedToReport(page.dept.deptKey, effectivePublishByDept)
              ? page.dept.executiveSummary
              : null,
          sopRows: page.sopRows || [],
          auditRows: page.auditRows || [],
          isFirstPageForDept: page.isFirstPageForDept,
          isFirstSopChunk: page.isFirstSopChunk,
          isFirstAuditChunk: page.isFirstAuditChunk,
        })),
        effectivePublishByDept,
      ).map((page, idx) => ({
        ...page,
        pageNumber: findingsPageStartNumber + idx,
      })),
      selectedFindingByDept,
      findingDetailPages: findingDetailPages.map((item, idx) => ({
        ...item,
        pageNumber: findingsPageStartNumber + findingPages.length + idx,
      })),
      deptFindingNarratives: [],
      pageLayout: {
        totalPages,
        executiveSummaryStartPage,
        auditObjectivesStartPage,
        auditObjectivesEndPage,
        auditApproachStartPage,
        auditApproachEndPage,
        findingsPageStartNumber,
        conclusionStartPage:
          findingsPageStartNumber + findingPages.length + findingDetailPages.length,
        appendixStartPage,
      },
    };
  }, [
    year,
    periodStart,
    periodEnd,
    auditCoverage,
    departmentCoverage,
    area,
    executiveSummaryHtml,
    auditObjectivesScopeHtml,
    auditApproachMethodologyHtml,
    auditTeam,
    preparedBy,
    auditCommitteeName,
    formattedAuditCommitteeDate,
    presidentDirectorName,
    formattedPresidentDirectorDate,
    findingSections,
    auditVisibleByDept,
    effectivePublishByDept,
    displayFindingSections,
    deptIndexMap,
    deptFindingPageRanges,
    findingDetailPages,
    conclusionChunks,
    conclusionValues,
    appendices,
    executiveSummaryPages.length,
    executiveSummaryStartPage,
    executiveSummaryEndPage,
    auditObjectivesScopePages.length,
    auditObjectivesStartPage,
    auditObjectivesEndPage,
    auditApproachMethodologyPages.length,
    auditApproachStartPage,
    auditApproachEndPage,
    findingPages,
    findingDetailPages,
    selectedFindingByDept,
    conclusionPages,
    conclusionDeptSections,
    appendixPages,
    findingsPageStartNumber,
  ]);

  buildReportExportPayloadRef.current = buildReportExportPayload;

  const handleCreateWordAndOpenOnlyOffice = async () => {
    if (displayFindingSections.length === 0) {
      window.alert(
        "No report data yet. Publish SOP / Audit Review data first.",
      );
      return;
    }
    setOpeningEditor(true);
    try {
      skipPersistUntilRef.current = 0;
      skipPersistOnceRef.current = false;
      flushPendingFieldUpdates();
      await persistReportStateNow({
        narrativeFromPreviewEdit: true,
        bypassSkipPersist: true,
      });
      const payload = buildReportExportPayload();
      const initiatorClientId = getPreviewTabClientId();
      const result = await syncReportDocxFromPreview(year, payload);
      if (!result.ok) {
        window.alert(result.error || "Failed to create Word document.");
        return;
      }
      if (result.editorPath) {
        pushOnlyOfficeRedirectToPeers(year, {
          clientId: initiatorClientId,
          editorPath: result.editorPath,
          sessionId: result.sessionId,
        });
        await notifyOnlyOfficeSessionOpened(year, {
          sessionId: result.sessionId,
          editorPath: result.editorPath,
          initiatorClientId,
        });
        await joinOnlyOfficeEditor(result.editorPath, { syncBeforeOpen: false });
        return;
      }
      window.alert("Word document created but editor URL is missing.");
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Failed to create Word document.");
    } finally {
      setOpeningEditor(false);
    }
  };

  // Tanggal issued mengikuti tanggal hari ini (format: Month DD, YYYY)
  const issuedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!clientReady) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 print:bg-white"
      >
        <p className="text-sm text-slate-500">Loading report preview…</p>
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-gray-100 flex flex-col items-center justify-start p-4 print:bg-white print:p-0 gap-6"
    >
      <div className="flex flex-col items-center justify-start gap-6 w-full">
      <style jsx global>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        .executive-summary-content p,
        .executive-summary-content div {
          margin: 0 0 0.65rem 0;
          overflow-wrap: anywhere;
          word-break: break-word;
          text-align: justify;
        }
        .executive-summary-content ul,
        .executive-summary-content ol {
          margin: 0.35rem 0 0.65rem 1.5rem;
          padding-left: 1rem;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .executive-summary-content ul {
          list-style-type: disc;
        }
        .executive-summary-content ol {
          list-style-type: decimal;
        }
        .executive-summary-content li {
          margin: 0.2rem 0;
          overflow-wrap: anywhere;
          word-break: break-word;
          text-align: justify;
        }
        .executive-summary-content strong,
        .executive-summary-content b {
          font-weight: 700;
        }
        .executive-summary-content em,
        .executive-summary-content i {
          font-style: italic;
        }
        .executive-summary-content u {
          text-decoration: underline;
        }
        .audit-findings-table th,
        .audit-findings-table td {
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .audit-findings-table th {
          font-size: 7px;
          line-height: 1.15;
          padding: 3px 2px;
        }
        .audit-findings-table td {
          vertical-align: top;
        }
        .sop-review-table th,
        .sop-review-table td {
          word-break: break-word;
          overflow-wrap: anywhere;
          vertical-align: top;
        }
        .sop-review-table th {
          font-size: 8px;
          line-height: 1.15;
          padding: 3px 2px;
        }
      `}</style>
      <div
        suppressHydrationWarning
        className="fixed top-3 left-3 right-3 z-[91] print:hidden flex items-start justify-between gap-2 pointer-events-none"
      >
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
              return;
            }
            const params = new URLSearchParams();
            if (Number.isFinite(year)) params.set("year", String(year));
            router.replace(`/Page/report?${params.toString()}`);
          }}
          className="pointer-events-auto shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold shadow-md hover:bg-slate-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-start gap-2">
          <button
            type="button"
            suppressHydrationWarning
            onClick={handleCreateWordAndOpenOnlyOffice}
            disabled={openingEditor}
            className="pointer-events-auto shrink-0 inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {openingEditor ? "Creating Word…" : "Create Word & Open OnlyOffice"}
          </button>
          <PreviewCollaborationBar
            participants={collabParticipants}
            wsConnected={collabWsConnected}
          />
        </div>
      </div>
      {aiStatus && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[92] max-w-lg px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs shadow-md print:hidden">
          {aiStatus}
        </div>
      )}
      {/* Cover — one A4: background fill + bordered text boxes (Arial only on page 1) */}
      <div
        className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] overflow-hidden break-after-page relative box-border isolate [print-size:A4] font-[Arial]"
        style={{ fontFamily: COVER_FONT }}
      >
        <img
          src="/images/report-cover/cover.png"
          alt=""
          className="absolute inset-0 h-[297mm] w-full object-cover object-center pointer-events-none select-none"
          draggable={false}
        />
        <div className="absolute z-10 left-[8%] top-[18%] max-w-[52%] pointer-events-none border border-gray-300 rounded-sm px-3 py-2 bg-white/0">
          <div className="font-bold tracking-tight leading-[0.98]" style={{ color: COVER_NAVY }}>
            <div className="text-[3.35rem]">INTERNAL</div>
            <div className="text-[3.35rem]">AUDIT</div>
            <div className="text-[4.15rem] leading-none" style={{ color: COVER_GOLD }}>
              REPORT
            </div>
          </div>
          <div className="mt-2 mb-2 h-[2px] w-[5rem]" style={{ backgroundColor: COVER_GOLD }} />
          <div
            className="text-[0.8rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: COVER_NAVY }}
          >
            {COVER_SUBTITLE}
          </div>
        </div>
        <div className="absolute z-10 left-[8%] top-[45%] flex gap-3 pointer-events-none border border-gray-300 rounded-sm px-3 py-2">
          <span
            className="w-[3px] shrink-0 self-stretch min-h-[5rem]"
            style={{ backgroundColor: COVER_GOLD }}
            aria-hidden="true"
          />
          <div className="text-[1.2rem] leading-snug font-medium" style={{ color: COVER_NAVY }}>
            {COVER_TAGLINE.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
        <div
          className="absolute z-10 right-[8%] bottom-[8%] pointer-events-none"
          aria-label={`Audit year ${year}`}
        >
          <div
            className="font-bold tracking-tight leading-none tabular-nums text-right"
            style={{ color: COVER_YEAR_WHITE, fontSize: `${COVER_YEAR_SIZE / 2}pt` }}
          >
            {year}
          </div>
        </div>
      </div>

      {/* Prepared by modal (hanya layar) */}
      {isPreparedByModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-5">
            <h2 className="text-sm font-semibold mb-3">Add Prepared By Member</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold">Name</label>
                <input
                  type="text"
                  value={newPreparedName}
                  onChange={(e) => setNewPreparedName(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Role</label>
                <select
                  value={newPreparedRole}
                  onChange={(e) => setNewPreparedRole(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="ENGAGEMENT LEAD">ENGAGEMENT LEAD</option>
                  <option value="TEAM LEAD">TEAM LEAD</option>
                  <option value="MEMBER">MEMBER</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold">Date</label>
                <input
                  type="date"
                  value={newPreparedDate}
                  onChange={(e) => setNewPreparedDate(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsPreparedByModalOpen(false)}
                className="px-3 py-1 rounded border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = newPreparedName.trim();
                  const role = newPreparedRole.trim();
                  const date = newPreparedDate.trim();
                  if (!name || !role) return;
                  const nextPrepared = [...preparedBy, { name, role, date }];
                  setPreparedBy(nextPrepared);
                  broadcastPreviewStateNow({ preparedBy: nextPrepared }, { force: true });
                  setIsPreparedByModalOpen(false);
                  setNewPreparedName("");
                  setNewPreparedRole("MEMBER");
                  setNewPreparedDate("");
                }}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info page - full A4 */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col p-12 break-after-page">
        {/* Header logo dan nama perusahaan */}
        <div className="flex items-center justify-center gap-4 mb-20">
          <img
            src="/images/logo_KPU.png"
            alt="KPU Logo"
            className="w-20 h-20"
          />
          <div className="text-xl sm:text-2xl font-semibold text-gray-800 tracking-wide">
            PT Karya Prima Unggulan
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="text-2xl font-extrabold tracking-[0.25em] text-gray-900">
            INTERNAL AUDIT REPORT
          </div>
        </div>

        {/* Detail table - label lebar tetap agar tanda : sejajar vertikal */}
        <div className="max-w-[650px] mx-auto text-[11px] text-gray-900 space-y-3">
          {/* PERIOD */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              PERIOD <span>:</span>
            </div>
            <div className="flex-1 min-w-[200px] flex flex-row items-start gap-2 flex-wrap font-semibold tracking-wide text-gray-900">
              <textarea
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                rows={1}
                className="flex-1 min-w-[120px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
              />
              <span className="pt-1 shrink-0">-</span>
              <textarea
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                rows={1}
                className="flex-1 min-w-[120px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
              />
            </div>
          </div>

          {/* AUDIT COVERAGE */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              AUDIT COVERAGE <span>:</span>
            </div>
            <textarea
              value={auditCoverage}
              onChange={(e) => setAuditCoverage(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={1}
              className="flex-1 min-w-[200px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
            />
          </div>

          {/* DEPARTMENT COVERAGE */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              DEPARTMENT COVERAGE <span>:</span>
            </div>
            <textarea
              value={departmentCoverage}
              onChange={(e) => setDepartmentCoverage(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={1}
              className="flex-1 min-w-[200px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
            />
          </div>

          {/* AREA */}
          <div className="flex flex-row items-start gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 pt-1 whitespace-nowrap text-gray-700">
              AREA <span>:</span>
            </div>
            <textarea
              value={area}
              onChange={(e) => setArea(e.target.value)}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={1}
              className="flex-1 min-w-[200px] font-semibold leading-snug bg-transparent border-none resize-none focus:outline-none p-0 overflow-hidden"
            />
          </div>
        </div>

        {/* Spacer to push footer to bottom */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="text-[10px] text-gray-700 text-center border-t border-gray-200 pt-4 mt-4">
          <span className="font-semibold">Head Office :</span>{" "}
          Menara Sudirman 20th Floor. Jl. Jend. Sudirman Kav.60, Jakarta 12190
          - Indonesia
        </div>
      </div>

      {/* Audit team, department completion date, and footer (satu halaman) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 pt-24 pb-16 break-after-page">
        {/* Audit Team — borderless table */}
        <div className="mb-20 text-[11px]">
          <div className="text-center font-bold tracking-wide mb-2 text-[10px]">
            AUDIT TEAM <span>:</span>
          </div>
          <div className="flex justify-center mb-3 print:hidden">
            <button
              type="button"
              onClick={() => {
                setNewAuditName("");
                setNewAuditRole("MEMBER");
                setIsAuditTeamModalOpen(true);
              }}
              className="inline-flex items-center px-2 py-[2px] text-[10px] rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              + Add Member
            </button>
          </div>
          <div className="flex justify-center">
            <table className="w-full max-w-md border-collapse table-fixed">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <tbody>
                {auditTeam.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-2 text-center text-gray-400 align-middle print:text-transparent"
                    >
                      —
                    </td>
                  </tr>
                ) : (
                  auditTeam.map((member, idx) => (
                    <tr key={`audit-team-${idx}-${member.name}-${member.role}`}>
                      <td className="py-2 pr-6 text-center font-semibold align-middle">
                        <span className="inline-flex items-center justify-center gap-1">
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextTeam = auditTeam.filter((_, i) => i !== idx);
                              setAuditTeam(nextTeam);
                              broadcastPreviewStateNow({ auditTeam: nextTeam }, { force: true });
                            }}
                            className="print:hidden text-[7px] text-red-600 hover:text-red-800 shrink-0"
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                      <td className="py-2 text-center font-semibold align-middle uppercase tracking-wide">
                        {member.role}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Popup add audit team member (hanya layar) */}
          {isAuditTeamModalOpen && (
            <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-5">
                <h2 className="text-sm font-semibold mb-4">Add Audit Team Member</h2>
                <div className="space-y-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold">Name</label>
                    <input
                      type="text"
                      value={newAuditName}
                      onChange={(e) => setNewAuditName(e.target.value)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Input name"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold">Role</label>
                    <select
                      value={newAuditRole}
                      onChange={(e) => setNewAuditRole(e.target.value)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ENGAGEMENT LEAD">ENGAGEMENT LEAD</option>
                      <option value="TEAM LEAD">TEAM LEAD</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAuditTeamModalOpen(false)}
                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmedName = newAuditName.trim();
                      if (!trimmedName) return;
                      const nextTeam = [
                        ...auditTeam,
                        { name: trimmedName, role: newAuditRole },
                      ];
                      setAuditTeam(nextTeam);
                      broadcastPreviewStateNow({ auditTeam: nextTeam }, { force: true });
                      setIsAuditTeamModalOpen(false);
                      setNewAuditName("");
                      setNewAuditRole("MEMBER");
                    }}
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Department completion date */}
        <div className="text-[10px]">
          <div className="text-center font-bold tracking-wide mb-2 text-[12px]">
            DEPARTMENT COMPLETION DATE <span>:</span>
          </div>
          <div className="flex justify-center">
            <table className="border-collapse w-full max-w-[640px] text-[10px] font-bold table-fixed">
              <colgroup>
                <col className="w-[33%]" />
                <col className="w-[51%]" />
                <col className="w-[16%]" />
              </colgroup>
              <tbody>
                <tr>
                  <td className="py-1 pr-6 align-bottom whitespace-nowrap">DEPARTMENT :</td>
                  <td className="py-1" />
                  <td className="py-1 text-right align-bottom whitespace-nowrap">PAGE</td>
                </tr>
                {REPORT_DEPARTMENT_COMPLETION_ROWS.filter((row) =>
                  displayFindingSections.some((section) => section.deptKey === row.deptKey),
                )
                  .sort((a, b) => {
                    const ra = deptFindingPageRanges[a.deptKey];
                    const rb = deptFindingPageRanges[b.deptKey];
                    const pa = ra?.first ?? Number.POSITIVE_INFINITY;
                    const pb = rb?.first ?? Number.POSITIVE_INFINITY;
                    return pa - pb;
                  })
                  .map((row) => {
                    const month = row.monthIndex ?? 1;
                    const lastDayDate = new Date(year, month, 0);
                    const completionDate = lastDayDate.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    });
                    const range = deptFindingPageRanges[row.deptKey];
                    const pageRange =
                      range && range.first && range.last
                        ? `${range.first} - ${range.last}`
                        : "—";

                    return (
                      <tr key={row.deptKey}>
                        <td className="py-1 pr-6 align-top whitespace-nowrap">{row.name}</td>
                        <td className="py-1 pr-6 align-top font-semibold whitespace-nowrap">
                          {completionDate}
                        </td>
                        <td className="py-1 text-right align-top whitespace-nowrap">{pageRange}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Spacer to dorong footer ke bawah */}
        <div className="flex-1" />

        {/* Date of issued */}
        <div className="mb-10">
          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold tracking-wide">
            <span>DATE OF ISSUED</span>
            <span>:</span>
            <span className="font-semibold">{issuedDate}</span>
          </div>
        </div>

        {/* Center logo (lebih kecil) */}
        <div className="flex items-center justify-center mb-6">
          <img
            src="/images/kias_black_logo.png"
            alt="KIAS Logo"
            className="w-24 h-auto object-contain"
          />
        </div>

        {/* Footer with support text, title, and page info */}
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">2</span> of <span className="ml-1">{totalPages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prepared by & management approval page (next page, tanpa logo tengah dan DATE OF ISSUED) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 py-16 break-after-page">
        {/* Konten utama, header di bagian atas */}
        <div className="flex-1 flex flex-col">
          {/* Header logo dan nama perusahaan */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <img
              src="/images/logo_KPU.png"
              alt="KPU Logo"
              className="w-16 h-16"
            />
            <div className="text-lg sm:text-2xl font-semibold text-gray-700 tracking-wide">
              PT Karya Prima Unggulan
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-36">
            <div className="text-2xl font-bold tracking-wide">
              INTERNAL AUDIT REPORT
            </div>
            <div className="text-lg font-bold tracking-wide mt-2">
              AUDIT PERIOD {year}
            </div>
          </div>

          {/* Prepared by — one table: Name | MEMBER | underline | DATE | date */}
          <div className="mb-16 text-[9px]">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold tracking-wide text-[9px]">PREPARED BY :</div>
              <button
                type="button"
                onClick={() => {
                  setNewPreparedName("");
                  setNewPreparedRole("MEMBER");
                  setNewPreparedDate("");
                  setIsPreparedByModalOpen(true);
                }}
                className="print:hidden inline-flex items-center px-3 py-1 text-[10px] rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                + Add Member
              </button>
            </div>

            <table className="w-full max-w-[640px] border-collapse table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[36%]" />
              </colgroup>
              <tbody>
                {preparedByDisplayRows.length === 0 ? (
                  <tr className="align-bottom">
                    <td colSpan={5} className="py-1.5 text-center text-gray-400 print:text-transparent">
                      —
                    </td>
                  </tr>
                ) : (
                  preparedByDisplayRows.map((row, idx) => (
                    <tr key={`prepared-by-${idx}-${row.name}-${row.role}`} className="align-bottom">
                      <td className="py-1.5 pr-3 font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <span>{row.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextPrepared = preparedBy.filter((_, i) => i !== idx);
                              setPreparedBy(nextPrepared);
                              broadcastPreviewStateNow({ preparedBy: nextPrepared }, { force: true });
                            }}
                            className="print:hidden text-[7px] text-red-600 hover:text-red-800 shrink-0"
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 font-semibold uppercase tracking-wide whitespace-nowrap">
                        {row.role}
                      </td>
                      <td className="py-1.5 pr-3 align-bottom">
                        <span
                          className="inline-block w-20 border-0 border-b border-black border-solid min-h-[0.5em] leading-none"
                          aria-hidden="true"
                        />
                      </td>
                      <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">DATE</td>
                      <td className="py-1.5 font-semibold whitespace-nowrap">
                        {row.date || "\u00a0"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Management approval: jabatan + tanggal satu baris (sejajar), lalu ruang tanda tangan → garis → nama */}
          <div className="text-[10px] mb-24">
            <div className="font-bold tracking-wide mb-6 text-center">MANAGEMENT APPROVAL,</div>
            <div className="flex items-start justify-center gap-16 sm:gap-24 text-center">
              <div className="flex flex-col items-center max-w-[240px]">
                <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 w-full">
                  <div className="font-semibold whitespace-nowrap">AUDIT COMMITTEE,</div>
                  <div className="text-[10px]">
                    <input
                      type="date"
                      value={auditCommitteeDate}
                      onChange={(e) => setAuditCommitteeDate(e.target.value)}
                      className="print:hidden bg-transparent border border-gray-300 rounded px-1 py-[1px] text-[10px] align-middle leading-none"
                    />
                    <span className="hidden print:inline text-[10px] align-middle leading-none whitespace-nowrap">
                      {formattedAuditCommitteeDate || "\u00a0"}
                    </span>
                  </div>
                </div>
                <div className="w-full min-h-[64px] mt-3" aria-hidden="true" />
                <div className="border-t border-gray-400 w-28 mx-auto" />
                <div className="mt-2 text-[10px] font-semibold text-center w-full px-1">
                  <input
                    type="text"
                    value={auditCommitteeName}
                    onChange={(e) => setAuditCommitteeName(e.target.value)}
                    className="bg-transparent border-none p-0 m-0 w-full text-center focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center max-w-[240px]">
                <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 w-full">
                  <div className="font-semibold whitespace-nowrap">PRESIDENT DIRECTOR,</div>
                  <div className="text-[10px]">
                    <input
                      type="date"
                      value={presidentDirectorDate}
                      onChange={(e) => setPresidentDirectorDate(e.target.value)}
                      className="print:hidden bg-transparent border border-gray-300 rounded px-1 py-[1px] text-[10px] align-middle leading-none"
                    />
                    <span className="hidden print:inline text-[10px] align-middle leading-none whitespace-nowrap">
                      {formattedPresidentDirectorDate || "\u00a0"}
                    </span>
                  </div>
                </div>
                <div className="w-full min-h-[64px] mt-3" aria-hidden="true" />
                <div className="border-t border-gray-400 w-28 mx-auto" />
                <div className="mt-2 text-[10px] font-semibold text-center w-full px-1">
                  <input
                    type="text"
                    value={presidentDirectorName}
                    onChange={(e) => setPresidentDirectorName(e.target.value)}
                    className="bg-transparent border-none p-0 m-0 w-full text-center focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (tanpa logo dan tanpa DATE OF ISSUED di halaman ini) */}
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">3</span> of <span className="ml-1">{totalPages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table of Contents page */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-20 pt-20 pb-16 break-after-page">
        {/* Title */}
        <div className="text-center mb-16">
          <div className="text-2xl font-bold tracking-wide">Table of Contents</div>
        </div>

        {/* Header row for page column */}
        <div className="flex justify-end text-xs font-semibold mb-2">
          <span>Page</span>
        </div>

        {/* Contents list */}
        <div className="text-xs space-y-3">
          {[
            {
              title: "Executive Summary",
              page:
                executiveSummaryPages.length > 1
                  ? `${executiveSummaryStartPage} - ${executiveSummaryEndPage}`
                  : String(executiveSummaryStartPage),
            },
            {
              title: "Objective & Scope",
              page:
                auditObjectivesScopePages.length > 1
                  ? `${auditObjectivesStartPage} - ${auditObjectivesEndPage}`
                  : String(auditObjectivesStartPage),
            },
            {
              title: "Audit Approach & Methodology",
              page:
                auditApproachMethodologyPages.length > 1
                  ? `${auditApproachStartPage} - ${auditApproachEndPage}`
                  : String(auditApproachStartPage),
            },
            // Dinamis: table of contents untuk Findings & Recommendations per department
            ...REPORT_DEPARTMENT_COMPLETION_ROWS
              .filter((row) =>
                displayFindingSections.some((section) => section.deptKey === row.deptKey),
              )
              .sort((a, b) => {
                const ra = deptFindingPageRanges[a.deptKey];
                const rb = deptFindingPageRanges[b.deptKey];
                const pa = ra?.first ?? Number.POSITIVE_INFINITY;
                const pb = rb?.first ?? Number.POSITIVE_INFINITY;
                return pa - pb;
              })
              .map((row) => {
                const range = deptFindingPageRanges[row.deptKey];
                const page =
                  range && range.first && range.last
                    ? range.first === range.last
                      ? String(range.first)
                      : `${range.first} - ${range.last}`
                    : "—";
                const title = `Department ${
                  row.name === "SECURITY"
                    ? "Security (L&P)"
                    : row.name === "GENERAL & AFFAIR"
                    ? "General Affairs"
                    : row.name === "MANAGEMENT INFORMATION SYS."
                    ? "Management Information System (MIS)"
                    : row.name === "HRD"
                    ? "Human Resources Department"
                    : row.name.charAt(0) + row.name.slice(1).toLowerCase()
                } - Finding & Recommendation`;
                return { title, page };
              }),
          ].map((item) => (
            <div key={item.title} className="flex items-baseline gap-2 py-1">
              <div className="flex-1 flex items-center">
                <span className="font-semibold">{item.title}</span>
                <div className="flex-1 border-b border-dotted border-gray-400 mx-2" />
              </div>
              <div className="w-10 text-right font-semibold">{item.page}</div>
            </div>
          ))}
        </div>

        {/* Spacer to push footer to bottom */}
        <div className="flex-1" />

        {/* Footer (sama seperti halaman lain) */}
        <div className="w-full mt-auto">
          <div className="border-t border-gray-300 mb-2" />
          <div className="flex items-center text-[6px] text-gray-700">
            <div className="flex-1 text-left">
              SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
            </div>
            <div className="flex-1 text-center font-semibold">
              INTERNAL AUDIT REPORT
            </div>
            <div className="flex-1 text-right">
              PAGE <span className="mx-1">4</span> of <span className="ml-1">{totalPages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden measurement templates for Executive Summary pagination */}
      {hasMounted && (
        <div
          className="absolute left-[-9999px] top-0 pointer-events-none"
          style={{ visibility: "hidden" }}
          aria-hidden="true"
        >
          <div className="w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">Executive Summary</h1>
            </div>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 text-xs font-medium"
              >
                Edit Executive Summary
              </button>
            </div>
            <div ref={executiveSummaryFirstSlotRef} className="flex-1 min-h-0">
              <div
                ref={executiveSummaryMeasureBlocksRef}
                className="executive-summary-content text-[11px] leading-relaxed"
              >
                {executiveSummaryBlocks.map((block, idx) => (
                  <div
                    key={`measure-executive-summary-block-${idx}`}
                    data-executive-summary-block
                    dangerouslySetInnerHTML={{ __html: block }}
                  />
                ))}
              </div>
            </div>
            <div className="w-full mt-auto pt-2">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[6px] text-gray-700">
                <div className="flex-1 text-left">
                  SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
                </div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">
                  PAGE <span className="mx-1">{executiveSummaryStartPage}</span> of{" "}
                  <span className="ml-1">{totalPages}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16">
            <div ref={executiveSummaryNextSlotRef} className="flex-1 min-h-0" />
            <div className="w-full mt-auto pt-2">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[6px] text-gray-700">
                <div className="flex-1 text-left">
                  SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
                </div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">
                  PAGE <span className="mx-1">{executiveSummaryStartPage + 1}</span> of{" "}
                  <span className="ml-1">{totalPages}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">Audit Objectives and Scope</h1>
            </div>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 text-xs font-medium"
              >
                Edit Audit Objectives and Scope
              </button>
            </div>
            <div ref={auditObjectivesFirstSlotRef} className="flex-1 min-h-0">
              <div
                ref={auditObjectivesMeasureBlocksRef}
                className="executive-summary-content text-[11px] leading-relaxed"
              >
                {auditObjectivesScopeBlocks.map((block, idx) => (
                  <div
                    key={`measure-audit-objectives-block-${idx}`}
                    data-audit-objectives-block
                    dangerouslySetInnerHTML={{ __html: block }}
                  />
                ))}
              </div>
            </div>
            <div className="w-full mt-auto pt-2">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[6px] text-gray-700">
                <div className="flex-1 text-left">
                  SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
                </div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">
                  PAGE <span className="mx-1">{auditObjectivesStartPage}</span> of{" "}
                  <span className="ml-1">{totalPages}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16">
            <div ref={auditObjectivesNextSlotRef} className="flex-1 min-h-0" />
            <div className="w-full mt-auto pt-2">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[6px] text-gray-700">
                <div className="flex-1 text-left">
                  SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
                </div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">
                  PAGE <span className="mx-1">{auditObjectivesStartPage + 1}</span> of{" "}
                  <span className="ml-1">{totalPages}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">Audit Approach and Methodology</h1>
            </div>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 text-xs font-medium"
              >
                Edit Audit Approach and Methodology
              </button>
            </div>
            <div ref={auditApproachFirstSlotRef} className="flex-1 min-h-0 pb-8">
              <div
                ref={auditApproachMeasureBlocksRef}
                className="executive-summary-content text-[11px] leading-relaxed"
              >
                {auditApproachMethodologyBlocks.map((block, idx) => (
                  <div
                    key={`measure-audit-approach-block-${idx}`}
                    data-audit-approach-block
                    dangerouslySetInnerHTML={{ __html: block }}
                  />
                ))}
              </div>
            </div>
            <div className="w-full mt-auto pt-4">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[6px] text-gray-700">
                <div className="flex-1 text-left">
                  SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
                </div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">
                  PAGE <span className="mx-1">{auditApproachStartPage}</span> of{" "}
                  <span className="ml-1">{totalPages}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16">
            <div ref={auditApproachNextSlotRef} className="flex-1 min-h-0 pb-8" />
            <div className="w-full mt-auto pt-4">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[6px] text-gray-700">
                <div className="flex-1 text-left">
                  SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
                </div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">
                  PAGE <span className="mx-1">{auditApproachStartPage + 1}</span> of{" "}
                  <span className="ml-1">{totalPages}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Executive Summary pages */}
      {executiveSummaryPages.map((pageHtml, pageIdx) => (
        <div
          key={`executive-summary-page-${pageIdx}`}
          className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16 break-after-page"
        >
          {pageIdx === 0 && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">Executive Summary</h1>
              </div>

              <div className="print:hidden mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => openRichTextEditor("executiveSummary")}
                  className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium"
                >
                  Edit Executive Summary
                </button>
              </div>
            </>
          )}

          <div
            className={`executive-summary-content flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed text-justify pb-8 ${pageIdx > 0 ? "pt-2" : ""}`}
            dangerouslySetInnerHTML={{ __html: pageHtml }}
          />

          <div className="w-full mt-auto pt-4">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[6px] text-gray-700">
              <div className="flex-1 text-left">
                SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
              </div>
              <div className="flex-1 text-center font-semibold">
                INTERNAL AUDIT REPORT
              </div>
              <div className="flex-1 text-right">
                PAGE <span className="mx-1">{executiveSummaryStartPage + pageIdx}</span> of <span className="ml-1">{totalPages}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Shared rich text editor modal */}
      {richTextEditorSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">{getRichTextEditorTitle(richTextEditorSection)}</h2>
              <button
                type="button"
                onClick={closeRichTextEditor}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Toolbar */}
            {/* Custom contentEditable editor (stabil dan ringan) */}
            <div className="flex-1 overflow-auto px-4 py-3 text-[11px] leading-relaxed">
              {/* Toolbar */}
              <div className="pb-2 flex flex-wrap gap-2 text-xs border-b border-gray-200 mb-2">
                {(() => {
                  return (
                    <>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("bold");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 font-semibold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("italic");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("underline");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 underline"
                      >
                        U
                      </button>
                      <span className="h-5 w-px bg-gray-300 mx-1" />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("justifyLeft");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        L
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("justifyCenter");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("justifyRight");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        R
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("justifyFull");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        J
                      </button>
                      <span className="h-5 w-px bg-gray-300 mx-1" />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("insertUnorderedList");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        •
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExecutiveSummaryCommand("insertOrderedList");
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100"
                      >
                        1.
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Editable area */}
              <div
                ref={executiveSummaryEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="executive-summary-content min-h-[260px] max-h-[420px] overflow-auto p-3 text-[11px] leading-relaxed outline-none border border-gray-200 rounded"
                onInput={syncExecutiveSummaryDraftFromEditor}
                onPaste={(e) => {
                  e.preventDefault();
                  const html = e.clipboardData.getData("text/html");
                  const text = e.clipboardData.getData("text/plain");

                  if (html) {
                    const sanitized = sanitizeExecutiveSummaryHtml(html, year);
                    document.execCommand("insertHTML", false, sanitized);
                  } else {
                    const escaped = String(text || "")
                      .split(/\n{2,}/)
                      .map((block) =>
                        `<p>${block
                          .split("\n")
                          .map((line) =>
                            line
                              .replace(/&/g, "&amp;")
                              .replace(/</g, "&lt;")
                              .replace(/>/g, "&gt;"),
                          )
                          .join("<br>")}</p>`,
                      )
                      .join("");
                    document.execCommand("insertHTML", false, escaped || "<p></p>");
                  }

                  syncExecutiveSummaryDraftFromEditor();
                }}
              />
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={closeRichTextEditor}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRichTextEditor}
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Objectives & Scope pages */}
      {auditObjectivesScopePages.map((pageHtml, pageIdx) => (
        <div
          key={`audit-objectives-page-${pageIdx}`}
          className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16 break-after-page"
        >
          {pageIdx === 0 && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">Audit Objectives and Scope</h1>
              </div>

              <div className="print:hidden mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => openRichTextEditor("auditObjectivesScope")}
                  className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium"
                >
                  Edit Audit Objectives and Scope
                </button>
              </div>
            </>
          )}

          <div
            className={`executive-summary-content flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed text-justify ${pageIdx > 0 ? "pt-2" : ""}`}
            dangerouslySetInnerHTML={{ __html: pageHtml }}
          />

          <div className="w-full mt-auto pt-2">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[6px] text-gray-700">
              <div className="flex-1 text-left">
                SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
              </div>
              <div className="flex-1 text-center font-semibold">
                INTERNAL AUDIT REPORT
              </div>
              <div className="flex-1 text-right">
                PAGE <span className="mx-1">{auditObjectivesStartPage + pageIdx}</span> of <span className="ml-1">{totalPages}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Audit Approach and Methodology pages */}
      {auditApproachMethodologyPages.map((pageHtml, pageIdx) => (
        <div
          key={`audit-approach-page-${pageIdx}`}
          className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] flex flex-col px-24 pt-20 pb-16 break-after-page"
        >
          {pageIdx === 0 && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">Audit Approach and Methodology</h1>
              </div>

              <div className="print:hidden mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => openRichTextEditor("auditApproachMethodology")}
                  className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium"
                >
                  Edit Audit Approach and Methodology
                </button>
              </div>
            </>
          )}

          <div
            className={`executive-summary-content flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed text-justify ${pageIdx > 0 ? "pt-2" : ""}`}
            dangerouslySetInnerHTML={{ __html: pageHtml }}
          />

          <div className="w-full mt-auto pt-2">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[6px] text-gray-700">
              <div className="flex-1 text-left">
                SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
              </div>
              <div className="flex-1 text-center font-semibold">
                INTERNAL AUDIT REPORT
              </div>
              <div className="flex-1 text-right">
                PAGE <span className="mx-1">{auditApproachStartPage + pageIdx}</span> of <span className="ml-1">{totalPages}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Findings & Recommendations pages per department (mulai halaman 10) */}
      {findingPages.map((page, idx) => (
        <div
          key={`${page.dept.deptKey}-page-${idx}`}
          className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
        >
          {/* Title: hanya di halaman pertama departemen; halaman lanjutan (data berlanjut) tidak menampilkan judul ini */}
          {page.isFirstPageForDept && (
            <div className="text-center mb-10 flex-shrink-0">
              <h1 className="text-2xl font-bold">Findings &amp; Recommendations</h1>
            </div>
          )}

          {/* Content area: batasi tinggi; zona aman di atas footer; kelebihan → next page; no scroll */}
          <div
            className={`flex-1 min-h-0 min-w-0 overflow-hidden text-[11px] leading-relaxed space-y-6 ${!page.isFirstPageForDept ? "pt-4" : ""}`}
            style={{ paddingBottom: `${FINDING_SAFE_ZONE_REM}rem` }}
          >
            {/* Ulangi header saat halaman audit berdiri sendiri agar jelas masih department yang sama */}
            {(page.isFirstPageForDept || (page.auditRows.length > 0 && page.isFirstAuditChunk && page.sopRows.length === 0)) && (
              <div>
                <p className="font-bold">
                  5&nbsp;&nbsp;&nbsp;Finding &amp; Recommendation
                </p>
                <p>
                  5.{deptIndexMap[page.dept.deptKey] || 1}&nbsp;&nbsp;Department&nbsp;&nbsp;
                  <span className="font-semibold">{page.dept.deptLabel}</span>
                </p>
              </div>
            )}

            {page.isFirstPageForDept &&
              isDeptPublishedToReport(page.dept.deptKey, effectivePublishByDept) &&
              page.dept.executiveSummary && (
              <div className="border border-gray-300 rounded px-3 py-2 text-[10px] bg-gray-50/70 space-y-2">
                <p className="font-semibold">Executive Summary</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="font-medium">Objective of the Audit</p>
                    {page.dept.executiveSummary.objectiveOfAudit.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {page.dept.executiveSummary.objectiveOfAudit.map((item, idx) => (
                          <li key={`obj-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">1.1 Scope - Areas Covered</p>
                    {page.dept.executiveSummary.scopeAreasCovered.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {page.dept.executiveSummary.scopeAreasCovered.map((item, idx) => (
                          <li key={`scope-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">1.2 Methodology</p>
                    {page.dept.executiveSummary.scopeMethodology.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {page.dept.executiveSummary.scopeMethodology.map((item, idx) => (
                          <li key={`method-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">1.4 Limitations - Scope</p>
                    {page.dept.executiveSummary.limitationsScope.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {page.dept.executiveSummary.limitationsScope.map((item, idx) => (
                          <li key={`limit-scope-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Limitations - Time</p>
                    {page.dept.executiveSummary.limitationsTime.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {page.dept.executiveSummary.limitationsTime.map((item, idx) => (
                          <li key={`limit-time-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Limitations - Resource</p>
                    {page.dept.executiveSummary.limitationsResource.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {page.dept.executiveSummary.limitationsResource.map((item, idx) => (
                          <li key={`limit-resource-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-medium">Internal Audit Team</p>
                  {page.dept.executiveSummary.internalAuditTeam.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {page.dept.executiveSummary.internalAuditTeam.map((item, idx) => (
                        <li key={`team-${idx}`}>{formatExecutiveSummaryItem(item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>-</p>
                  )}
                </div>
              </div>
            )}

            {/* SOP Review table: subjudul hanya saat chunk pertama; halaman lanjutan (data berlanjut) tanpa subjudul */}
            {page.sopRows.length > 0 && (
              <div
                {...(page.isFirstSopChunk
                  ? reportBlockHtmlProps(
                      systemFindingSopBlockId(page.dept.deptKey),
                      BLOCK_KIND.SYSTEM,
                    )
                  : {})}
              >
                {page.isFirstSopChunk && (
                  <p className="font-semibold mb-2">
                    Standard Operating Procedure Related (SOP Review)
                  </p>
                )}
                <div className="px-2 min-w-0 w-full overflow-hidden">
                  <table className="sop-review-table w-full border-collapse text-[9px] table-fixed" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 text-center whitespace-nowrap">No</th>
                        <th className="border border-gray-300 text-left min-w-0">SOP Related</th>
                        <th className="border border-gray-300 text-left min-w-0">Review</th>
                        <th className="border border-gray-300 text-left min-w-0">Auditee Comment</th>
                        <th className="border border-gray-300 text-left min-w-0">Follow-Up Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.sopRows.map((row, rIdx) => (
                        <tr key={`sop-${page.dept.deptKey}-${idx}-${rIdx}-${row.sourceIndex ?? row.no ?? "row"}`} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-1.5 py-0.5 text-center whitespace-nowrap">
                            {row.no}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">
                            {row.sopRelated || ""}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">
                            {row.reviewComment || "-"}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">
                            {row.auditeeComment || "-"}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">
                            {row.followUpDetail || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Review / Audit Finding table */}
            {/* Audit Review table: subjudul hanya saat chunk pertama; halaman lanjutan tanpa subjudul */}
            {isDeptPublishedToReport(page.dept.deptKey, effectivePublishByDept) &&
              page.auditRows.length > 0 && (
              <div
                {...(page.isFirstAuditChunk
                  ? reportBlockHtmlProps(
                      systemFindingAuditBlockId(page.dept.deptKey),
                      BLOCK_KIND.SYSTEM,
                    )
                  : {})}
              >
                {page.isFirstAuditChunk && (
                  <p className="font-semibold mb-1 text-[10px]">
                    Audit Review — Findings Detail
                  </p>
                )}
                <div className="px-2 min-w-0 w-full overflow-hidden">
                  <table className="audit-findings-table w-full border-collapse text-[9px] leading-tight table-fixed" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>{auditTableColgroup()}</colgroup>
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="border border-blue-800 text-center">No</th>
                        <th className="border border-blue-800 text-center min-w-0">Risk ID</th>
                        <th className="border border-blue-800 text-center min-w-0">Risk Details</th>
                        <th className="border border-blue-800 text-center min-w-0">Risk Level</th>
                        <th className="border border-blue-800 text-center min-w-0">AP Code</th>
                        <th className="border border-blue-800 text-center min-w-0">Sub. Test</th>
                        <th className="border border-blue-800 text-center min-w-0">Method.</th>
                        <th className="border border-blue-800 text-center min-w-0">Finding Res.</th>
                        <th className="border border-blue-800 text-center min-w-0">Finding Desc.</th>
                        <th className="border border-blue-800 text-center min-w-0">Auditee Comment</th>
                        <th className="border border-blue-800 text-center min-w-0">Follow-Up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.auditRows.map((row, aIdx) => (
                        <tr key={`audit-${page.dept.deptKey}-${idx}-${aIdx}-${row.sourceIndex ?? row.no ?? "row"}`} className={aIdx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                          <td className="border border-blue-800 px-1.5 py-0.5 text-center align-top whitespace-nowrap">
                            {row.no}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0">
                            {row.riskId || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">
                            {row.riskDetails || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top text-center min-w-0">
                            {row.riskLevel ?? ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0">
                            {row.apCode || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">
                            {row.substantiveTest || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">
                            {row.methodology || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">
                            {row.findingResult || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">
                            {row.findingDescription || ""}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 whitespace-pre-wrap break-words">
                            {row.auditeeComment || "-"}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 whitespace-pre-wrap break-words">
                            {row.followUpDetail || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {page.sopRows.length === 0 && page.auditRows.length === 0 && (
              <p className="text-sm text-gray-500">
                No findings &amp; recommendations data available for this department.
              </p>
            )}
          </div>

          {/* Footer tetap di bawah halaman; konten panjang sudah di-paginate ke halaman berikutnya */}
          <div className="w-full flex-shrink-0 mt-auto pt-4">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[6px] text-gray-700">
              <div className="flex-1 text-left">
                SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM
              </div>
              <div className="flex-1 text-center font-semibold">
                INTERNAL AUDIT REPORT
              </div>
              <div className="flex-1 text-right">
                PAGE <span className="mx-1">{findingsPageStartNumber + idx}</span> of <span className="ml-1">{totalPages}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Finding & Recommendation — satu halaman per finding yang dipilih (multi checkbox) */}
      {findingDetailPages.map(({ section, finding, findingIndex }, idx) => {
        const deptNum = (deptIndexMap[section.deptKey] ?? 1);
        const riskRatingLabel = finding?.riskLevel != null
          ? (Number(finding.riskLevel) === 1 ? "Low" : Number(finding.riskLevel) === 2 ? "Moderate" : Number(finding.riskLevel) === 3 ? "High" : String(finding.riskLevel))
          : "";
        return (
          <div
            key={`finding-detail-${section.deptKey}-${findingIndex}-${idx}`}
            className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
          >
            <div className="text-center mb-6 flex-shrink-0">
              <h1 className="text-2xl font-bold">Findings &amp; Recommendations</h1>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed space-y-4">
              <div>
                <p className="font-bold">5&nbsp;&nbsp;&nbsp;Finding &amp; Recommendation</p>
                <p>
                  5.{deptNum}&nbsp;&nbsp;Department&nbsp;&nbsp;
                  <span className="font-semibold">{section.deptLabel}</span>
                </p>
                <p className="mt-2">
                  <span>5.{deptNum}.{findingIndex}&nbsp;&nbsp;Finding :&nbsp;&nbsp;</span>
                  <span className="font-medium">{finding.findingDescription || finding.findingResult || "-"}</span>
                </p>
              </div>
              <div className="space-y-1.5 border border-gray-200 rounded p-3 bg-gray-50/50">
                <p><span className="font-semibold">Area Audit :</span> {section.areaAudit ?? section.deptLabel}</p>
                <p><span className="font-semibold">Audit Program Code :</span> {finding.apCode || "-"}</p>
                <p><span className="font-semibold">Risk :</span> {finding.risk || "-"}</p>
                <p><span className="font-semibold">Risk Description :</span> {finding.riskDetails || "-"}</p>
                <p><span className="font-semibold">Effect if not mitigate :</span> {finding.effectIfNotMitigate || "-"}</p>
                <p><span className="font-semibold">Risk Rating :</span> {riskRatingLabel ? `[${riskRatingLabel}]` : "[Low, Moderate, High]"}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Recommendation</p>
                <textarea
                  className="w-full border border-gray-300 rounded p-2 text-[11px] min-h-[60px] resize-y"
                  placeholder="Recommendation"
                  defaultValue={finding.recommendation || ""}
                />
              </div>
              <div>
                <p className="font-semibold mb-1">Audit Response</p>
                <p className="text-gray-700">Auditee agrees to <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[120px]" placeholder="..." /> by <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[100px]" placeholder="date" />.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Management Response</p>
                <p className="text-gray-700">Management agrees to <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[120px]" placeholder="..." /> by <input type="text" className="border-b border-gray-400 mx-1 px-2 py-0.5 inline-block min-w-[100px]" placeholder="date" />.</p>
              </div>
            </div>
            <div className="w-full flex-shrink-0 mt-auto pt-4">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[9px] text-gray-700">
                <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + idx}</span> of <span className="ml-1">{totalPages}</span></div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 6 Conclusion — USER section; tetap tampil meski SYSTEM di-unlock. */}
      {showConclusionPaper && (
        <>
          {showConclusionForm ? (
            /* Form: title + input per department + Save */
            <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
              <div className="text-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold">Conclusion</h1>
              </div>
              <div className={`mb-4 ${CONCLUSION_APPENDIX_TEXT_CLASS}`}>
                <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
              </div>
              <div className={`flex-1 ${CONCLUSION_APPENDIX_TEXT_CLASS} leading-relaxed space-y-6`}>
                {conclusionDeptSections.map((section, i) => (
                  <div key={section.deptKey} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        6.{i + 1}&nbsp;&nbsp;Department&nbsp;&nbsp;{section.deptLabel}
                      </p>
                      <button
                        type="button"
                        disabled={conclusionAiLoadingDept != null}
                        onClick={() => handleGenerateConclusionAi(section)}
                        className="print:hidden shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-medium hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {conclusionAiLoadingDept === section.deptKey ? "Generating…" : "Generate with AI"}
                      </button>
                    </div>
                    <textarea
                      data-conclusion-textarea
                      className={`w-full border border-gray-300 rounded p-3 ${CONCLUSION_APPENDIX_TEXT_CLASS} min-h-[80px] resize-y overflow-y-auto bg-gray-50 placeholder:text-gray-400`}
                      placeholder="Conclusion for this department..."
                      value={conclusionValues[section.deptKey] ?? ""}
                      onChange={(e) => setConclusionValues((prev) => ({ ...prev, [section.deptKey]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={handleSaveConclusion}
                  className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
              <div className="w-full flex-shrink-0 mt-auto pt-4">
                <div className="border-t border-gray-300 mb-2" />
                <div className="flex items-center text-[9px] text-gray-700">
                  <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                  <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                  <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + findingDetailPages.length}</span> of <span className="ml-1">{totalPages}</span></div>
                </div>
              </div>
            </div>
          ) : conclusionPages.length > 0 ? (
            /* Hasil: halaman ter-paginate (page 1 penuh dulu) */
            conclusionPages.map((pageSections, pageIdx) => (
              <div
                key={`conclusion-${pageIdx}`}
                className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
              >
                {pageIdx === 0 && (
                  <div className="text-center mb-6 flex-shrink-0 flex flex-col items-center gap-2">
                    <h1 className="text-2xl font-bold">Conclusion</h1>
                    <button
                      type="button"
                      onClick={() => setShowConclusionForm(true)}
                      className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                      Edit Conclusion
                    </button>
                  </div>
                )}
                <div
                  className={`flex-1 min-h-0 min-w-0 overflow-hidden ${CONCLUSION_APPENDIX_TEXT_CLASS} leading-relaxed space-y-6`}
                  style={{ paddingBottom: `${CONCLUSION_SAFE_ZONE_PX}px` }}
                >
                  {pageIdx === 0 && (
                    <div>
                      <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
                    </div>
                  )}
                  {pageSections.map((segment, i) => {
                    return (
                      <div key={`${segment.deptKey}-${pageIdx}-${i}`} className="space-y-2 break-inside-avoid">
                        {segment.showHeader !== false && (
                          <p className="font-semibold">
                            6.{segment.sectionNumber}&nbsp;&nbsp;Department&nbsp;&nbsp;{segment.deptLabel}
                          </p>
                        )}
                        <div className={`w-full border border-gray-300 rounded p-3 ${CONCLUSION_APPENDIX_TEXT_CLASS} bg-gray-50 whitespace-pre-wrap break-words`}>
                          {segment.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="w-full flex-shrink-0 mt-auto pt-4">
                  <div className="border-t border-gray-300 mb-2" />
                  <div className="flex items-center text-[9px] text-gray-700">
                    <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                    <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                    <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + findingDetailPages.length + pageIdx}</span> of <span className="ml-1">{totalPages}</span></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Awal: hanya title + button Add Conclusion (di bawah title, ada data SOP/Audit) */
            <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
              <div className="text-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold">Conclusion</h1>
              </div>
              <div className={`mb-6 ${CONCLUSION_APPENDIX_TEXT_CLASS}`}>
                <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-start pt-8">
                <button
                  type="button"
                  onClick={() => setShowConclusionForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 print:hidden"
                >
                  Add Conclusion
                </button>
                <p className="mt-4 text-sm text-gray-500 print:hidden">Click to fill in conclusion per department (departments with SOP/Audit Review data).</p>
              </div>
              <div className="w-full flex-shrink-0 mt-auto pt-4">
                <div className="border-t border-gray-300 mb-2" />
                <div className="flex items-center text-[9px] text-gray-700">
                  <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                  <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                  <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + findingDetailPages.length}</span> of <span className="ml-1">{totalPages}</span></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hanya Conclusion: pengukuran hanya untuk department yang berisi data (untuk Save). */}
      {showConclusionPaper && conclusionDeptSections.length > 0 && (
        <div
          ref={conclusionMeasureRef}
          className="absolute left-[-9999px] top-0 w-[210mm] overflow-visible"
          style={{ visibility: "hidden", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className={`px-16 ${CONCLUSION_APPENDIX_TEXT_CLASS} leading-relaxed space-y-6`}>
            {buildConclusionDeptSegments(conclusionDeptSections, conclusionValues).map((segment) => (
              <div
                key={`${segment.deptKey}-measure`}
                data-conclusion-block
                className="space-y-2"
              >
                <p className="font-semibold">
                  6.{segment.sectionNumber}&nbsp;&nbsp;Department&nbsp;&nbsp;{segment.deptLabel}
                </p>
                <div className={`w-full border border-gray-300 rounded p-3 ${CONCLUSION_APPENDIX_TEXT_CLASS} min-h-0 bg-gray-50 whitespace-pre-wrap break-words`}>
                  {segment.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pengukuran tinggi riil (seperti Word): isi halaman sampai penuh lalu next page. Tabel tersembunyi, sama lebar & style dengan report. */}
      {paginatedFindingSections.length > 0 && (
        <div
          ref={measureContainerRef}
          className="absolute left-[-9999px] top-0 w-[210mm] overflow-visible"
          style={{ visibility: "hidden", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className="px-16 text-[11px]">
            {paginatedFindingSections.map((section) => (
              <div key={section.deptKey}>
                {section.sopRows.length > 0 && (
                  <div className="mb-8">
                    <div className="px-2">
                      <table
                        data-measure-sop={section.deptKey}
                        className="sop-review-table w-full max-w-full border-collapse text-[9px] table-fixed"
                        style={{ tableLayout: "fixed" }}
                      >
                        <colgroup>
                          <col style={{ width: "4%" }} />
                          <col style={{ width: "42%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "18%" }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-1.5 py-1 text-center whitespace-nowrap">No</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">SOP</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">Review</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">A</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.sopRows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="border border-gray-300 px-1.5 py-0.5 text-center whitespace-nowrap">{row.no}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">{row.sopRelated || ""}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">{row.reviewComment || "-"}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">{row.auditeeComment || "-"}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 whitespace-pre-wrap break-words min-w-0">{row.followUpDetail || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {section.auditRows.length > 0 && (
                  <div className="px-2">
                    <table
                      data-measure-audit={section.deptKey}
                      className="audit-findings-table w-full max-w-full border-collapse text-[9px] leading-tight table-fixed"
                      style={{ tableLayout: "fixed" }}
                    >
                      <colgroup>{auditTableColgroup()}</colgroup>
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="border border-blue-800 px-1.5 py-0.5 text-center whitespace-nowrap">No</th>
                          <th className={`border border-blue-800 px-1.5 py-0.5 min-w-0`}>RID</th>
                          <th className={`border border-blue-800 px-1.5 py-0.5 min-w-0`}>Risk</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">L</th>
                          <th className={`border border-blue-800 px-1.5 py-0.5 min-w-0`}>Code</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Test</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Method</th>
                          <th className={`border border-blue-800 px-1.5 py-0.5 min-w-0`}>Result</th>
                          <th className={`border border-blue-800 px-1.5 py-0.5 min-w-0`}>Desc</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">A</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.auditRows.map((row, aIdx) => (
                          <tr key={aIdx} className={aIdx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                            <td className="border border-blue-800 px-1.5 py-0.5 text-center align-top whitespace-nowrap">{row.no}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0">{row.riskId || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">{row.riskDetails || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top text-center min-w-0">{row.riskLevel ?? ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0">{row.apCode || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">{row.substantiveTest || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">{row.methodology || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">{row.findingResult || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0">{row.findingDescription || ""}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 whitespace-pre-wrap break-words">
                              {row.auditeeComment || "-"}
                            </td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 whitespace-pre-wrap break-words">
                              {row.followUpDetail || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7 Appendices — editor single-page on screen, preview/print paginated so each page keeps its own footer */}
      {showAppendixEditor ? (
        <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
          <div className="text-center mb-8 flex-shrink-0 flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold">Appendices</h1>
            <div className="print:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAppendixEditor(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
              >
                Close Editor
              </button>
              <button
                type="button"
                onClick={() =>
                  setAppendices((prev) => [
                    ...prev,
                    {
                      id: `appendix-${Date.now()}`,
                      type: "text",
                      title: `Appendix ${String.fromCharCode(65 + prev.length)} - New Section`,
                      content: "",
                    },
                  ])
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 text-sm"
              >
                + Add Appendix
              </button>
            </div>
          </div>

          <div className={`flex-1 ${CONCLUSION_APPENDIX_TEXT_CLASS} leading-relaxed space-y-8`}>
            {appendices.map((appendix, idx) => (
              <div key={appendix.id} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-bold">
                      7.{idx + 1}&nbsp;&nbsp;
                      <input
                        type="text"
                        value={appendix.title}
                        onChange={(e) =>
                          setAppendices((prev) =>
                            prev.map((item) =>
                              item.id === appendix.id ? { ...item, title: e.target.value } : item,
                            ),
                          )
                        }
                        className={`border border-gray-300 rounded px-2 py-1 ${CONCLUSION_APPENDIX_TEXT_CLASS} w-full max-w-[420px] print:border-none print:p-0 print:bg-transparent`}
                      />
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAppendices((prev) => prev.filter((item) => item.id !== appendix.id))
                    }
                    className="print:hidden text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>

                {appendix.type === "table" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`font-semibold ${CONCLUSION_APPENDIX_TEXT_CLASS}`}>{appendix.content || "Risk Matrix"}</div>
                      <button
                        type="button"
                        onClick={() => addAppendixTableRow(appendix.id)}
                        className="print:hidden px-3 py-1 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700"
                      >
                        Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table
                        className="w-full border-collapse table-fixed text-[10px]"
                        style={{ tableLayout: "fixed", width: "100%" }}
                      >
                        <colgroup>
                          <col className="w-[12%]" />
                          <col className="w-[10%]" />
                          <col className="w-[39%]" />
                          <col className="w-[13%]" />
                          <col className="w-[11%]" />
                          <col className="w-[15%]" />
                        </colgroup>
                        <thead>
                          <tr className="bg-[#8f8f8f] text-white">
                            <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Department</th>
                            <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>AP No</th>
                            <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Risk Factor</th>
                            <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Risk Indicator</th>
                            <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Risk Level</th>
                            <th className="border border-black px-2 py-1 text-center font-semibold print:hidden">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(appendix.tableRows || []).map((row, rowIdx) => (
                            <tr key={`${appendix.id}-row-${rowIdx}`} className="bg-white">
                              <td className={`border border-black p-0 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>
                                <input
                                  type="text"
                                  value={row.department || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "department", e.target.value)}
                                  className={APPENDIX_TABLE_INPUT}
                                />
                              </td>
                              <td className={`border border-black p-0 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>
                                <input
                                  type="text"
                                  value={row.apNo || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "apNo", e.target.value)}
                                  className={APPENDIX_TABLE_INPUT}
                                />
                              </td>
                              <td className={`border border-black p-0 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>
                                <textarea
                                  rows={1}
                                  value={row.riskFactor || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "riskFactor", e.target.value)}
                                  className={APPENDIX_TABLE_INPUT}
                                />
                              </td>
                              <td className={`border border-black p-0 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>
                                <textarea
                                  rows={1}
                                  value={row.riskIndicator || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "riskIndicator", e.target.value)}
                                  className={APPENDIX_TABLE_INPUT}
                                />
                              </td>
                              <td className={`border border-black p-0 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>
                                <input
                                  type="text"
                                  value={row.riskLevel || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "riskLevel", e.target.value)}
                                  className={APPENDIX_TABLE_INPUT}
                                />
                              </td>
                              <td className="border border-black px-1 py-1 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={() => removeAppendixTableRow(appendix.id, rowIdx)}
                                  className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={appendix.content}
                    onChange={(e) =>
                      setAppendices((prev) =>
                        prev.map((item) =>
                          item.id === appendix.id ? { ...item, content: e.target.value } : item,
                        ),
                      )
                    }
                    className={`w-full border border-gray-300 rounded p-3 ${CONCLUSION_APPENDIX_TEXT_CLASS} min-h-[140px] resize-y bg-gray-50`}
                    placeholder="Input appendix content here..."
                  />
                )}
              </div>
            ))}
          </div>

          <div className="w-full flex-shrink-0 mt-auto pt-4">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[9px] text-gray-700">
              <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
              <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
              <div className="flex-1 text-right">PAGE <span className="mx-1">{appendixPageBase}</span> of <span className="ml-1">{totalPages}</span></div>
            </div>
          </div>
        </div>
      ) : (
        appendixPages.map((page, pageIdx) => (
          <div
            key={`appendix-page-${pageIdx}`}
            className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
          >
            <div className={`flex-1 min-h-0 ${CONCLUSION_APPENDIX_TEXT_CLASS} leading-relaxed space-y-6 overflow-hidden`}>
              {page.showAppendicesHeading && (
                <div className="text-center mb-2 flex-shrink-0 flex flex-col items-center gap-2">
                  <h1 className="text-2xl font-bold">Appendices</h1>
                  <div className="print:hidden flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAppendixEditor(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
                    >
                      Edit Appendices
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAppendices((prev) => [
                          ...prev,
                          {
                            id: `appendix-${Date.now()}`,
                            type: "text",
                            title: `Appendix ${String.fromCharCode(65 + prev.length)} - New Section`,
                            content: "",
                          },
                        ])
                      }
                      className="px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 text-sm"
                    >
                      + Add Appendix
                    </button>
                  </div>
                </div>
              )}

              {page.segments.map((segment, segmentIdx) => (
                <div key={`${segment.appendixId}-${pageIdx}-${segmentIdx}`} className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold">
                        7.{segment.appendixIndex + 1}&nbsp;&nbsp;{segment.title}
                      </p>
                    </div>
                  </div>

                  {segment.type === "table" ? (
                    <div className="space-y-2">
                      <div className={`font-semibold ${CONCLUSION_APPENDIX_TEXT_CLASS}`}>{segment.subtitle}</div>
                      <div className="overflow-x-auto">
                        <table
                          className="w-full border-collapse table-fixed text-[10px]"
                          style={{ tableLayout: "fixed", width: "100%" }}
                        >
                          <colgroup>
                            <col className="w-[13%]" />
                            <col className="w-[12%]" />
                            <col className="w-[50%]" />
                            <col className="w-[13%]" />
                            <col className="w-[12%]" />
                          </colgroup>
                          <thead>
                            <tr className="bg-[#8f8f8f] text-white">
                              <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Department</th>
                              <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>AP No</th>
                              <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Risk Factor</th>
                              <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Risk Indicator</th>
                              <th className={`border border-black px-2 py-1 text-center font-semibold ${APPENDIX_TABLE_CELL_WRAP}`}>Risk Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(segment.rows || []).map((row, rowIdx) => (
                              <tr key={`${segment.appendixId}-view-${pageIdx}-${rowIdx}`} className="bg-white">
                                <td className={`border border-black px-2 py-1 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>{row.department || ""}</td>
                                <td className={`border border-black px-2 py-1 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>{row.apNo || ""}</td>
                                <td className={`border border-black px-2 py-1 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>{row.riskFactor || ""}</td>
                                <td className={`border border-black px-2 py-1 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>{row.riskIndicator || ""}</td>
                                <td className={`border border-black px-2 py-1 align-top min-h-8 ${APPENDIX_TABLE_CELL_WRAP}`}>{row.riskLevel || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded p-3 bg-gray-50 whitespace-pre-wrap break-words min-h-[60px]">
                      {segment.content || "[No appendix content yet]"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="w-full flex-shrink-0 mt-auto pt-4">
              <div className="border-t border-gray-300 mb-2" />
              <div className="flex items-center text-[9px] text-gray-700">
                <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                <div className="flex-1 text-right">PAGE <span className="mx-1">{appendixPageBase + pageIdx}</span> of <span className="ml-1">{totalPages}</span></div>
              </div>
            </div>
          </div>
        ))
      )}

      </div>

    </div>
  );
}

export default function ReportPreviewPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <ReportPreviewPageContent />
    </Suspense>
  );
}


