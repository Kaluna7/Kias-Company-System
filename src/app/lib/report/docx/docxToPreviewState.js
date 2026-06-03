import { parse } from "node-html-parser";
import { REPORT_DEPT_KEYS, DEPT_KEY_TO_API_PATH } from "@/app/lib/audit-review/auditDeptKeys";

/** Report preview department labels (same as preview page). */
const DEPT_LABEL_BY_KEY = {
  finance: "FINANCE",
  accounting: "ACCOUNTING",
  hrd: "HRD",
  ga: "GENERAL & AFFAIR",
  sdp: "STORE DESIGN & PLANNER",
  tax: "TAX",
  lp: "SECURITY",
  mis: "MANAGEMENT INFORMATION SYS.",
  merch: "MERCHANDISE",
  ops: "OPERATIONAL",
  whs: "WAREHOUSE",
};

const SECTION_MARKERS = [
  {
    id: "executiveSummary",
    patterns: [/^executive\s+summary$/i],
  },
  {
    id: "auditObjectives",
    patterns: [/^audit\s+objectives\s+and\s+scope$/i, /^objective\s*&\s*scope$/i],
  },
  {
    id: "auditApproach",
    patterns: [/^audit\s+approach\s+and\s+methodology$/i],
  },
  {
    id: "findings",
    patterns: [/^findings\s*&\s*recommendations$/i],
  },
  {
    id: "conclusion",
    patterns: [/^conclusion$/i, /^6\s+conclusion$/i],
  },
  {
    id: "appendices",
    patterns: [/^appendices$/i],
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesSection(text, patterns) {
  const norm = normalizeText(text);
  return patterns.some((re) => re.test(norm));
}

function blockPlainText(el) {
  if (!el || el.nodeType !== 1) return "";
  return String(el.text ?? el.innerText ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectBlocks(html) {
  const root = parse(`<div id="doc-root">${html}</div>`);
  const container = root.querySelector("#doc-root");
  if (!container) return [];

  const blocks = [];
  for (const child of container.childNodes) {
    if (child.nodeType !== 1) continue;
    const text = blockPlainText(child);
    blocks.push({
      text,
      html: child.toString(),
      norm: normalizeText(text),
    });
  }
  return blocks;
}

function findSectionStarts(blocks) {
  const starts = {};
  let lastId = null;

  for (let i = 0; i < blocks.length; i++) {
    const { text } = blocks[i];
    if (!text) continue;

    for (const marker of SECTION_MARKERS) {
      if (starts[marker.id] != null) continue;
      if (!matchesSection(text, marker.patterns)) continue;

      if (marker.id === "findings" && lastId === "findings") continue;
      if (marker.id === "conclusion" && starts.conclusion != null) continue;

      starts[marker.id] = i;
      lastId = marker.id;
      break;
    }
  }

  return starts;
}

function sliceSectionHtml(blocks, startIdx, endIdx) {
  const parts = [];
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (blocks[i]?.html) parts.push(blocks[i].html);
  }
  const inner = parts.join("\n").trim();
  return inner ? `<div class="onlyoffice-sync">${inner}</div>` : "";
}

function extractSectionsFromHtml(html) {
  const blocks = collectBlocks(html);
  if (!blocks.length) return {};

  const starts = findSectionStarts(blocks);
  const order = ["executiveSummary", "auditObjectives", "auditApproach", "findings", "conclusion", "appendices"];
  const indices = order
    .filter((id) => starts[id] != null)
    .map((id) => ({ id, index: starts[id] }))
    .sort((a, b) => a.index - b.index);

  const out = {};
  for (let i = 0; i < indices.length; i++) {
    const { id, index } = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1].index : blocks.length;
    out[id] = sliceSectionHtml(blocks, index, end);
  }
  return out;
}

function normDeptLabel(label) {
  return normalizeText(label).replace(/&/g, "and");
}

function resolveDeptKeyFromLabel(label, hintSections = []) {
  const norm = normDeptLabel(label);
  if (!norm) return null;

  for (const section of hintSections) {
    if (normDeptLabel(section.deptLabel) === norm) return section.deptKey;
  }

  for (const [deptKey, deptLabel] of Object.entries(DEPT_LABEL_BY_KEY)) {
    if (normDeptLabel(deptLabel) === norm) return deptKey;
    if (norm.includes(normDeptLabel(deptLabel)) || normDeptLabel(deptLabel).includes(norm)) {
      return deptKey;
    }
  }

  for (const deptKey of REPORT_DEPT_KEYS) {
    if (norm === deptKey || norm.includes(deptKey)) return deptKey;
    const api = DEPT_KEY_TO_API_PATH[deptKey];
    if (api && norm.includes(normDeptLabel(api))) return deptKey;
  }

  return null;
}

/** Parse `6.1   Department   FINANCE` blocks from conclusion HTML. */
function extractConclusionValues(conclusionHtml, hintSections = []) {
  if (!conclusionHtml?.trim()) return {};

  const blocks = collectBlocks(conclusionHtml);
  const values = {};
  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (!currentKey) return;
    const text = buffer
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) values[currentKey] = text;
    buffer = [];
  };

  for (const block of blocks) {
    const match = block.text.match(/^6\.(\d+)\s+department\s+(.+)$/i);
    if (match) {
      flush();
      const deptKey = resolveDeptKeyFromLabel(match[2].trim(), hintSections);
      if (deptKey) {
        currentKey = deptKey;
        continue;
      }
      currentKey = null;
      continue;
    }

    if (currentKey && block.text && !/^6\s+conclusion$/i.test(block.text)) {
      buffer.push(block);
    }
  }
  flush();
  return values;
}

/**
 * Convert saved OnlyOffice DOCX into HTML preview fields.
 * @param {Buffer} docxBuffer
 * @param {{ findingSections?: object[], conclusionValues?: object }} hints
 */
export async function extractPreviewStateFromDocx(docxBuffer, hints = {}) {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml(
    { buffer: docxBuffer },
    {
      includeDefaultStyleMap: true,
    },
  );

  if (!html?.trim()) {
    return { ok: false, reason: "empty-html" };
  }

  const sections = extractSectionsFromHtml(html);
  const hintSections = hints.findingSections || [];

  const conclusionFromWord = extractConclusionValues(sections.conclusion, hintSections);
  const conclusionValues = { ...(hints.conclusionValues || {}), ...conclusionFromWord };

  return {
    ok: true,
    executiveSummaryHtml: sections.executiveSummary || "",
    auditObjectivesScopeHtml: sections.auditObjectives || "",
    auditApproachMethodologyHtml: sections.auditApproach || "",
    conclusionValues,
    wordFindingsHtml: sections.findings || "",
    wordAppendicesHtml: sections.appendices || "",
  };
}
