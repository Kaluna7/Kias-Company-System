import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Resolve LibreOffice/soffice binary (Windows-friendly).
 * Set LIBREOFFICE_PATH in .env if not on PATH.
 */
export function resolveLibreOfficePath() {
  if (process.env.LIBREOFFICE_PATH) {
    return process.env.LIBREOFFICE_PATH;
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return "soffice";
}

/**
 * Convert .docx to .pdf using LibreOffice headless.
 * @param {string} docxPath absolute path to input .docx
 * @param {string} outDir absolute directory for output
 * @returns {Promise<string>} absolute path to generated .pdf
 */
export async function convertDocxToPdf(docxPath, outDir) {
  const soffice = resolveLibreOfficePath();
  await fs.promises.mkdir(outDir, { recursive: true });

  try {
    await execFileAsync(
      soffice,
      ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", outDir, docxPath],
      { timeout: 180000, windowsHide: true },
    );
  } catch (err) {
    const hint =
      process.platform === "win32"
        ? " Install LibreOffice and set LIBREOFFICE_PATH to soffice.exe, e.g. C:\\Program Files\\LibreOffice\\program\\soffice.exe"
        : " Install LibreOffice (soffice) and ensure it is on PATH.";
    throw new Error(`LibreOffice conversion failed.${hint} ${err?.message || err}`);
  }

  const pdfName = `${path.basename(docxPath, path.extname(docxPath))}.pdf`;
  const pdfPath = path.join(outDir, pdfName);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not created at ${pdfPath}. Check LibreOffice installation.`);
  }
  return pdfPath;
}
