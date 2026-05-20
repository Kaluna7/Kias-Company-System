import * as XLSX from "xlsx-js-style";

const headerFill = {
  fill: { patternType: "solid", fgColor: { rgb: "141D38" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const labelFill = {
  fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
  font: { bold: true, sz: 10 },
  alignment: { vertical: "center", wrapText: true },
};

function styleCell(ws, r, c, style) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) return;
  ws[addr].s = { ...(ws[addr].s || {}), ...style };
}

function columnWidthFromAoA(aoa, colIndex) {
  let maxLen = 12;
  for (const row of aoa) {
    const val = row?.[colIndex];
    if (val == null) continue;
    const len = String(val).length;
    if (len > maxLen) maxLen = len;
  }
  return Math.min(Math.max(maxLen + 3, 14), 55);
}

/**
 * Export sampling result to .xlsx — parameters on top, sample numbers listed vertically.
 */
export function exportSamplingToExcel({ conf, total, samplingRate, sampleSize, picked }) {
  if (!picked?.length) {
    if (typeof window !== "undefined" && window.__showToast) {
      window.__showToast("Nothing to export. Generate a sampling first.", "error");
    }
    return;
  }

  const ratePct = (samplingRate * 100).toFixed(1).replace(/\.0$/, "");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const fileName = `sampling-${stamp}.xlsx`;

  const aoa = [
    ["KIAS — SAMPLING"],
    [],
    ["Parameter", "Nilai"],
    ["Confidence level (%)", conf],
    ["Total data (populasi)", total],
    ["Sampling rate (100% - confidence)", `${ratePct}%`],
    ["Jumlah sampel", sampleSize],
    [],
    ["Baris", "Nomor sampel"],
  ];

  picked.forEach((n, idx) => {
    aoa.push([`Row ${idx + 1}`, n]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastCol = 1;
  const paramHeaderRow = 2;
  const dataHeaderRow = 8;
  const lastRow = aoa.length - 1;

  ws["!cols"] = [
    { wch: columnWidthFromAoA(aoa, 0) },
    { wch: columnWidthFromAoA(aoa, 1) },
  ];

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];

  ws["!rows"] = [];
  for (let r = 0; r <= lastRow; r++) {
    if (r === 0) ws["!rows"][r] = { hpt: 32 };
    else if (r === paramHeaderRow || r === dataHeaderRow) ws["!rows"][r] = { hpt: 24 };
    else if (r >= paramHeaderRow + 1 && r <= paramHeaderRow + 4) ws["!rows"][r] = { hpt: 20 };
    else ws["!rows"][r] = { hpt: 18 };
  }

  styleCell(ws, 0, 0, {
    font: { bold: true, sz: 14, color: { rgb: "141D38" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });

  styleCell(ws, paramHeaderRow, 0, headerFill);
  styleCell(ws, paramHeaderRow, 1, headerFill);
  for (let r = paramHeaderRow + 1; r <= paramHeaderRow + 4; r++) {
    styleCell(ws, r, 0, labelFill);
    styleCell(ws, r, 1, {
      alignment: { vertical: "center", horizontal: "left", wrapText: true },
    });
  }

  styleCell(ws, dataHeaderRow, 0, headerFill);
  styleCell(ws, dataHeaderRow, 1, headerFill);

  for (let r = dataHeaderRow + 1; r <= lastRow; r++) {
    styleCell(ws, r, 0, {
      alignment: { vertical: "center", horizontal: "left" },
    });
    styleCell(ws, r, 1, {
      alignment: { vertical: "center", horizontal: "center" },
      font: { bold: true },
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sampling");
  XLSX.writeFile(wb, fileName);
}
