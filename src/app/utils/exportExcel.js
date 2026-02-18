// app/lib/exportExcel.js
import * as XLSX from "xlsx-js-style";

/**
 * Export array of objects ke Excel dengan styling
 * @param {Array} data - array of objects
 * @param {Array|string} columns - array of headers atau string nama sheet
 * @param {string} status - "Draft" atau "Published"
 * @param {string} componentName - nama komponen/page yang melakukan export (misal "Finance", "HR", "RiskAssessment")
 * @param {Date} dateObj - tanggal export
 * @param {string} auditPeriodStart - audit period start date (optional)
 * @param {string} auditPeriodEnd - audit period end date (optional)
 */
export function exportToStyledExcel(
  data,
  columns,
  status = "Draft",
  componentName = "Data",
  dateObj = new Date(),
  auditPeriodStart = null,
  auditPeriodEnd = null
) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    if (typeof window !== "undefined" && window.__showToast) {
      window.__showToast("Tidak ada data untuk diexport", "error");
    } else {
      alert("Tidak ada data untuk diexport");
    }
    return;
  }

  // Pastikan status berupa string
  if (typeof status !== "string") {
    console.warn("Warning: status bukan string. Nilai status:", status);
    status = "Draft";
  }

  // Nama sheet & file (Excel sheet name max 31 chars)
  const rawSheetName = typeof columns === "string" ? columns : componentName;
  const sheetName = rawSheetName.length > 31 ? rawSheetName.substring(0, 31) : rawSheetName;
  const dateStr = dateObj
    .toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[/:]/g, "-")
    .replace(/\s/g, "_");

  const statusLabel = status.toLowerCase().includes("publish")
    ? "Published"
    : "Draft";

  // Nama file otomatis
  const fileName = `${componentName}_${statusLabel}_${dateStr}.xlsx`;

  // Normalisasi kolom
  const normalizedCols =
    Array.isArray(columns) && columns.length > 0
      ? columns.map((col) =>
          typeof col === "string" ? { header: col, key: col } : col
        )
      : Object.keys(data[0]).map((k) => ({ header: k, key: k }));

  // Susun data sesuai urutan kolom
  const dataForExcel = data.map((item) =>
    normalizedCols.reduce((acc, col) => {
      acc[col.header] = item[col.key] ?? "";
      return acc;
    }, {})
  );

  const worksheet = XLSX.utils.json_to_sheet([], { origin: 6 });

  // Style definitions - Premium and interactive design
  const titleStyle = {
    font: { sz: 20, bold: true, color: { rgb: "FFFFFF" }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { fgColor: { rgb: "1E3A8A" } },
    border: {
      top: { style: "thick", color: { rgb: "0F172A" } },
      bottom: { style: "thick", color: { rgb: "0F172A" } },
      left: { style: "thick", color: { rgb: "0F172A" } },
      right: { style: "thick", color: { rgb: "0F172A" } },
    },
  };
  const subtitleStyle = {
    font: { sz: 14, bold: true, color: { rgb: "1E40AF" }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { fgColor: { rgb: "EFF6FF" } },
    border: {
      top: { style: "thin", color: { rgb: "BFDBFE" } },
      bottom: { style: "thin", color: { rgb: "BFDBFE" } },
      left: { style: "thin", color: { rgb: "BFDBFE" } },
      right: { style: "thin", color: { rgb: "BFDBFE" } },
    },
  };
  const dateStyle = {
    font: { sz: 10, italic: true, color: { rgb: "64748B" }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "F8FAFC" } },
  };
  const statusStyle = {
    font: { sz: 11, bold: true, color: { rgb: "FFFFFF" }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: statusLabel.toLowerCase().includes("publish") ? "059669" : "D97706" } },
    border: {
      top: { style: "thin", color: { rgb: statusLabel.toLowerCase().includes("publish") ? "047857" : "B45309" } },
      bottom: { style: "thin", color: { rgb: statusLabel.toLowerCase().includes("publish") ? "047857" : "B45309" } },
      left: { style: "thin", color: { rgb: statusLabel.toLowerCase().includes("publish") ? "047857" : "B45309" } },
      right: { style: "thin", color: { rgb: statusLabel.toLowerCase().includes("publish") ? "047857" : "B45309" } },
    },
  };
  const auditPeriodStyle = {
    font: { sz: 11, bold: true, color: { rgb: "1E40AF" }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "DBEAFE" } },
    border: {
      top: { style: "thin", color: { rgb: "93C5FD" } },
      bottom: { style: "thin", color: { rgb: "93C5FD" } },
      left: { style: "thin", color: { rgb: "93C5FD" } },
      right: { style: "thin", color: { rgb: "93C5FD" } },
    },
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11, name: "Calibri" },
    fill: { fgColor: { rgb: "2563EB" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "medium", color: { rgb: "1E40AF" } },
      bottom: { style: "medium", color: { rgb: "1E40AF" } },
      left: { style: "medium", color: { rgb: "1E40AF" } },
      right: { style: "medium", color: { rgb: "1E40AF" } },
    },
  };
  const cellStyle = {
    font: { sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
    alignment: { vertical: "top", horizontal: "left", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  };
  const evenRowStyle = {
    ...cellStyle,
    fill: { fgColor: { rgb: "F8FAFC" } },
  };
  const oddRowStyle = {
    ...cellStyle,
    fill: { fgColor: { rgb: "FFFFFF" } },
  };

  // Header title di atas - English format
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const tanggal = `${day} ${month} ${year} at ${hours}.${minutes}`;

  // Determine title based on componentName
  // Only use "RISK ASSESSMENT FORM" if it's explicitly from risk assessment module
  // Exclude SOP, Evidence, Audit Finding, Worksheet, etc.
  const isRiskAssessment = componentName && (
    componentName.toLowerCase().includes("risk") && 
    !componentName.toLowerCase().includes("sop") &&
    !componentName.toLowerCase().startsWith("sop_") &&
    !componentName.toLowerCase().includes("evidence") &&
    !componentName.toLowerCase().includes("audit finding") &&
    !componentName.toLowerCase().includes("worksheet")
  ) || (
    // Specific risk assessment departments (only if not from other modules)
    (componentName.toLowerCase() === "finance" ||
     componentName.toLowerCase() === "accounting" ||
     componentName.toLowerCase() === "hrd" ||
     componentName.toLowerCase() === "operational" ||
     componentName.toLowerCase() === "warehouse" ||
     componentName.toLowerCase() === "tax" ||
     componentName.toLowerCase() === "mis" ||
     componentName.toLowerCase() === "merchandise" ||
     componentName.toLowerCase() === "sdp" ||
     componentName.toLowerCase() === "l&p" ||
     componentName.toLowerCase() === "g&a" ||
     componentName.toLowerCase() === "general") &&
    !componentName.toLowerCase().includes("sop") &&
    !componentName.toLowerCase().startsWith("sop_")
  );

  // Determine form type based on componentName
  let formTitle = "";
  if (isRiskAssessment) {
    formTitle = `RISK ASSESSMENT FORM - ${componentName.toUpperCase()}`;
  } else if (componentName && (componentName.toLowerCase().includes("sop") || componentName.toLowerCase().startsWith("sop_"))) {
    // Clean up SOP title - remove NOPERIOD, NOPERIO, and other placeholder values
    let cleanName = componentName.toUpperCase().replace("SOP_", "").replace(/_/g, " ");
    // Remove common placeholder patterns
    cleanName = cleanName
      .replace(/\bNOPERIOD\b/gi, "")
      .replace(/\bNOPERIO\b/gi, "")
      .replace(/\b#####\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    
    // If cleanName is empty or only has department, use just department
    if (!cleanName || cleanName.length < 2) {
      // Try to extract department from original componentName
      const parts = componentName.split("_");
      if (parts.length > 1) {
        cleanName = parts[1] ? parts[1].toUpperCase() : "";
      }
    }
    
    formTitle = cleanName ? `SOP REVIEW REPORT - ${cleanName}` : "SOP REVIEW REPORT";
  } else if (componentName && componentName.toLowerCase().includes("evidence")) {
    formTitle = `EVIDENCE REPORT - ${componentName.toUpperCase()}`;
  } else if (componentName && componentName.toLowerCase().includes("audit finding")) {
    formTitle = `AUDIT FINDING REPORT - ${componentName.toUpperCase()}`;
  } else if (componentName && componentName.toLowerCase().includes("worksheet")) {
    formTitle = `WORKSHEET REPORT - ${componentName.toUpperCase()}`;
  } else {
    formTitle = `${componentName.toUpperCase()} - DATA EXPORT`;
  }

  // Format audit period dates if provided
  const formatAuditPeriod = (dateStr) => {
    if (!dateStr || dateStr === "#####" || dateStr === "") return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, "0");
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const auditPeriodStartFormatted = auditPeriodStart ? formatAuditPeriod(auditPeriodStart) : "";
  const auditPeriodEndFormatted = auditPeriodEnd ? formatAuditPeriod(auditPeriodEnd) : "";

  const titleLines = [
    "PT KARYA PRIMA UNGGULAN",
    formTitle,
    `STATUS DATA: ${statusLabel.toUpperCase()}`,
    ...(auditPeriodStartFormatted && auditPeriodEndFormatted 
      ? [`AUDIT PERIOD: ${auditPeriodStartFormatted} - ${auditPeriodEndFormatted}`]
      : []),
    `EXPORT DATE: ${tanggal}`,
  ];

  titleLines.forEach((line, idx) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[line]], { origin: `A${idx + 1}` });
    const cellAddress = XLSX.utils.encode_cell({ r: idx, c: 0 });
    if (worksheet[cellAddress]) {
      if (idx === 0) {
        worksheet[cellAddress].s = titleStyle;
      } else if (idx === 1) {
        worksheet[cellAddress].s = subtitleStyle;
      } else if (line.includes("STATUS")) {
        worksheet[cellAddress].s = statusStyle;
      } else if (line.includes("AUDIT PERIOD")) {
        worksheet[cellAddress].s = auditPeriodStyle;
      } else {
        worksheet[cellAddress].s = dateStyle;
      }
    }
  });

  // Merge judul
  const colCount = normalizedCols.length;
  worksheet["!merges"] = [];
  for (let i = 0; i < titleLines.length; i++) {
    worksheet["!merges"].push({
      s: { r: i, c: 0 },
      e: { r: i, c: colCount - 1 },
    });
  }

  // Header tabel - Define headerOriginRow first
  const headerOriginRow = titleLines.length + 1;

  // Set row heights for better appearance
  worksheet["!rows"] = [];
  for (let i = 0; i < titleLines.length; i++) {
    worksheet["!rows"][i] = { hpt: i === 0 ? 30 : i === 1 ? 25 : 20 };
  }
  // Header row height
  worksheet["!rows"][headerOriginRow - 1] = { hpt: 25 };
  const headers = normalizedCols.map((c) => c.header);
  XLSX.utils.sheet_add_aoa(worksheet, [headers], {
    origin: `A${headerOriginRow}`,
  });

  // Data tabel
  dataForExcel.forEach((row, idx) => {
    const rowData = headers.map((h) => row[h]);
    XLSX.utils.sheet_add_aoa(worksheet, [rowData], {
      origin: `A${headerOriginRow + 1 + idx}`,
    });
  });

  // Set lebar kolom otomatis - Enhanced untuk data panjang (FIT ALL DATA - NO TRUNCATION)
  worksheet["!cols"] = normalizedCols.map((col, colIndex) => {
    const headerLen = col.header.length;
    // Calculate optimal width based on header and ALL data
    let maxDataLen = headerLen;
    let maxWordLength = 0;
    let maxLineLength = 0; // Track longest line if text is wrapped
    
    if (dataForExcel.length > 0) {
      // Check all rows for maximum length
      dataForExcel.forEach(row => {
        const val = String(row[col.header] || "");
        if (val.length > 0) {
          // Track longest single word (for wrapping consideration)
          const words = val.split(/\s+/);
          words.forEach(word => {
            if (word.length > maxWordLength) maxWordLength = word.length;
          });
          
          // Track longest line (considering natural line breaks)
          const lines = val.split('\n');
          lines.forEach(line => {
            if (line.length > maxLineLength) maxLineLength = line.length;
          });
          
          // For column width, use full length
          if (val.length > maxDataLen) maxDataLen = val.length;
        }
      });
    }
    
    // Determine if this is a long text column
    const isLongTextColumn = col.header.toLowerCase().includes("description") ||
                             col.header.toLowerCase().includes("comment") ||
                             col.header.toLowerCase().includes("related") ||
                             col.header.toLowerCase().includes("detail") ||
                             col.header.toLowerCase().includes("note") ||
                             col.header.toLowerCase().includes("sop related") ||
                             col.header.toLowerCase().includes("reviewer comments");
    
    // For long text columns, use MUCH wider width to fit ALL content
    let calculatedWidth;
    if (isLongTextColumn) {
      // For long text: use the maximum of:
      // 1. Longest word + padding (to ensure no word breaks)
      // 2. Longest line + padding (to show at least one full line)
      // 3. A percentage of total content (for wrapped display)
      calculatedWidth = Math.max(
        maxWordLength + 10,  // Ensure longest word fits with padding
        maxLineLength + 10,  // Ensure longest line fits
        Math.min(maxDataLen / 2.5 + 15, 120)  // Consider wrapped text, allow up to 120
      );
    } else {
      // For regular columns: use actual length with generous padding
      calculatedWidth = Math.max(15, maxDataLen + 8);
    }
    
    // Set minimum and maximum widths - BE MORE GENEROUS
    const minWidth = isLongTextColumn ? 30 : 15;
    const maxWidth = isLongTextColumn ? 120 : 80; // Increased max width
    
    const finalWidth = Math.max(minWidth, Math.min(calculatedWidth, maxWidth));
    
    return {
      wch: finalWidth,
    };
  });

  // Style header & isi
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const headerRowIndex = headerOriginRow - 1;

  // Style header baris
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    if (worksheet[addr]) worksheet[addr].s = headerStyle;
  }

  // Style data baris - Enhanced with alternating row colors and better alignment
  // First pass: calculate optimal row heights based on content to FIT ALL DATA - NO TRUNCATION
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const isEvenRow = (r - headerRowIndex) % 2 === 0;
    
    // Calculate row height based on content - ensure ALL text is visible
    let maxRowHeight = 25; // Increased default minimum height
    
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (worksheet[addr] && worksheet[addr].v) {
        const cellValue = String(worksheet[addr].v);
        const headerName = headers[c];
        const isLongTextColumn = headerName.toLowerCase().includes("description") ||
                                 headerName.toLowerCase().includes("comment") ||
                                 headerName.toLowerCase().includes("related") ||
                                 headerName.toLowerCase().includes("detail") ||
                                 headerName.toLowerCase().includes("note") ||
                                 headerName.toLowerCase().includes("sop related") ||
                                 headerName.toLowerCase().includes("reviewer comments");
        
        if (cellValue.length > 0) {
          // Get column width for this column
          const colWidth = worksheet["!cols"][c]?.wch || 15;
          
          // Count actual line breaks in the text
          const actualLineBreaks = (cellValue.match(/\n/g) || []).length;
          
          // Estimate how many lines needed based on text length and column width
          // Average character width is approximately 1.0-1.2 units in Excel (use 1.0 for safety)
          const avgCharWidth = 1.0;
          const charsPerLine = Math.max(1, Math.floor(colWidth / avgCharWidth));
          
          // Calculate wrapped lines (text without line breaks)
          const textWithoutBreaks = cellValue.replace(/\n/g, ' ');
          const wrappedLines = Math.max(1, Math.ceil(textWithoutBreaks.length / charsPerLine));
          
          // Total lines = actual line breaks + wrapped lines
          const totalLines = Math.max(actualLineBreaks + 1, wrappedLines);
          
          // For long text columns, ensure enough height for ALL lines
          if (isLongTextColumn) {
            // Each line needs approximately 18-20 points of height (increased for better visibility)
            const neededHeight = Math.max(25, totalLines * 18);
            maxRowHeight = Math.max(maxRowHeight, neededHeight);
          } else {
            // For regular columns, use calculation based on content
            if (totalLines > 1) {
              const neededHeight = Math.max(25, totalLines * 18);
              maxRowHeight = Math.max(maxRowHeight, neededHeight);
            } else if (cellValue.length > 200) {
              maxRowHeight = Math.max(maxRowHeight, 70);
            } else if (cellValue.length > 100) {
              maxRowHeight = Math.max(maxRowHeight, 50);
            } else if (cellValue.length > 50) {
              maxRowHeight = Math.max(maxRowHeight, 35);
            }
          }
        }
      }
    }
    
    // Set row height for data rows - ensure ALL content is visible
    // Increased max height to 300 to accommodate very long text
    const finalHeight = Math.max(25, Math.min(maxRowHeight, 300));
    if (!worksheet["!rows"][r]) {
      worksheet["!rows"][r] = { hpt: finalHeight };
    } else {
      worksheet["!rows"][r].hpt = Math.max(worksheet["!rows"][r].hpt || 25, finalHeight);
    }
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (worksheet[addr]) {
        const headerName = headers[c];
        const cellValue = worksheet[addr].v;
        
        // Determine alignment based on column type
        let cellAlignment = { ...cellStyle.alignment };
        const cellValueStr = String(cellValue || "");
        const isLongText = cellValueStr.length > 50;
        
        // For long text columns, always use top alignment and wrap text
        if (headerName.toLowerCase().includes("description") ||
            headerName.toLowerCase().includes("comment") ||
            headerName.toLowerCase().includes("related") ||
            headerName.toLowerCase().includes("detail") ||
            headerName.toLowerCase().includes("note") ||
            isLongText) {
          cellAlignment = { vertical: "top", horizontal: "left", wrapText: true };
        } else if (headerName.toLowerCase().includes("no") || 
            headerName.toLowerCase().includes("date") ||
            headerName.toLowerCase().includes("status") ||
            headerName.toLowerCase().includes("priority") ||
            headerName.toLowerCase().includes("risk")) {
          cellAlignment.horizontal = "center";
          cellAlignment.vertical = "center";
        } else if (headerName.toLowerCase().includes("amount") ||
                   headerName.toLowerCase().includes("value") ||
                   headerName.toLowerCase().includes("price")) {
          cellAlignment.horizontal = "right";
          cellAlignment.vertical = "center";
        }
        
        worksheet[addr].s = isEvenRow 
          ? { ...evenRowStyle, alignment: cellAlignment } 
          : { ...oddRowStyle, alignment: cellAlignment };
        
        // Color coding for priority/risk values - EXCLUDE Risk ID
        // Only apply color to "priority" or "risk value" columns, NOT "risk id"
        const isRiskId = headerName.toLowerCase().includes("risk id") || 
                         headerName.toLowerCase() === "risk id";
        const isPriorityOrRiskValue = (headerName.toLowerCase().includes("priority") || 
                                      (headerName.toLowerCase().includes("risk value") || 
                                       headerName.toLowerCase().includes("risk level"))) &&
                                      !isRiskId;
        
        if (isPriorityOrRiskValue) {
          const val = parseInt(cellValue, 10);
          if (!isNaN(val)) {
            if (val <= 2)
              worksheet[addr].s.fill = { fgColor: { rgb: "D1FAE5" } }; // light green
            else if (val > 6)
              worksheet[addr].s.fill = { fgColor: { rgb: "FEE2E2" } }; // light red
            else 
              worksheet[addr].s.fill = { fgColor: { rgb: "FEF3C7" } }; // light yellow
          }
        }
        
        // Color coding for status fields - Enhanced with better colors
        if (headerName.toLowerCase().includes("status")) {
          const statusVal = String(cellValue || "").toUpperCase();
          if (statusVal === "APPROVED" || statusVal === "COMPLETE" || statusVal === "PUBLISHED") {
            worksheet[addr].s.fill = { fgColor: { rgb: "D1FAE5" } };
            worksheet[addr].s.font = { ...worksheet[addr].s.font, color: { rgb: "065F46" }, bold: true };
            worksheet[addr].s.border = {
              top: { style: "thin", color: { rgb: "10B981" } },
              bottom: { style: "thin", color: { rgb: "10B981" } },
              left: { style: "thin", color: { rgb: "10B981" } },
              right: { style: "thin", color: { rgb: "10B981" } },
            };
          } else if (statusVal === "REJECTED" || statusVal === "CANCELLED") {
            worksheet[addr].s.fill = { fgColor: { rgb: "FEE2E2" } };
            worksheet[addr].s.font = { ...worksheet[addr].s.font, color: { rgb: "991B1B" }, bold: true };
            worksheet[addr].s.border = {
              top: { style: "thin", color: { rgb: "EF4444" } },
              bottom: { style: "thin", color: { rgb: "EF4444" } },
              left: { style: "thin", color: { rgb: "EF4444" } },
              right: { style: "thin", color: { rgb: "EF4444" } },
            };
          } else if (statusVal === "IN REVIEW" || statusVal === "IN PROGRESS") {
            worksheet[addr].s.fill = { fgColor: { rgb: "DBEAFE" } };
            worksheet[addr].s.font = { ...worksheet[addr].s.font, color: { rgb: "1E40AF" }, bold: true };
            worksheet[addr].s.border = {
              top: { style: "thin", color: { rgb: "3B82F6" } },
              bottom: { style: "thin", color: { rgb: "3B82F6" } },
              left: { style: "thin", color: { rgb: "3B82F6" } },
              right: { style: "thin", color: { rgb: "3B82F6" } },
            };
          } else if (statusVal === "DRAFT" || statusVal === "PENDING") {
            worksheet[addr].s.fill = { fgColor: { rgb: "FEF3C7" } };
            worksheet[addr].s.font = { ...worksheet[addr].s.font, color: { rgb: "92400E" }, bold: true };
            worksheet[addr].s.border = {
              top: { style: "thin", color: { rgb: "F59E0B" } },
              bottom: { style: "thin", color: { rgb: "F59E0B" } },
              left: { style: "thin", color: { rgb: "F59E0B" } },
              right: { style: "thin", color: { rgb: "F59E0B" } },
            };
          }
        }
      }
    }
  }

  // Add freeze panes for better navigation (freeze header row)
  // Freeze panes: freeze rows above header row
  if (headerOriginRow > 0) {
    worksheet["!freeze"] = {
      xSplit: "0",
      ySplit: String(headerOriginRow),
      topLeftCell: `A${headerOriginRow + 1}`,
      activePane: "bottomLeft",
      state: "frozen",
    };
  }

  // Add auto-filter for interactivity
  if (range && headerRowIndex >= 0) {
    const filterRange = XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: range.s.c },
      e: { r: range.e.r, c: range.e.c },
    });
    worksheet["!autofilter"] = { ref: filterRange };
  }

  // Set print settings for better printing
  worksheet["!margins"] = {
    left: 0.7,
    right: 0.7,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };

  // Tulis file Excel
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, worksheet, sheetName);
  XLSX.writeFile(wb, fileName);
}
