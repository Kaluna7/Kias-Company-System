import { parse } from "node-html-parser";
import { Paragraph, TextRun, AlignmentType } from "docx";
import { BODY_SIZE, FONT, SMALL_SIZE } from "./templateStyles";

function decodeEntities(text, { collapseWhitespace = true } = {}) {
  let s = String(text ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  if (collapseWhitespace) {
    s = s.replace(/\s+/g, " ").trim();
  }
  return s;
}

function collectRuns(node, inherited = {}) {
  if (!node) return [];

  if (node.nodeType === 3) {
    const text = decodeEntities(node.rawText ?? "");
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: inherited.bold,
        italics: inherited.italics,
        underline: inherited.underline ? {} : undefined,
        size: inherited.size ?? BODY_SIZE,
        font: FONT,
      }),
    ];
  }

  if (node.nodeType !== 1) return [];

  const tag = node.tagName?.toLowerCase?.() || "";
  const next = {
    bold:
      inherited.bold ||
      tag === "strong" ||
      tag === "b" ||
      /^h[1-6]$/.test(tag),
    italics: inherited.italics || tag === "em" || tag === "i",
    underline: inherited.underline || tag === "u",
    size: /^h[1-3]$/.test(tag) ? BODY_SIZE + 4 : inherited.size,
  };

  if (tag === "br") {
    return [new TextRun({ break: 1 })];
  }

  return node.childNodes.flatMap((child) => collectRuns(child, next));
}

function paragraphFromRuns(runs, options = {}) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { after: options.after ?? 100, before: options.before ?? 0 },
    indent: options.indent,
    children: runs.length > 0 ? runs : [new TextRun({ text: "", font: FONT, size: BODY_SIZE })],
  });
}

function paragraphFromElement(el, options = {}) {
  const tag = el.tagName?.toLowerCase?.() || "";
  const runs = collectRuns(el);
  const bodyAlign = options.bodyAlignment;

  if (tag === "li") {
    const parentTag = el.parentNode?.tagName?.toLowerCase?.() || "";
    const bullet = parentTag === "ol" ? "" : "• ";
    return paragraphFromRuns(
      [new TextRun({ text: bullet, font: FONT, size: BODY_SIZE, bold: true }), ...runs],
      { after: 80, indent: { left: 360, hanging: 180 }, alignment: bodyAlign },
    );
  }

  if (/^h[1-6]$/.test(tag)) {
    return paragraphFromRuns(runs, { after: 140, before: 80 });
  }

  return paragraphFromRuns(runs, {
    after: tag === "p" ? 100 : 80,
    alignment: bodyAlign,
    ...options,
  });
}

function walkNode(node, out, options = {}) {
  if (!node) return;

  const bodyAlign = options.bodyAlignment;

  if (node.nodeType === 3) {
    const text = decodeEntities(node.rawText ?? "");
    if (text) {
      out.push(
        new Paragraph({
          alignment: bodyAlign,
          spacing: { after: 100 },
          children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
        }),
      );
    }
    return;
  }

  if (node.nodeType !== 1) return;

  const tag = node.tagName?.toLowerCase?.() || "";

  if (tag === "span" || tag === "a" || tag === "strong" || tag === "b" || tag === "em" || tag === "i") {
    node.childNodes.forEach((child) => walkNode(child, out, options));
    return;
  }

  if (tag === "ul" || tag === "ol") {
    node.querySelectorAll(":scope > li").forEach((li) => out.push(paragraphFromElement(li, options)));
    return;
  }

  if (tag === "table") {
    node.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("th, td").map((c) => decodeEntities(c.text));
      if (cells.some(Boolean)) {
        out.push(
          new Paragraph({
            alignment: bodyAlign,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: cells.filter(Boolean).join(" | "),
                font: FONT,
                size: SMALL_SIZE,
              }),
            ],
          }),
        );
      }
    });
    return;
  }

  if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "blockquote") {
    out.push(paragraphFromElement(node, options));
    return;
  }

  if (tag === "div") {
    const blockChildTags = new Set([
      "p",
      "div",
      "ul",
      "ol",
      "table",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
    ]);
    const hasBlockChild = node.childNodes.some(
      (c) => c.nodeType === 1 && blockChildTags.has(c.tagName?.toLowerCase?.() || ""),
    );
    if (hasBlockChild) {
      node.childNodes.forEach((child) => walkNode(child, out, options));
      return;
    }
    const plain = decodeEntities(node.text);
    if (plain) {
      out.push(paragraphFromElement(node, options));
    }
    return;
  }

  node.childNodes.forEach((child) => walkNode(child, out, options));
}

/**
 * Convert report rich-text HTML into docx Paragraph nodes (11pt body).
 */
export function htmlToDocxParagraphs(html, options = {}) {
  const bodyAlignment = options.bodyAlignment ?? options.alignment;
  const walkOpts = bodyAlignment ? { bodyAlignment } : {};

  const normalized = String(html || "").trim();
  if (!normalized) {
    return [
      new Paragraph({
        alignment: bodyAlignment,
        children: [new TextRun({ text: "", font: FONT, size: BODY_SIZE })],
      }),
    ];
  }

  const root = parse(`<div>${normalized}</div>`);
  const container = root.querySelector("div");
  if (!container) {
    return [
      new Paragraph({
        alignment: bodyAlignment,
        children: [new TextRun({ text: normalized, font: FONT, size: BODY_SIZE })],
      }),
    ];
  }

  const paragraphs = [];
  container.childNodes.forEach((node) => walkNode(node, paragraphs, walkOpts));

  return paragraphs.length > 0
    ? paragraphs
    : [
        new Paragraph({
          alignment: bodyAlignment,
          children: [
            new TextRun({
              text: decodeEntities(container.text) || "",
              font: FONT,
              size: BODY_SIZE,
            }),
          ],
        }),
      ];
}
