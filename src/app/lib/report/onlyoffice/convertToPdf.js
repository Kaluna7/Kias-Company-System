import { getOnlyOfficeInternalUrl } from "./jwt";
import { buildDocumentFileUrl } from "./buildEditorConfig";

/**
 * Convert DOCX → PDF via OnlyOffice Document Server ConvertService.
 * @returns {Promise<Buffer>}
 */
export async function convertDocxToPdfViaOnlyOffice(sessionId) {
  const base = getOnlyOfficeInternalUrl();
  if (!base) {
    throw new Error("ONLYOFFICE_URL is not configured");
  }

  const fileUrl = buildDocumentFileUrl(sessionId);
  const body = {
    async: false,
    filetype: "docx",
    outputtype: "pdf",
    title: `report-${sessionId}.docx`,
    url: fileUrl,
  };

  const res = await fetch(`${base}/ConvertService.ashx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OnlyOffice conversion failed: ${text.slice(0, 200)}`);
  }

  if (data.error) {
    throw new Error(`OnlyOffice conversion error ${data.error}: ${data.message || ""}`);
  }

  const resultUrl = data.fileUrl || data.url;
  if (!resultUrl) {
    throw new Error("OnlyOffice conversion returned no file URL");
  }

  const pdfRes = await fetch(resultUrl);
  if (!pdfRes.ok) {
    throw new Error(`Failed to download converted PDF (${pdfRes.status})`);
  }

  const arrayBuffer = await pdfRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
