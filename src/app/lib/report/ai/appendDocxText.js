import PizZip from "pizzip";

function escapeXmlText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphXml(text) {
  const escaped = escapeXmlText(text);
  return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

/**
 * Append plain-text paragraphs at end of document body (before sectPr).
 * @param {Buffer} docxBuffer
 * @param {string} text
 */
export function appendPlainTextToDocx(docxBuffer, text) {
  const zip = new PizZip(docxBuffer);
  const docPath = "word/document.xml";
  const file = zip.file(docPath);
  if (!file) {
    throw new Error("Invalid DOCX: missing word/document.xml");
  }

  let xml = file.asText();
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("No text to insert");
  }

  const block = lines.map((line) => paragraphXml(line)).join("");
  const sectIdx = xml.indexOf("<w:sectPr");
  if (sectIdx !== -1) {
    xml = xml.slice(0, sectIdx) + block + xml.slice(sectIdx);
  } else {
    xml = xml.replace("</w:body>", `${block}</w:body>`);
  }

  zip.file(docPath, xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
