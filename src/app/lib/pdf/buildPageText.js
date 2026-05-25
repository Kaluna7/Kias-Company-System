/**
 * Build page text from pdf.js text items (shared client + server).
 * @param {Array<{ str?: string, transform?: number[], hasEOL?: boolean }>} items
 */
export function buildPageTextFromPdfItems(items) {
  if (!items?.length) return "";

  const linesMap = new Map();

  for (const it of items) {
    const str = it.str ?? "";
    if (!str && !it.hasEOL) continue;

    const tr = it.transform || it.transformMatrix || [];
    const x = tr[4] ?? 0;
    const y = tr[5] ?? 0;
    const yKey = Math.round(y * 100) / 100;

    if (!linesMap.has(yKey)) linesMap.set(yKey, []);
    linesMap.get(yKey).push({
      str,
      x,
      hasEOL: Boolean(it.hasEOL),
    });
  }

  const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
  const lines = [];

  for (const yKey of sortedYs) {
    const row = linesMap.get(yKey) || [];
    row.sort((a, b) => (a.x || 0) - (b.x || 0));

    let line = "";
    for (let i = 0; i < row.length; i++) {
      const part = row[i];
      line += part.str;
      if (part.hasEOL) {
        line += "\n";
      } else if (i < row.length - 1) {
        const next = row[i + 1];
        const gap = (next.x || 0) - ((part.x || 0) + (part.str?.length || 0) * 4);
        line += gap > 8 ? "  " : " ";
      }
    }

    line = line.replace(/\s+\n/g, "\n").replace(/\n+/g, "\n").trimEnd();
    if (line.trim()) lines.push(line);
  }

  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    if (!cur) continue;
    if (/[-–—]$/.test(cur) && i + 1 < lines.length) {
      lines[i + 1] = (cur.replace(/[-–—]$/, "") + " " + lines[i + 1]).replace(/\s+/g, " ").trim();
    } else if (
      i + 1 < lines.length &&
      /^\d{1,2}(?:\.\d+)*\s+\S/.test(lines[i + 1]) &&
      !/^\d{1,2}(?:\.\d+)*\s+\S/.test(cur)
    ) {
      merged.push(cur);
    } else if (
      i + 1 < lines.length &&
      /^[a-z0-9(,]/i.test(lines[i + 1]) &&
      /[a-z0-9)]$/i.test(cur) &&
      !/[.!?:;]$/.test(cur) &&
      !/^\d{1,2}(?:\.\d+)*\s/.test(lines[i + 1])
    ) {
      lines[i + 1] = (cur + " " + lines[i + 1]).replace(/\s+/g, " ").trim();
    } else {
      merged.push(cur);
    }
  }

  return merged.join("\n");
}

/**
 * Tabel multi-kolom: ambil kolom paling kanan (biasanya alur/langkah prosedur).
 * @param {Array<{ str?: string, transform?: number[] }>} items
 */
export function buildRightmostColumnText(items) {
  if (!items?.length) return "";

  const linesMap = new Map();
  for (const it of items) {
    const str = it.str ?? "";
    if (!str) continue;
    const tr = it.transform || it.transformMatrix || [];
    const x = tr[4] ?? 0;
    const yKey = Math.round((tr[5] ?? 0) * 100) / 100;
    if (!linesMap.has(yKey)) linesMap.set(yKey, []);
    linesMap.get(yKey).push({ str, x });
  }

  const rows = [];
  for (const [yKey, parts] of linesMap) {
    parts.sort((a, b) => (a.x || 0) - (b.x || 0));
    if (!parts.length) continue;

    const minX = parts[0].x;
    const maxX = parts[parts.length - 1].x;
    const span = maxX - minX;

    let lineParts = parts;
    if (span > 80 && parts.length >= 2) {
      const cutoff = minX + span * 0.38;
      const right = parts.filter((p) => p.x >= cutoff);
      if (right.length > 0) lineParts = right;
    }

    const line = lineParts
      .map((p) => p.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) rows.push({ y: yKey, line });
  }

  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => r.line).join("\n");
}

/**
 * Full page text + kolom alur jika terdeteksi tabel prosedur.
 */
function looksLikeProcedureTable(fullText, columnText) {
  if (!columnText || columnText.length < 25) return false;
  const hasHeaders =
    /\b(?:NO\.?\s*PROSEDUR|PROSEDUR\s+KERJA|ALUR\s+(?:KERJA|PROSEDUR))\b/i.test(
      fullText
    ) || /\b(?:NO|PROSEDUR|ALUR)\b/i.test(fullText);
  const hasNumberedRows = /(?:^|\n)\s*\d{1,3}\s+\S/m.test(columnText);
  const differs =
    columnText.length < fullText.length * 0.92 && columnText.length > fullText.length * 0.12;
  return hasNumberedRows && (hasHeaders || differs);
}

export function buildPageTextsFromPdfItems(items) {
  const full = buildPageTextFromPdfItems(items);
  const column = buildRightmostColumnText(items);
  const useColumn = looksLikeProcedureTable(full, column);
  const parserText = useColumn ? column : full;
  return { full, column, parserText };
}

/** @deprecated gunakan buildRightmostColumnText */
export const buildAlurKerjaColumnText = buildRightmostColumnText;

export const PAGE_SEPARATOR = "\n\n---PAGE---\n\n";
