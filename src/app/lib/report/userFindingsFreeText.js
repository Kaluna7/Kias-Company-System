import { parse } from "node-html-parser";

/**
 * Ambil teks bebas user dari section Findings (bukan tabel system).
 * Tabel SOP/Audit di-regenerate dari modul; paragraf seperti "TEST" dipertahankan.
 */
export function extractUserFreeTextFromFindingsHtml(findingsHtml) {
  const raw = String(findingsHtml ?? "").trim();
  if (!raw) return "";

  try {
    const root = parse(`<div id="root">${raw}</div>`);
    const container = root.querySelector("#root");
    if (!container) return "";

    container.querySelectorAll("table").forEach((t) => t.remove());

    const stripPatterns = [
      /^findings?\s*&?\s*recommendations?$/i,
      /^5\s+finding/i,
      /^5\.\d+\s+department/i,
      /^executive\s+summary$/i,
      /^standard\s+operating\s+procedure/i,
      /^audit\s+review/i,
    ];

    const parts = [];
    for (const child of container.childNodes) {
      if (child.nodeType !== 1) continue;
      const text = String(child.text ?? child.innerText ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      if (stripPatterns.some((re) => re.test(text))) continue;
      parts.push(child.toString());
    }

    const inner = parts.join("\n").trim();
    if (!inner) return "";
    return `<div class="user-findings-free-text">${inner}</div>`;
  } catch {
    return "";
  }
}
