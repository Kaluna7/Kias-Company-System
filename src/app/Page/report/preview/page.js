"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo, Suspense } from "react";

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

const APPENDIX_FIRST_PAGE_CAPACITY = 24;
const APPENDIX_PAGE_CAPACITY = 30;
const APPENDIX_TEXT_CHARS_PER_UNIT = 210;
const APPENDIX_TABLE_ROWS_PER_PAGE = 16;
const EXECUTIVE_SUMMARY_PAGE_SAFE_PX = 190;
const EXECUTIVE_SUMMARY_FIRST_PAGE_EXTRA_PX = 72;
const AUDIT_APPROACH_PAGE_SAFE_PX = 240;
const AUDIT_APPROACH_FIRST_PAGE_EXTRA_PX = 100;
const EXECUTIVE_SUMMARY_PARAGRAPH_SPLIT_CHARS = 320;
const CONCLUSION_PARAGRAPH_SPLIT_CHARS = 280;

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
      <p>&nbsp;</p>
      <p><strong>1.5&nbsp;&nbsp;Summary of Key Recommendations</strong></p>
      <p>&nbsp;</p>
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

  return blocks.length > 0 ? blocks : [normalized];
}

function splitExecutiveSummaryIntoBlocks(html, year) {
  return splitRichTextHtmlIntoBlocks(html, createDefaultExecutiveSummaryHtml(year));
}

function estimateAppendixTextUnits(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return Math.max(1, Math.ceil(normalized.length / APPENDIX_TEXT_CHARS_PER_UNIT));
}

function splitAppendixTextIntoChunks(content, maxUnitsPerChunk = 12) {
  const paragraphs = String(content || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [""];

  const chunks = [];
  let current = [];
  let usedUnits = 0;

  const pushCurrent = () => {
    if (current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      usedUnits = 0;
    }
  };

  const splitOversizedParagraph = (paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let part = "";
    const parts = [];

    words.forEach((word) => {
      const next = part ? `${part} ${word}` : word;
      if (estimateAppendixTextUnits(next) > maxUnitsPerChunk && part) {
        parts.push(part);
        part = word;
      } else {
        part = next;
      }
    });

    if (part) parts.push(part);
    return parts;
  };

  paragraphs.forEach((paragraph) => {
    const paraUnits = estimateAppendixTextUnits(paragraph);

    if (paraUnits > maxUnitsPerChunk) {
      pushCurrent();
      splitOversizedParagraph(paragraph).forEach((part) => {
        chunks.push(part);
      });
      return;
    }

    if (usedUnits + paraUnits > maxUnitsPerChunk && current.length > 0) {
      pushCurrent();
    }

    current.push(paragraph);
    usedUnits += paraUnits;
  });

  pushCurrent();
  return chunks.length > 0 ? chunks : [""];
}

function buildAppendixPages(appendices) {
  const pages = [];

  const pushPage = (page) => {
    if (page.segments.length > 0 || page.showAppendicesHeading) {
      pages.push(page);
    }
  };

  let currentPage = {
    showAppendicesHeading: true,
    usedCapacity: 0,
    segments: [],
  };

  const ensureCapacity = (required) => {
    const maxCapacity = currentPage.showAppendicesHeading
      ? APPENDIX_FIRST_PAGE_CAPACITY
      : APPENDIX_PAGE_CAPACITY;

    if (currentPage.segments.length > 0 && currentPage.usedCapacity + required > maxCapacity) {
      pushPage(currentPage);
      currentPage = {
        showAppendicesHeading: false,
        usedCapacity: 0,
        segments: [],
      };
    }
  };

  appendices.forEach((appendix, appendixIndex) => {
    if (appendix?.type === "table") {
      const rows = Array.isArray(appendix.tableRows) ? appendix.tableRows : [];
      const rowChunks = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += APPENDIX_TABLE_ROWS_PER_PAGE) {
        rowChunks.push(rows.slice(i, i + APPENDIX_TABLE_ROWS_PER_PAGE));
      }
      if (rowChunks.length === 0) rowChunks.push([]);

      rowChunks.forEach((rowsChunk, chunkIndex) => {
        const requiredUnits = 10 + Math.max(1, Math.ceil(rowsChunk.length / 2));
        ensureCapacity(requiredUnits);
        currentPage.segments.push({
          type: "table",
          appendixId: appendix.id,
          appendixIndex,
          title: appendix.title,
          subtitle: appendix.content || "Risk Matrix",
          rows: rowsChunk,
          isContinued: chunkIndex > 0,
        });
        currentPage.usedCapacity += requiredUnits;
      });
      return;
    }

    const textChunks = splitAppendixTextIntoChunks(appendix?.content || "", 10);
    textChunks.forEach((textChunk, chunkIndex) => {
      const requiredUnits = 4 + estimateAppendixTextUnits(textChunk || " ");
      ensureCapacity(requiredUnits);
      currentPage.segments.push({
        type: "text",
        appendixId: appendix.id,
        appendixIndex,
        title: appendix.title,
        content: textChunk,
        isContinued: chunkIndex > 0,
      });
      currentPage.usedCapacity += requiredUnits;
    });
  });

  pushPage(currentPage);
  return pages;
}

function parseJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [auditCoverage, setAuditCoverage] = useState(
    "FINANCIAL PROCESSES AND COMPLIANCE",
  );
  const [departmentCoverage, setDepartmentCoverage] = useState("ALL DEPARTMENT");
  const [area, setArea] = useState("BALI, JAKARTA, MEDAN AND BATAM");

  const [findingSections, setFindingSections] = useState([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
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
  const [auditCommitteeName, setAuditCommitteeName] = useState("GN HIANG LIN");
  const [auditCommitteeDate, setAuditCommitteeDate] = useState("");
  const [presidentDirectorName, setPresidentDirectorName] = useState(
    "IR. WONG BUDI SETIAWAN",
  );
  const [presidentDirectorDate, setPresidentDirectorDate] = useState("");

  const pendingFieldUpdatesRef = useRef({});
  const fieldUpdateTimerRef = useRef(null);

  const flushPendingFieldUpdates = () => {
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
  }, [appendicesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(appendicesStorageKey, JSON.stringify(appendices));
    } catch {
      // ignore localStorage failures
    }
  }, [appendices, appendicesStorageKey]);

  useEffect(() => {
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
  }, [executiveSummaryStorageKey, year]);

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
    try {
      const raw = localStorage.getItem(auditObjectivesScopeStorageKey);
      setAuditObjectivesScopeHtml(
        normalizeHtmlWithFallback(raw, createDefaultAuditObjectivesScopeHtml()),
      );
    } catch {
      setAuditObjectivesScopeHtml(createDefaultAuditObjectivesScopeHtml());
    }
  }, [auditObjectivesScopeStorageKey, year]);

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
  }, [auditApproachMethodologyStorageKey, year]);

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
          chunks.push(current.join(""));
          current = [];
          sum = 0;
          limit = nextLimit;
        }

        current.push(executiveSummaryBlocks[idx]);
        sum += height;
      });

      if (current.length > 0) {
        chunks.push(current.join(""));
      }

      if (!cancelled) {
        const nextChunks =
          chunks.length > 0 ? chunks : [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)];
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
          chunks.push(current.join(""));
          current = [];
          sum = 0;
          limit = nextLimit;
        }

        current.push(auditObjectivesScopeBlocks[idx]);
        sum += height;
      });

      if (current.length > 0) {
        chunks.push(current.join(""));
      }

      if (!cancelled) {
        const nextChunks =
          chunks.length > 0
            ? chunks
            : [
                sanitizeHtmlWithFallback(
                  auditObjectivesScopeHtml,
                  createDefaultAuditObjectivesScopeHtml(),
                ),
              ];
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
          chunks.push(current.join(""));
          current = [];
          sum = 0;
          limit = nextLimit;
        }

        current.push(auditApproachMethodologyBlocks[idx]);
        sum += height;
      });

      if (current.length > 0) {
        chunks.push(current.join(""));
      }

      if (!cancelled) {
        const nextChunks =
          chunks.length > 0
            ? chunks
            : [
                sanitizeHtmlWithFallback(
                  auditApproachMethodologyHtml,
                  createDefaultAuditApproachMethodologyHtml(),
                ),
              ];
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

    async function loadFindings() {
      try {
        setLoadingFindings(true);
        const sections = [];

        for (const dept of REPORT_DEPARTMENTS) {
          const params = new URLSearchParams();
          // Gunakan shape yang sama dengan halaman SOP Review Report: all=1 & year
          params.set("all", "1");
          if (year) params.set("year", String(year));

          // Load SOP Review published data (steps) dari report SOP (bukan draft)
          let sopRows = [];
          try {
            const sopRes = await fetch(
              `/api/SopReview/${dept.apiPath}/published?${params.toString()}`,
            );
            if (sopRes.ok) {
              const sopJson = await sopRes.json().catch(() => ({}));
              const publishes = Array.isArray(sopJson.publishes) ? sopJson.publishes : [];

              publishes.forEach((pub) => {
                (pub.rows || []).forEach((row, idx) => {
                  const sopRelated = (row.sop_related || "").toString().trim();
                  const status = (row.status || "").toString().toUpperCase();
                  if (!sopRelated) return;
                  if (status !== "APPROVED") return;
                  sopRows.push({
                    sourceIndex: sopRows.length,
                    no: row.no ?? idx + 1,
                    sopRelated,
                    status,
                    reviewComment: (row.comment || "").toString(),
                    auditeeComment: "",
                    followUpDetail: "",
                  });
                });
              });

              console.log("[REPORT-PREVIEW] SOP publishes", {
                dept: dept.label,
                apiPath: dept.apiPath,
                year,
                publishesCount: publishes.length,
                sopRowsCount: sopRows.length,
              });
            }
          } catch {
            // ignore SOP errors for consolidated report
          }

          // Load Audit Review findings from the audit review module only.
          let auditRows = [];
          let executiveSummary = null;
          try {
            try {
              const summaryUrl = year
                ? `/api/audit-review/${dept.apiPath}/executive-summary?year=${encodeURIComponent(String(year))}`
                : `/api/audit-review/${dept.apiPath}/executive-summary`;
              const summaryRes = await fetch(summaryUrl);
              if (summaryRes.ok) {
                const summaryJson = await summaryRes.json().catch(() => ({}));
                executiveSummary = summaryJson?.data || null;
              }
            } catch {
              executiveSummary = null;
            }

            const loadAuditReviewRows = async (withYear = true) => {
              const reviewUrl = withYear
                ? `/api/audit-review/${dept.apiPath}/findings?year=${encodeURIComponent(String(year))}`
                : `/api/audit-review/${dept.apiPath}/findings`;
              const reviewRes = await fetch(reviewUrl);
              if (!reviewRes.ok) return [];
              const reviewJson = await reviewRes.json().catch(() => ({}));
              return Array.isArray(reviewJson.rows) ? reviewJson.rows : [];
            };

            let rows = await loadAuditReviewRows(true);
            if (rows.length === 0 && !year) {
              rows = await loadAuditReviewRows(false);
            }

            if (rows.length > 0) {
              auditRows = rows.map((r, idx) => ({
                sourceIndex: idx,
                no: r.no ?? idx + 1,
                riskId: r.riskId ?? r.risk_id ?? "",
                risk: r.risk ?? "",
                riskDetails: r.riskDetails ?? r.risk_details ?? "",
                effectIfNotMitigate: r.effectIfNotMitigate ?? r.impact_description ?? "",
                riskLevel: r.riskLevel ?? r.risk ?? "",
                apCode: r.apNo ?? r.apCode ?? r.ap_code ?? "",
                substantiveTest: r.substantiveTest ?? r.substantive_test ?? "",
                methodology: r.method ?? "",
                findingResult: r.findingResult ?? r.finding_result ?? "",
                findingDescription: r.findingDescription ?? r.finding_description ?? "",
                recommendation: r.recommendation ?? "",
                auditeeComment: "",
                followUpDetail: "",
              }));
            }

            console.log("[REPORT-PREVIEW] Audit review data", {
              dept: dept.label,
              apiPath: dept.apiPath,
              year,
              isLocked: Boolean(executiveSummary?.is_locked),
              totalBackendRows: auditRows.length,
              mappedRows: auditRows.length,
            });
          } catch {
            // ignore audit-review errors for consolidated report
          }

          // Area Audit dari worksheet report (per dept)
          let areaAudit = dept.label;
          try {
            const wsRes = await fetch(
              `/api/worksheet/${dept.apiPath}${year ? `?year=${encodeURIComponent(String(year))}` : ""}`,
            );
            if (wsRes.ok) {
              const wsJson = await wsRes.json().catch(() => ({}));
              const wsRows = Array.isArray(wsJson.rows) ? wsJson.rows : [];
              const first = wsRows[0];
              if (first && (first.audit_area || first.auditArea)) {
                areaAudit = first.audit_area || first.auditArea;
              }
            }
          } catch {
            // fallback ke department label
          }

          const isAuditReviewLocked = executiveSummary?.is_locked === true;
          const visibleAuditRows = isAuditReviewLocked ? auditRows : [];

          if (sopRows.length > 0 || visibleAuditRows.length > 0) {
            const normalizedSopRows = sopRows.map((row, idx) => ({
              ...row,
              no: idx + 1,
            }));
            sections.push({
              deptKey: dept.key,
              deptLabel: dept.label,
              areaAudit,
              executiveSummary: isAuditReviewLocked && executiveSummary
                ? {
                    objectiveOfAudit: parseJsonList(executiveSummary.objective_of_audit),
                    scopeAreasCovered: parseJsonList(executiveSummary.scope_areas_covered),
                    scopeMethodology: parseJsonList(executiveSummary.scope_methodology),
                    limitationsScope: parseJsonList(executiveSummary.limitations_scope),
                    limitationsTime: parseJsonList(executiveSummary.limitations_time),
                    limitationsResource: parseJsonList(executiveSummary.limitations_resource),
                    internalAuditTeam: parseJsonList(executiveSummary.internal_audit_team),
                  }
                : null,
              sopRows: normalizedSopRows,
              auditRows: visibleAuditRows,
            });
          }
        }

        if (!cancelled) {
          setFindingSections(sections);
        }
      } finally {
        if (!cancelled) {
          setLoadingFindings(false);
        }
      }
    }

    loadFindings();

    return () => {
      cancelled = true;
    };
  }, [year]);

  // Tinggi area konten per halaman A4 (px), untuk pengukuran otomatis seperti Word.
  // Dibuat lebih konservatif agar baris terakhir tidak menyentuh footer; jika tinggi konten
  // melebihi batas ini, sisa baris otomatis pindah ke halaman berikutnya.
  const FINDING_SOP_TABLE_HEIGHT_PX = 640;
  const FINDING_AUDIT_TABLE_HEIGHT_PX = 640;
  const FINDING_FIRST_PAGE_TOP_BUFFER_PX = 80;
  const FINDING_FIRST_PAGE_EXEC_SUMMARY_BUFFER_PX = 120;

  /**
   * Ukur tinggi riil tabel dan bagi chunk agar tiap halaman terisi penuh (seperti Word).
   * Dipanggil setelah measurement block di-render.
   */
  useEffect(() => {
    if (!findingSections.length || !measureContainerRef.current) return;
    const container = measureContainerRef.current;
    let cancelled = false;
    const sopChunksByDept = {};
    const auditChunksByDept = {};

    const measureTableChunks = (tableEl, rows, firstLimitHeight, nextLimitHeight) => {
      if (!rows.length) return [];
      const tbody = tableEl?.querySelector("tbody");
      const trs = tbody?.querySelectorAll("tr");
      if (!trs?.length) return [rows];
      const heights = Array.from(trs).map((tr) => tr.getBoundingClientRect().height);
      const chunks = [];
      let chunk = [];
      let sum = 0;
      let currentLimit = Math.max(120, firstLimitHeight);
      for (let i = 0; i < rows.length; i++) {
        const h = heights[i] ?? 40;
        if (sum + h > currentLimit && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
          currentLimit = Math.max(120, nextLimitHeight);
        }
        chunk.push(rows[i]);
        sum += h;
      }
      if (chunk.length > 0) chunks.push(chunk);
      return chunks;
    };

    const runMeasure = () => {
      if (cancelled || !container.isConnected) return;
      findingSections.forEach((section) => {
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
        const auditTable = container.querySelector(`[data-measure-audit="${section.deptKey}"]`);
        if (auditTable && section.auditRows.length > 0) {
          auditChunksByDept[section.deptKey] = measureTableChunks(
            auditTable,
            section.auditRows,
            FINDING_AUDIT_TABLE_HEIGHT_PX - firstPageBuffer,
            FINDING_AUDIT_TABLE_HEIGHT_PX,
          );
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
    findingSections,
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
  }, [findingSections, measuredChunks]);

  /** Hanya Conclusion: zona aman (px) di atas footer; isi halaman dulu baru next page. */
  const CONCLUSION_SAFE_ZONE_PX = 50;
  const CONCLUSION_PAGE_MAX_HEIGHT_PX = 780;
  const CONCLUSION_FIRST_PAGE_EXTRA_PX = 80;

  /**
   * Hanya Conclusion: ukur blok teks per department-chunk agar teks panjang bisa lanjut ke page berikutnya.
   */
  useEffect(() => {
    if (!findingSections.length || !conclusionMeasureRef.current) return;
    const conclusionSegments = findingSections.flatMap((section, index) =>
      splitConclusionTextIntoChunks(conclusionValues[section.deptKey] ?? "").map((text, chunkIndex) => ({
        deptKey: section.deptKey,
        deptLabel: section.deptLabel,
        sectionNumber: index + 1,
        text,
        chunkIndex,
      })),
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
      const chunks = [];
      let chunk = [];
      let sum = 0;
      const spacing = 18;
      const limitFirst = CONCLUSION_PAGE_MAX_HEIGHT_PX - CONCLUSION_FIRST_PAGE_EXTRA_PX;
      for (let i = 0; i < conclusionSegments.length; i++) {
        const h = heights[i] ?? 80;
        const limit = chunks.length === 0 ? limitFirst : CONCLUSION_PAGE_MAX_HEIGHT_PX;
        if (sum + h + spacing > limit && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
        }
        chunk.push(conclusionSegments[i]);
        sum += h + spacing;
      }
      if (chunk.length > 0) chunks.push(chunk);
      if (!cancelled) setConclusionChunks(chunks);
    };
    requestAnimationFrame(() => requestAnimationFrame(runMeasure));
    const ro = new ResizeObserver(() => requestAnimationFrame(runMeasure));
    ro.observe(container);
    return () => { cancelled = true; ro.disconnect(); };
  }, [findingSections, conclusionValues]);

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
      const conclusionSegments = findingSections.flatMap((section, index) =>
        splitConclusionTextIntoChunks(conclusionValues[section.deptKey] ?? "").map((text, chunkIndex) => ({
          deptKey: section.deptKey,
          deptLabel: section.deptLabel,
          sectionNumber: index + 1,
          text,
          chunkIndex,
        })),
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
      const chunks = [];
      let chunk = [];
      let sum = 0;
      const spacing = 18;
      const limitFirst = CONCLUSION_PAGE_MAX_HEIGHT_PX - CONCLUSION_FIRST_PAGE_EXTRA_PX;
      for (let i = 0; i < conclusionSegments.length; i++) {
        const h = heights[i] ?? 80;
        const limit = chunks.length === 0 ? limitFirst : CONCLUSION_PAGE_MAX_HEIGHT_PX;
        if (sum + h + spacing > limit && chunk.length > 0) {
          chunks.push(chunk);
          chunk = [];
          sum = 0;
        }
        chunk.push(conclusionSegments[i]);
        sum += h + spacing;
      }
      if (chunk.length > 0) chunks.push(chunk);
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
  } = getFindingPageLimits({ maxRowsPerPage: 15, safeZoneRem: 6 });

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
    const len =
      (row.sopRelated || "").length +
      (row.reviewComment || "").length +
      (row.auditeeComment || "").length +
      (row.followUpDetail || "").length;
    if (len <= 100) return 1;
    if (len <= 220) return 2;
    if (len <= 300) return 3;
    return WEIGHT_VERY_LONG;
  }

  function getAuditRowWeight(row) {
    const len =
      (row.findingDescription || "").length +
      (row.riskDetails || "").length +
      (row.auditeeComment || "").length +
      (row.followUpDetail || "").length;
    if (len <= 80) return 1;
    if (len <= 200) return 2;
    if (len <= 300) return 3;
    return WEIGHT_VERY_LONG;
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

  // Map untuk nomor sub‑section 5.x per department (5.1 Finance, 5.2 Accounting, dst.)
  const deptIndexMap = {};
  findingSections.forEach((sec, i) => {
    deptIndexMap[sec.deptKey] = i + 1;
  });

  /**
   * Bagi data Findings & Recommendations per department menjadi beberapa halaman A4.
   * Max 15 baris per halaman; jika teks panjang sehingga konten akan menyentuh footer,
   * baris yang kelebihan (termasuk baris ke-15) dilanjutkan ke next page agar tidak terpotong.
   */
  const findingPages = (() => {
    const pages = [];
    findingSections.forEach((section) => {
      const sopChunks =
        measuredChunks?.sop?.[section.deptKey]?.length > 0
          ? measuredChunks.sop[section.deptKey].map((chunk) => [...chunk])
          : chunkRowsByContent(
              section.sopRows,
              getSopRowWeight,
              SOP_ROWS_PER_PAGE,
              SOP_PAGE_CAPACITY_UNITS
            );
      const auditChunks =
        measuredChunks?.audit?.[section.deptKey]?.length > 0
          ? measuredChunks.audit[section.deptKey].map((chunk) => [...chunk])
          : chunkRowsByContent(
              section.auditRows,
              getAuditRowWeight,
              AUDIT_ROWS_PER_PAGE,
              AUDIT_PAGE_CAPACITY_UNITS
            );

      if (sopChunks.length === 0 && auditChunks.length === 0) return;

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
      if (sopChunks.length > 0) {
        sopChunks.forEach((chunk, index) => {
          const isLastSopChunk = index === sopChunks.length - 1;
          let auditRows = [];
          if (isLastSopChunk && auditChunks.length > 0 && chunk.length <= MAX_SOP_ROWS_WITH_AUDIT) {
            auditRows = auditChunks.shift() || [];
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
      if (sopChunks.length === 0 && auditChunks.length > 0) {
        const firstAudit = auditChunks.shift() || [];
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

      auditChunks.forEach((chunk) => {
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

  const executiveSummaryPages =
    Array.isArray(executiveSummaryChunks) && executiveSummaryChunks.length > 0
      ? executiveSummaryChunks
      : [normalizeExecutiveSummaryHtml(executiveSummaryHtml, year)];
  const auditObjectivesScopePages =
    Array.isArray(auditObjectivesScopeChunks) && auditObjectivesScopeChunks.length > 0
      ? auditObjectivesScopeChunks
      : [
          sanitizeHtmlWithFallback(
            auditObjectivesScopeHtml,
            createDefaultAuditObjectivesScopeHtml(),
          ),
        ];
  const auditApproachMethodologyPages =
    Array.isArray(auditApproachMethodologyChunks) && auditApproachMethodologyChunks.length > 0
      ? auditApproachMethodologyChunks
      : [
          sanitizeHtmlWithFallback(
            auditApproachMethodologyHtml,
            createDefaultAuditApproachMethodologyHtml(),
          ),
        ];
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
      const indices = selectedFindingByDept[section.deptKey];
      if (!Array.isArray(indices) || indices.length === 0) return;
      indices.forEach((rowIndex, i) => {
        const finding = section.auditRows[rowIndex] ?? null;
        if (!finding) return;
        list.push({ section, finding, findingIndex: i + 1 });
      });
    });
    return list;
  })();

  /** Conclusion: pakai chunk dari Save (page 1 penuh dulu, sisanya next page); hanya ada setelah user klik Save. */
  const conclusionPages = (() => {
    if (!findingSections.length) return [];
    if (conclusionChunks && conclusionChunks.length > 0) return conclusionChunks;
    return [];
  })();

  const appendixPageBase =
    findingsPageStartNumber +
    findingPages.length +
    1 +
    findingDetailPages.length +
    (findingSections.length > 0 ? (conclusionPages.length > 0 ? conclusionPages.length : 1) : 0) +
    1;
  const appendixPages = buildAppendixPages(appendices);

  const handlePrint = () => {
    window.print();
  };

  const periodStart = `JANUARY ${year}`;
  const periodEnd = `DECEMBER ${year}`;
  // Tanggal issued mengikuti tanggal hari ini (format: Month DD, YYYY)
  const issuedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start p-4 print:bg-white print:p-0 gap-6">
      <style jsx global>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        .executive-summary-content p {
          margin: 0 0 0.65rem 0;
          overflow-wrap: anywhere;
          word-break: break-word;
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
      `}</style>
      {loadingFindings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 backdrop-blur-[1px] print:hidden">
          <div className="bg-white rounded-xl shadow-xl px-6 py-5 flex items-center gap-3 min-w-[260px]">
            <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <div className="text-sm text-gray-800 font-medium">Loading report data...</div>
          </div>
        </div>
      )}
      {/* Cover page - full A4: sama dengan cover.png (atas putih ~2/3, gelombang tengah, bawah biru gelap) */}
      <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden break-after-page relative">
        {/* 1. Atas: background putih, elemen geometris pojok kanan atas */}
        <div className="absolute top-0 right-0 h-[52%] w-[50%]">
          <img
            src="/images/upper_right.jpg"
            alt=""
            className="h-full w-full object-cover object-right object-top"
          />
        </div>
        {/* 2. Judul: kiri, sedikit di bawah sepertiga atas — INTERNAL / AUDIT (abu gelap), REPORT (biru-abu terang) */}
        <div className="absolute left-10 top-[28%] z-10">
          <div className="text-[3.5rem] font-bold text-gray-800 tracking-tight leading-tight">INTERNAL</div>
          <div className="text-[3.5rem] font-bold text-gray-800 tracking-tight leading-tight">AUDIT</div>
          <div className="text-[3.25rem] font-bold text-slate-400 tracking-tight leading-tight">REPORT</div>
        </div>
        {/* 3. Tengah: lapisan gelombang (turquoise + teal) dari middle.jpg */}
        <div className="absolute top-[50%] left-0 right-0 h-[20%]">
          <img
            src="/images/middle.jpg"
            alt=""
            className="w-full h-full object-cover object-center"
          />
        </div>
        {/* 4. Bawah: biru-abu gelap solid (tanpa gelombang) */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[30%] bg-[#2c3e50]"
          style={{
            clipPath: "none",
            WebkitClipPath: "none",
          }}
        />
        {/* 5. Logo KIAS kiri bawah, tahun kanan bawah */}
        <div className="absolute bottom-0 left-0 right-0 h-[30%] flex items-end justify-between px-10 pb-10 z-10 pointer-events-none">
          <img
            src="/images/kias-logo.png"
            alt="KIAS - PT KPU Internal Audit System"
            className="h-32 w-auto object-contain pointer-events-auto"
          />
          <span className="text-white text-7xl font-bold tracking-wide">{year}</span>
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
                  setPreparedBy((prev) => [...prev, { name, role, date }]);
                  setIsPreparedByModalOpen(false);
                }}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                Save
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
          <div className="flex flex-row items-center gap-3 flex-wrap">
            <div className="font-semibold tracking-wide w-[230px] shrink-0 whitespace-nowrap text-gray-700">
              PERIOD <span>:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="px-3 py-1 bg-gray-100 rounded font-semibold inline-block min-w-[120px] text-center">
                {periodStart}
              </span>
              <span className="font-semibold">-</span>
              <span className="px-3 py-1 bg-gray-100 rounded font-semibold inline-block min-w-[120px] text-center">
                {periodEnd}
              </span>
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
        {/* Audit Team */}
        <div className="mb-20 text-[10px]">
          <div className="text-center font-bold tracking-wide mb-2">
            AUDIT TEAM <span>:</span>
          </div>
          {/* Tombol tambah di bawah judul; hanya tampil di layar, tidak tercetak */}
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
          <div className="flex justify-center gap-12">
            {/* Kolom nama, dibuat rata tengah */}
            <div className="space-y-1 w-48 text-center">
              {auditTeam.map((member, idx) => (
                <div
                  key={`${member.name}-${member.role}-${idx}`}
                  className="px-2 py-[2px] bg-gray-100 font-semibold flex items-center justify-center gap-1"
                >
                  <span className="truncate flex-1">{member.name}</span>
                  {/* Tombol delete hanya tampil di layar, tidak tercetak */}
                  <button
                    type="button"
                    onClick={() =>
                      setAuditTeam((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                    className="print:hidden ml-1 text-[7px] text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            {/* Kolom role, rata tengah */}
            <div className="space-y-1 w-48 text-center">
              {auditTeam.map((member, idx) => (
                <div
                  key={`${member.name}-${member.role}-role-${idx}`}
                  className="px-2 py-[2px] bg-gray-100 font-semibold"
                >
                  {member.role}
                </div>
              ))}
            </div>
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
                      setAuditTeam((prev) => [...prev, { name: trimmedName, role: newAuditRole }]);
                      setIsAuditTeamModalOpen(false);
                      setNewAuditName("");
                      setNewAuditRole("MEMBER");
                    }}
                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save
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
            <div className="grid grid-cols-[170px_190px_70px] gap-y-1">
              <div className="font-bold">
                DEPARTMENT <span>:</span>
              </div>
              <div />
              <div className="font-bold text-right">PAGE</div>

              {REPORT_DEPARTMENT_COMPLETION_ROWS
                .filter((row) =>
                  findingSections.some((section) => section.deptKey === row.deptKey),
                )
                // Urutkan berdasarkan first page (PAGE) dari Findings & Recommendations,
                // bukan berdasarkan nama atau bulan.
                .sort((a, b) => {
                  const ra = deptFindingPageRanges[a.deptKey];
                  const rb = deptFindingPageRanges[b.deptKey];
                  const pa = ra?.first ?? Number.POSITIVE_INFINITY;
                  const pb = rb?.first ?? Number.POSITIVE_INFINITY;
                  return pa - pb;
                })
                .map((row) => {
                // Tanggal completion mengikuti tahun audit (year) dan akhir bulan
                // audit period start per department (monthIndex).
                const month = row.monthIndex ?? 1;
                const lastDayDate = new Date(year, month, 0);
                const completionDate = lastDayDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });

                // PAGE mengikuti range halaman Findings & Recommendations untuk department tsb.
                const range = deptFindingPageRanges[row.deptKey];
                const pageRange =
                  range && range.first && range.last
                    ? `${range.first} - ${range.last}`
                    : "—";

                return (
                  <div key={row.deptKey} className="contents">
                    <div className="px-2 py-[2px] bg-gray-100">{row.name}</div>
                    <div className="px-2 py-[2px] bg-gray-100 font-semibold">
                      {completionDate}
                    </div>
                    <div className="px-2 py-[2px] bg-gray-100 text-right">
                      {pageRange}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spacer to dorong footer ke bawah */}
        <div className="flex-1" />

        {/* Date of issued */}
        <div className="mb-10">
          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold tracking-wide">
            <span>DATE OF ISSUED</span>
            <span>:</span>
            <span className="px-3 py-[2px] bg-gray-100 font-semibold">{issuedDate}</span>
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
              PAGE <span className="mx-1">2</span> of <span className="ml-1">40</span>
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

          {/* Prepared by */}
          <div className="mb-16 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold tracking-wide">PREPARED BY :</div>
              {/* Tombol tambah member - hanya tampil di layar, tidak tercetak */}
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

            <div className="space-y-4">
              {preparedBy.map((p, idx) => (
                <div key={`${p.name}-${p.role}-${idx}`} className="flex items-end gap-4">
                  <div className="px-3 py-1 bg-gray-100 font-semibold min-w-[180px]">
                    {p.name}
                  </div>
                  <div className="px-3 py-1 bg-gray-100 font-semibold min-w-[180px]">
                    {p.role}
                  </div>
                  <div className="flex-1 border-b border-gray-400" />
                  <div className="text-[10px] font-semibold mr-1 pb-[2px]">DATE</div>
                  <div className="px-3 py-1 bg-gray-100 min-w-[90px] text-[10px] font-semibold text-center">
                    {p.date || ""}
                  </div>
                  {/* Tombol delete hanya di layar */}
                  <button
                    type="button"
                    onClick={() =>
                      setPreparedBy((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="print:hidden ml-1 text-[9px] text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
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
                <div className="border-t border-gray-400 w-44 max-w-full" />
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
                <div className="border-t border-gray-400 w-44 max-w-full" />
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
              PAGE <span className="mx-1">3</span> of <span className="ml-1">40</span>
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
                findingSections.some((section) => section.deptKey === row.deptKey),
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
              PAGE <span className="mx-1">4</span> of <span className="ml-1">40</span>
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
                <div className="flex-1 text-right">PAGE 5 of 40</div>
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
                <div className="flex-1 text-right">PAGE 6 of 40</div>
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
                <div className="flex-1 text-right">PAGE 7 of 40</div>
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
                <div className="flex-1 text-right">PAGE 8 of 40</div>
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
                <div className="flex-1 text-right">PAGE 8 of 40</div>
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
                <div className="flex-1 text-right">PAGE 9 of 40</div>
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
            className={`executive-summary-content flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed pb-8 ${pageIdx > 0 ? "pt-2" : ""}`}
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
                PAGE <span className="mx-1">{executiveSummaryStartPage + pageIdx}</span> of <span className="ml-1">40</span>
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
                Save
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
            className={`executive-summary-content flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed ${pageIdx > 0 ? "pt-2" : ""}`}
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
                PAGE <span className="mx-1">{auditObjectivesStartPage + pageIdx}</span> of <span className="ml-1">40</span>
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
            className={`executive-summary-content flex-1 min-h-0 overflow-hidden text-[11px] leading-relaxed ${pageIdx > 0 ? "pt-2" : ""}`}
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
                PAGE <span className="mx-1">{auditApproachStartPage + pageIdx}</span> of <span className="ml-1">40</span>
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

            {page.isFirstPageForDept && page.dept.executiveSummary && (
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
              <div>
                {page.isFirstSopChunk && (
                  <p className="font-semibold mb-2">
                    Standard Operating Procedure Related (SOP Review)
                  </p>
                )}
                <div className="px-2 min-w-0 w-full overflow-hidden">
                  <table className="w-full border-collapse text-[9px] table-fixed" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-1.5 py-1 text-left">
                          No
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Standard Operating Procedure Related
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Review
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Auditee Comment
                        </th>
                        <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">
                          Follow-Up Detail
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.sopRows.map((row, rIdx) => (
                        <tr key={`sop-${page.dept.deptKey}-${idx}-${rIdx}`} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-1.5 py-0.5 text-center align-top">
                            {row.no}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            {row.sopRelated}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            {row.reviewComment || "-"}
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            <textarea
                              data-plain-autoresize
                              className="w-full bg-transparent border-none rounded-none px-0 py-0 text-[9px] leading-snug resize-none overflow-hidden focus:outline-none"
                              rows={1}
                              placeholder="Auditee comment"
                              defaultValue={row.auditeeComment || ""}
                              onInput={(e) => {
                                autoResizePlainTextarea(e.target);
                                enqueueRowFieldUpdate(
                                  "sop",
                                  page.dept.deptKey,
                                  row.sourceIndex ?? rIdx,
                                  "auditeeComment",
                                  e.target.value,
                                );
                              }}
                              onBlur={flushPendingFieldUpdates}
                            />
                          </td>
                          <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                            <textarea
                              data-plain-autoresize
                              className="w-full bg-transparent border-none rounded-none px-0 py-0 text-[9px] leading-snug resize-none overflow-hidden focus:outline-none"
                              rows={1}
                              placeholder="Follow-up detail"
                              defaultValue={row.followUpDetail || ""}
                              onInput={(e) => {
                                autoResizePlainTextarea(e.target);
                                enqueueRowFieldUpdate(
                                  "sop",
                                  page.dept.deptKey,
                                  row.sourceIndex ?? rIdx,
                                  "followUpDetail",
                                  e.target.value,
                                );
                              }}
                              onBlur={flushPendingFieldUpdates}
                            />
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
            {page.auditRows.length > 0 && (
              <div>
                {page.isFirstAuditChunk && (
                  <p className="font-semibold mb-1 text-[10px]">
                    Audit Review — Findings Detail
                  </p>
                )}
                <div className="px-2 min-w-0 w-full overflow-hidden">
                  <table className="w-full border-collapse text-[9px] leading-tight table-fixed" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "9.5%" }} />
                      <col style={{ width: "9.5%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block whitespace-nowrap">No</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block whitespace-nowrap">Risk ID</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Risk</span>
                          <span className="block">Details</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Risk</span>
                          <span className="block">Level</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Audit Program</span>
                          <span className="block">Code</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Substantive</span>
                          <span className="block">Test</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block whitespace-nowrap">Methodology</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Finding</span>
                          <span className="block">Result</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Finding</span>
                          <span className="block">Description</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block">Auditee</span>
                          <span className="block">Comment</span>
                        </th>
                        <th className="border border-blue-800 px-1 py-1.5 text-center align-middle min-w-0 leading-tight">
                          <span className="block whitespace-nowrap">Follow-Up</span>
                          <span className="block">Detail</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.auditRows.map((row, aIdx) => (
                        <tr
                          key={`audit-${page.dept.deptKey}-${idx}-${aIdx}`}
                          className={aIdx % 2 === 0 ? "bg-white" : "bg-blue-50"}
                        >
                          <td className="border border-blue-800 px-1.5 py-0.5 text-center align-top">
                            {row.no}
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden">{row.riskId || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.riskDetails || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top text-center min-w-0 overflow-hidden">{row.riskLevel ?? "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden">{row.apCode || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.substantiveTest || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.methodology || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.findingResult || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.findingDescription || "-"}</td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden whitespace-pre-wrap break-words">
                            <textarea
                              data-plain-autoresize
                              className="w-full bg-transparent border-none rounded-none px-0 py-0 text-[9px] leading-snug resize-none overflow-hidden focus:outline-none"
                              rows={1}
                              placeholder="Auditee comment"
                              defaultValue={row.auditeeComment || ""}
                              onInput={(e) => {
                                autoResizePlainTextarea(e.target);
                                enqueueRowFieldUpdate(
                                  "audit",
                                  page.dept.deptKey,
                                  row.sourceIndex ?? aIdx,
                                  "auditeeComment",
                                  e.target.value,
                                );
                              }}
                              onBlur={flushPendingFieldUpdates}
                            />
                          </td>
                          <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden whitespace-pre-wrap break-words">
                            <textarea
                              data-plain-autoresize
                              className="w-full bg-transparent border-none rounded-none px-0 py-0 text-[9px] leading-snug resize-none overflow-hidden focus:outline-none"
                              rows={1}
                              placeholder="Follow-up detail"
                              defaultValue={row.followUpDetail || ""}
                              onInput={(e) => {
                                autoResizePlainTextarea(e.target);
                                enqueueRowFieldUpdate(
                                  "audit",
                                  page.dept.deptKey,
                                  row.sourceIndex ?? aIdx,
                                  "followUpDetail",
                                  e.target.value,
                                );
                              }}
                              onBlur={flushPendingFieldUpdates}
                            />
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
                PAGE <span className="mx-1">{findingsPageStartNumber + idx}</span> of <span className="ml-1">40</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Satu blok per department: 5.x Department, 5.x.1 Finding : -, Select Finding — hanya untuk layar, tidak ikut print */}
      {findingSections.length > 0 && (
        <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page print:hidden">
          <div className="text-center mb-6 flex-shrink-0">
            <h1 className="text-2xl font-bold">Findings &amp; Recommendations</h1>
          </div>
          <div className="flex-1 text-[11px] leading-relaxed space-y-8">
            <p className="font-bold">5&nbsp;&nbsp;&nbsp;Finding &amp; Recommendation</p>
            {findingSections.map((section) => {
              const deptNum = deptIndexMap[section.deptKey] ?? 1;
              const selectedCount = (selectedFindingByDept[section.deptKey] ?? []).length;
              return (
                <div
                  key={section.deptKey}
                  className={`space-y-2 ${selectedCount === 0 ? "print:hidden" : ""}`}
                >
                  <p>5.{deptNum}&nbsp;&nbsp;Department&nbsp;&nbsp;<span className="font-semibold">{section.deptLabel}</span></p>
                  <p className="mt-2 flex items-center gap-2 flex-wrap">
                    <span>5.{deptNum}.1&nbsp;&nbsp;Finding :&nbsp;&nbsp;</span>
                    {selectedCount > 0 ? (
                      <span className="text-gray-600">{selectedCount} finding(s) dipilih</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFindingModalDeptKey(section.deptKey)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 print:hidden"
                    >
                      Select Finding
                    </button>
                  </p>
                  <p className="text-gray-500 text-sm print:hidden">Pilih finding dari Audit Review (tombol Select Finding di atas).</p>
                </div>
              );
            })}
          </div>
          <div className="w-full flex-shrink-0 mt-auto pt-4">
            <div className="border-t border-gray-300 mb-2" />
            <div className="flex items-center text-[9px] text-gray-700">
              <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
              <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
              <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + 1}</span> of <span className="ml-1">40</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pilih finding (checkbox, multi) — hanya finding dari audit review yang masuk report */}
      {findingModalDeptKey != null && (() => {
        const section = findingSections.find((s) => s.deptKey === findingModalDeptKey);
        const rows = section?.auditRows ?? [];
        const handleConfirm = () => {
          setSelectedFindingByDept((prev) => ({ ...prev, [findingModalDeptKey]: [...modalCheckedIndices].sort((a, b) => a - b) }));
          setFindingModalDeptKey(null);
        };
        const toggle = (idx) => {
          setModalCheckedIndices((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b));
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-bold">
                  Select Finding(s) — {section?.deptLabel ?? findingModalDeptKey}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Pilih satu atau lebih finding dari Audit Review. Satu finding = satu halaman detail.</p>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${modalCheckedIndices.includes(idx) ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={modalCheckedIndices.includes(idx)}
                        onChange={() => toggle(idx)}
                        className="mt-1"
                      />
                      <div className="text-sm flex-1 min-w-0">
                        <p><span className="font-semibold">Risk :</span> {(row.risk || "-").toString().slice(0, 80)}{(row.risk || "").length > 80 ? "…" : ""}</p>
                        <p><span className="font-semibold">Risk Description :</span> {(row.riskDetails || "-").toString().slice(0, 120)}{(row.riskDetails || "").length > 120 ? "…" : ""}</p>
                        <p><span className="font-semibold">Audit Program Code :</span> {row.apCode || "-"}</p>
                        <p><span className="font-semibold">Finding :</span> {(row.findingDescription || row.findingResult || "-").toString().slice(0, 80)}{((row.findingDescription || row.findingResult) || "").length > 80 ? "…" : ""}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFindingModalDeptKey(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + 1 + idx}</span> of <span className="ml-1">40</span></div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 6 Conclusion — hanya tampil jika ada data SOP/Audit. Add Conclusion → isi form → Save → system hitung (page 1 penuh dulu, sisanya next page). */}
      {findingSections.length > 0 && (
        <>
          {showConclusionForm ? (
            /* Form: title + input per department + Save */
            <div className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page">
              <div className="text-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold">Conclusion</h1>
              </div>
              <div className="mb-4">
                <p className="font-bold">6&nbsp;&nbsp;&nbsp;Conclusion</p>
              </div>
              <div className="flex-1 text-[11px] leading-relaxed space-y-6">
                {findingSections.map((section, i) => (
                  <div key={section.deptKey} className="space-y-2">
                    <p className="font-semibold">
                      6.{i + 1}&nbsp;&nbsp;Department&nbsp;&nbsp;{section.deptLabel}
                    </p>
                    <textarea
                      data-conclusion-textarea
                      className="w-full border border-gray-300 rounded p-3 text-[11px] min-h-[80px] resize-y overflow-y-auto bg-gray-50 placeholder:text-gray-400"
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
                  Save
                </button>
              </div>
              <div className="w-full flex-shrink-0 mt-auto pt-4">
                <div className="border-t border-gray-300 mb-2" />
                <div className="flex items-center text-[9px] text-gray-700">
                  <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                  <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                  <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + 1 + findingDetailPages.length + 1}</span> of <span className="ml-1">40</span></div>
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
                  className="flex-1 min-h-0 min-w-0 overflow-hidden text-[11px] leading-relaxed space-y-6"
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
                        <p className="font-semibold">
                          6.{segment.sectionNumber}&nbsp;&nbsp;Department&nbsp;&nbsp;{segment.deptLabel}
                        </p>
                        <div className="w-full border border-gray-300 rounded p-3 text-[11px] bg-gray-50 whitespace-pre-wrap break-words">
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
                    <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + 1 + findingDetailPages.length + pageIdx + 1}</span> of <span className="ml-1">40</span></div>
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
              <div className="mb-6">
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
                <p className="mt-4 text-sm text-gray-500 print:hidden">Klik untuk mengisi conclusion per department (yang ada data SOP/Audit Review).</p>
              </div>
              <div className="w-full flex-shrink-0 mt-auto pt-4">
                <div className="border-t border-gray-300 mb-2" />
                <div className="flex items-center text-[9px] text-gray-700">
                  <div className="flex-1 text-left">SUPPORT BY KIAS - PT KARYA PRIMA UNGGULAN AUDIT SYSTEM</div>
                  <div className="flex-1 text-center font-semibold">INTERNAL AUDIT REPORT</div>
                  <div className="flex-1 text-right">PAGE <span className="mx-1">{findingsPageStartNumber + findingPages.length + 1 + findingDetailPages.length + 1}</span> of <span className="ml-1">40</span></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hanya Conclusion: pengukuran hanya untuk department yang berisi data (untuk Save). */}
      {findingSections.length > 0 && (
        <div
          ref={conclusionMeasureRef}
          className="absolute left-[-9999px] top-0 w-[210mm] overflow-visible"
          style={{ visibility: "hidden", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className="px-16 text-[11px] leading-relaxed space-y-6">
            {findingSections.flatMap((section, i) =>
              splitConclusionTextIntoChunks(conclusionValues[section.deptKey] ?? "").map((text, chunkIndex) => (
                <div
                  key={`${section.deptKey}-measure-${chunkIndex}`}
                  data-conclusion-block
                  className="space-y-2"
                >
                  <p className="font-semibold">6.{i + 1}&nbsp;&nbsp;Department&nbsp;&nbsp;{section.deptLabel}</p>
                  <div className="w-full border border-gray-300 rounded p-3 text-[11px] min-h-0 bg-gray-50 whitespace-pre-wrap break-words">
                    {text}
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      )}

      {/* Pengukuran tinggi riil (seperti Word): isi halaman sampai penuh lalu next page. Tabel tersembunyi, sama lebar & style dengan report. */}
      {findingSections.length > 0 && (
        <div
          ref={measureContainerRef}
          className="absolute left-[-9999px] top-0 w-[210mm] overflow-visible"
          style={{ visibility: "hidden", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className="px-16 text-[11px]">
            {findingSections.map((section) => (
              <div key={section.deptKey}>
                {section.sopRows.length > 0 && (
                  <div className="mb-8">
                    <div className="px-2">
                      <table
                        data-measure-sop={section.deptKey}
                        className="w-full max-w-full border-collapse text-[9px] table-fixed"
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
                            <th className="border border-gray-300 px-1.5 py-1 text-left">No</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">SOP</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">Review</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">A</th>
                            <th className="border border-gray-300 px-1.5 py-1 text-left min-w-0">B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.sopRows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="border border-gray-300 px-1.5 py-0.5 text-center align-top">{row.no}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words">{row.sopRelated}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top">{row.reviewComment || "-"}</td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                                <div className="min-h-[14px] leading-snug whitespace-pre-wrap break-words">
                                  {row.auditeeComment || "-"}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">
                                <div className="min-h-[14px] leading-snug whitespace-pre-wrap break-words">
                                  {row.followUpDetail || "-"}
                                </div>
                              </td>
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
                      className="w-full max-w-full border-collapse text-[9px] leading-tight table-fixed"
                      style={{ tableLayout: "fixed" }}
                    >
                      <colgroup>
                        <col style={{ width: "4%" }} />
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "11%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "9.5%" }} />
                        <col style={{ width: "9.5%" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">No</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">RID</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Risk</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">L</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Code</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Test</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Method</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Result</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">Desc</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">A</th>
                          <th className="border border-blue-800 px-1.5 py-0.5 min-w-0">B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.auditRows.map((row, aIdx) => (
                          <tr key={aIdx} className={aIdx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                            <td className="border border-blue-800 px-1.5 py-0.5 text-center align-top">{row.no}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden">{row.riskId || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.riskDetails || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top text-center min-w-0 overflow-hidden">{row.riskLevel ?? "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden">{row.apCode || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.substantiveTest || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.methodology || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.findingResult || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top whitespace-pre-wrap break-words min-w-0 overflow-hidden">{row.findingDescription || "-"}</td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden whitespace-pre-wrap break-words">
                              <div className="min-h-[14px] leading-snug whitespace-pre-wrap break-words">
                                {row.auditeeComment || "-"}
                              </div>
                            </td>
                            <td className="border border-blue-800 px-1.5 py-0.5 align-top min-w-0 overflow-hidden whitespace-pre-wrap break-words">
                              <div className="min-h-[14px] leading-snug whitespace-pre-wrap break-words">
                                {row.followUpDetail || "-"}
                              </div>
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

          <div className="flex-1 text-[11px] leading-relaxed space-y-8">
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
                        className="border border-gray-300 rounded px-2 py-1 text-[11px] w-full max-w-[420px] print:border-none print:p-0 print:bg-transparent"
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
                      <div className="font-semibold">{appendix.content || "Risk Matrix"}</div>
                      <button
                        type="button"
                        onClick={() => addAppendixTableRow(appendix.id)}
                        className="print:hidden px-3 py-1 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700"
                      >
                        Add Row
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse table-fixed text-[10px]">
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
                            <th className="border border-black px-2 py-1 text-center font-semibold">Department</th>
                            <th className="border border-black px-2 py-1 text-center font-semibold">AP No</th>
                            <th className="border border-black px-2 py-1 text-center font-semibold">Risk Factor</th>
                            <th className="border border-black px-2 py-1 text-center font-semibold">Risk Indicator</th>
                            <th className="border border-black px-2 py-1 text-center font-semibold">Risk Level</th>
                            <th className="border border-black px-2 py-1 text-center font-semibold print:hidden">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(appendix.tableRows || []).map((row, rowIdx) => (
                            <tr key={`${appendix.id}-row-${rowIdx}`} className="bg-white">
                              <td className="border border-black p-0 align-top h-8">
                                <input
                                  type="text"
                                  value={row.department || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "department", e.target.value)}
                                  className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                />
                              </td>
                              <td className="border border-black p-0 align-top h-8">
                                <input
                                  type="text"
                                  value={row.apNo || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "apNo", e.target.value)}
                                  className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                />
                              </td>
                              <td className="border border-black p-0 align-top h-8">
                                <input
                                  type="text"
                                  value={row.riskFactor || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "riskFactor", e.target.value)}
                                  className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                />
                              </td>
                              <td className="border border-black p-0 align-top h-8">
                                <input
                                  type="text"
                                  value={row.riskIndicator || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "riskIndicator", e.target.value)}
                                  className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
                                />
                              </td>
                              <td className="border border-black p-0 align-top h-8">
                                <input
                                  type="text"
                                  value={row.riskLevel || ""}
                                  onChange={(e) => updateAppendixTableCell(appendix.id, rowIdx, "riskLevel", e.target.value)}
                                  className="w-full h-full min-h-8 px-2 py-1 bg-transparent border-none focus:outline-none"
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
                    className="w-full border border-gray-300 rounded p-3 text-[11px] min-h-[140px] resize-y bg-gray-50"
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
              <div className="flex-1 text-right">PAGE <span className="mx-1">{appendixPageBase}</span> of <span className="ml-1">40</span></div>
            </div>
          </div>
        </div>
      ) : (
        appendixPages.map((page, pageIdx) => (
          <div
            key={`appendix-page-${pageIdx}`}
            className="mx-auto bg-white shadow-md print:shadow-none w-[210mm] h-[297mm] overflow-hidden flex flex-col px-16 pt-20 pb-16 break-after-page"
          >
            <div className="flex-1 min-h-0 text-[11px] leading-relaxed space-y-6 overflow-hidden">
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
                      <div className="font-semibold">{segment.subtitle}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse table-fixed text-[10px]">
                          <colgroup>
                            <col className="w-[13%]" />
                            <col className="w-[12%]" />
                            <col className="w-[50%]" />
                            <col className="w-[13%]" />
                            <col className="w-[12%]" />
                          </colgroup>
                          <thead>
                            <tr className="bg-[#8f8f8f] text-white">
                              <th className="border border-black px-2 py-1 text-center font-semibold">Department</th>
                              <th className="border border-black px-2 py-1 text-center font-semibold">AP No</th>
                              <th className="border border-black px-2 py-1 text-center font-semibold">Risk Factor</th>
                              <th className="border border-black px-2 py-1 text-center font-semibold">Risk Indicator</th>
                              <th className="border border-black px-2 py-1 text-center font-semibold">Risk Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(segment.rows || []).map((row, rowIdx) => (
                              <tr key={`${segment.appendixId}-view-${pageIdx}-${rowIdx}`} className="bg-white">
                                <td className="border border-black px-2 py-1 align-top h-8">{row.department || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.apNo || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.riskFactor || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.riskIndicator || ""}</td>
                                <td className="border border-black px-2 py-1 align-top h-8">{row.riskLevel || ""}</td>
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
                <div className="flex-1 text-right">PAGE <span className="mx-1">{appendixPageBase + pageIdx}</span> of <span className="ml-1">40</span></div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Tombol print (tidak ikut tercetak) */}
      <div className="mt-4 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg hover:from-[#141D38]/90 hover:to-[#2D3A5A]/90 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
        >
          Print / Save as PDF
        </button>
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


