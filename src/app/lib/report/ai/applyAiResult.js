import { REPORT_AI_DEPARTMENTS } from "./reportDepartments";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain AI text → simple HTML for preview rich-text fields. */
export function plainTextToPreviewHtml(text) {
  const blocks = String(text || "")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean);
  if (blocks.length === 0) return "";
  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Try to split conclusion AI output into per-department text. */
export function parseConclusionAiText(text) {
  const result = {};
  const lines = String(text || "").split("\n");
  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (!currentKey) return;
    const joined = buffer.join("\n").trim();
    if (joined) result[currentKey] = joined;
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentKey) buffer.push("");
      continue;
    }

    const matched = REPORT_AI_DEPARTMENTS.find((dept) => {
      const label = dept.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return (
        new RegExp(`^\\d+(?:\\.\\d+)?\\s*${label}\\b`, "i").test(trimmed) ||
        new RegExp(`^${label}\\s*[:\\-–]`, "i").test(trimmed)
      );
    });

    if (matched) {
      flush();
      currentKey = matched.key;
      const stripped = trimmed
        .replace(/^\d+(?:\.\d+)?\s*[^:]+:\s*/i, "")
        .replace(new RegExp(`^${matched.label}\\s*[:\\-–]\\s*`, "i"), "")
        .trim();
      buffer = stripped ? [stripped] : [];
      continue;
    }

    if (currentKey) buffer.push(line);
  }

  flush();
  return result;
}

/**
 * Map AI task output to preview state patches.
 * @param {string} taskId
 * @param {string} text
 * @param {{ conclusionDeptKeys?: string[] }} [options]
 */
export function buildPreviewPatchFromAiResult(taskId, text, options = {}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return {};

  if (taskId === "conclusion") {
    const parsed = parseConclusionAiText(trimmed);
    if (Object.keys(parsed).length > 0) {
      return { conclusionValues: parsed };
    }
    const keys = Array.isArray(options.conclusionDeptKeys) ? options.conclusionDeptKeys : [];
    if (keys.length === 0) return { conclusionValues: { _general: trimmed } };
    const fallback = {};
    for (const key of keys) fallback[key] = trimmed;
    return { conclusionValues: fallback };
  }

  if (
    taskId === "executive_summary" ||
    taskId === "findings_narrative" ||
    taskId === "custom"
  ) {
    return { executiveSummaryHtml: plainTextToPreviewHtml(trimmed) };
  }

  return {};
}
