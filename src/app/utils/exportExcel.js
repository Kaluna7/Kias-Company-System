// app/lib/exportExcel.js
import * as XLSX from "xlsx-js-style";

/**
 * Export array of objects ke Excel dengan styling
 * @param {Array} data - array of objects
 * @param {Array|string} columns - array of headers atau string nama sheet
 * @param {string} status - Draft / Published
 * @param {Date} dateObj - tanggal export
 * @param {string} fileName - nama file yang akan dihasilkan
 */
export function exportToStyledExcel(data, columns, status = "Draft", dateObj = new Date(), fileName = "finance.xlsx") {
  if (!data || !Array.isArray(data) || data.length === 0) {
    alert("Tidak ada data untuk diexport");
    return;
  }

  const sheetName = typeof columns === "string" ? columns : "Finance";

  // Normalisasi columns
  const normalizedCols =
    Array.isArray(columns) && columns.length > 0
      ? columns.map(col => (typeof col === "string" ? { header: col, key: col } : col))
      : Object.keys(data[0]).map(k => ({ header: k, key: k }));

  // Map data sesuai urutan columns
  const dataForExcel = data.map(item =>
    normalizedCols.reduce((acc, col) => {
      acc[col.header] = item[col.key] ?? "";
      return acc;
    }, {})
  );

  const worksheet = XLSX.utils.json_to_sheet([], { origin: 6 });

  // Styling
  const titleStyle = {
    font: { sz: 16, bold: true, color: { rgb: "000000" } },
    alignment: { horizontal: "center", vertical: "center" }
  };
  const subtitleStyle = {
    font: { sz: 14, bold: true, color: { rgb: "FF0000" } },
    alignment: { horizontal: "center", vertical: "center" }
  };
  const dateStyle = {
    font: { sz: 10, italic: true, color: { rgb: "666666" } },
    alignment: { horizontal: "center" }
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "3498DB" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "medium", color: { rgb: "000000" } },
      bottom: { style: "medium", color: { rgb: "000000" } },
      left: { style: "medium", color: { rgb: "000000" } },
      right: { style: "medium", color: { rgb: "000000" } }
    }
  };
  const cellStyle = {
    font: { sz: 9, color: { rgb: "2C3E50" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  // Tambahkan Title
  const tanggal = dateObj.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const titleLines = [
    "PT KARYA PRIMA UNGGULAN",
    `RISK ASSESSMENT FORM (${sheetName})`,
    `Status Data: ${status.toUpperCase()}`,
    `Tanggal Export: ${tanggal}`
  ];

  titleLines.forEach((line, idx) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[line]], { origin: `A${idx + 1}` });
    const cellAddress = XLSX.utils.encode_cell({ r: idx, c: 0 });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s =
        idx === 0 ? titleStyle :
        idx === 1 ? subtitleStyle :
        dateStyle;
    }
  });

  // Merge judul
  const colCount = normalizedCols.length;
  worksheet["!merges"] = [];
  for (let i = 0; i < titleLines.length; i++) {
    worksheet["!merges"].push({ s: { r: i, c: 0 }, e: { r: i, c: colCount - 1 } });
  }

  // Header tabel
  const headerOriginRow = titleLines.length + 1;
  const headers = normalizedCols.map(c => c.header);
  XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: `A${headerOriginRow}` });

  // Data tabel
  dataForExcel.forEach((row, idx) => {
    const rowData = headers.map(h => row[h]);
    XLSX.utils.sheet_add_aoa(worksheet, [rowData], { origin: `A${headerOriginRow + 1 + idx}` });
  });

  // Range
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  worksheet["!cols"] = normalizedCols.map(col => ({ wch: Math.max(12, col.header.length + 10) }));

  // Style header
  const headerRowIndex = headerOriginRow - 1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    if (worksheet[addr]) worksheet[addr].s = headerStyle;
  }

  // Style data
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (worksheet[addr]) {
        worksheet[addr].s = { ...cellStyle };

        // Coloring khusus Priority Level
        const headerName = headers[c];
        if (headerName.toLowerCase().includes("priority")) {
          const val = parseInt(worksheet[addr].v, 10);
          if (!isNaN(val)) {
            if (val <= 2) worksheet[addr].s.fill = { fgColor: { rgb: "C6EFCE" } }; // hijau
            else if (val > 6) worksheet[addr].s.fill = { fgColor: { rgb: "FFC7CE" } }; // merah
            else worksheet[addr].s.fill = { fgColor: { rgb: "FFEB9C" } }; // kuning
          }
        }
      }
    }
  }

  // Buat workbook & tulis file
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, worksheet, sheetName);

  XLSX.writeFile(wb, fileName);
}
