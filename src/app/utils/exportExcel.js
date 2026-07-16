// app/utils/exportExcel.js
import * as XLSX from "xlsx-js-style";

const RISK_ASSESSMENT_EXPORT_COLUMNS = [
  { header: "RISK ID NO.", key: "risk_id_no" },
  { header: "Category", key: "category" },
  { header: "Sub Department", key: "sub_department" },
  { header: "SOP Related", key: "sop_related" },
  { header: "Risk Description", key: "risk_description" },
  { header: "Risk Details", key: "risk_details" },
  { header: "Impact Description", key: "impact_description" },
  { header: "Impact Level", key: "impact_level" },
  { header: "Probability Level", key: "probability_level" },
  { header: "Priority Level", key: "priority_level" },
  { header: "Mitigation Strategy", key: "mitigation_strategy" },
  { header: "Owners", key: "owners" },
  { header: "Root Cause Category", key: "root_cause_category" },
  { header: "Onset Timeframe", key: "onset_timeframe" },
  { header: "Status", key: "status" },
];

/** Match Internal Audit Report Excel template (clean blue header + centered title). */
const COLORS = {
  headerBlue: "2F5496",
  text: "000000",
  white: "FFFFFF",
  border: "000000",
};

const FONT = "Times New Roman";

function isInvalidPeriodValue(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!v) return true;
  return v === "#####" || v === "no period" || v === "noperiod" || v === "-";
}

function sanitizeDepartmentLabel(department) {
  return String(department || "")
    .replace(/\b20\d{6}(?:\s*[-–]\s*20\d{6})?\b/g, "")
    .replace(
      /\b20\d{2}[-/]\d{2}[-/]\d{2}(?:\s*[-–]\s*20\d{2}[-/]\d{2}[-/]\d{2})?\b/g,
      ""
    )
    .replace(/\bno[\s_-]*period\b/gi, "")
    .replace(/#+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Soft fills for status cells (Approve / In Review / etc.). */
const STATUS_STYLES = {
  success: { fill: "D1FAE5", font: "065F46" }, // Approved, Complete, …
  info: { fill: "DBEAFE", font: "1E40AF" }, // In Review, In Progress, …
  warning: { fill: "FEF3C7", font: "92400E" }, // Draft, Pending, …
  danger: { fill: "FEE2E2", font: "991B1B" }, // Rejected, Cancelled, …
};

/**
 * Resolve fill/font colors for a status cell value.
 * @returns {{ fill: string, font: string } | null}
 */
function resolveStatusStyle(rawValue) {
  const v = String(rawValue ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!v || v === "-") return null;

  if (
    v === "APPROVED" ||
    v === "COMPLETE" ||
    v === "COMPLETED" ||
    v === "PUBLISHED" ||
    v === "AVAILABLE" ||
    v === "NO ACTION REQUIRED" ||
    v.includes("REVISION COMPLETED") ||
    v.includes("READY TO PUBLISH")
  ) {
    return STATUS_STYLES.success;
  }
  if (
    v === "REJECTED" ||
    v === "CANCELLED" ||
    v === "CANCELED" ||
    v.includes("REVISION NEEDED")
  ) {
    return STATUS_STYLES.danger;
  }
  if (
    v === "IN REVIEW" ||
    v === "IN PROGRESS" ||
    v === "PENDING REVIEW" ||
    v.includes("REVIEW")
  ) {
    return STATUS_STYLES.info;
  }
  if (v === "DRAFT" || v === "PENDING" || v.includes("PENDING")) {
    return STATUS_STYLES.warning;
  }
  return null;
}

function resolveReportTitleParts(componentName, dateObj, auditPeriodStart, auditPeriodEnd) {
  const raw = String(componentName || "Data").trim();
  const lower = raw.toLowerCase();

  let reportType = "DATA EXPORT";
  let department = raw.replace(/_/g, " ").toUpperCase();

  if (
    (lower.includes("risk") &&
      !lower.includes("sop") &&
      !lower.includes("evidence") &&
      !lower.includes("audit finding") &&
      !lower.includes("worksheet")) ||
    [
      "finance",
      "accounting",
      "hrd",
      "operational",
      "warehouse",
      "tax",
      "mis",
      "merchandise",
      "sdp",
      "l&p",
      "g&a",
      "general",
    ].includes(lower)
  ) {
    reportType = "RISK ASSESSMENT FORM";
    department = `${raw.toUpperCase()} DEPARTMENT`;
  } else if (lower.includes("sop") || lower.startsWith("sop_")) {
    reportType = "SOP REVIEW REPORT";
    department = `${raw
      .replace(/^sop[_ ]?/i, "")
      .replace(/_/g, " ")
      .toUpperCase()} DEPARTMENT`;
  } else if (lower.includes("evidence")) {
    reportType = "EVIDENCE REPORT";
    department = `${raw.replace(/evidence[_ ]?/i, "").replace(/_/g, " ").toUpperCase()} DEPARTMENT`;
  } else if (lower.includes("audit finding")) {
    reportType = "AUDIT FINDING REPORT";
    department = `${raw.replace(/audit finding[_ ]?/i, "").replace(/_/g, " ").toUpperCase()} DEPARTMENT`;
  } else if (lower.includes("audit_review") || lower.includes("audit review")) {
    reportType = "INTERNAL AUDIT REPORT";
    department = `${raw
      .replace(/^audit_review[_ ]?/i, "")
      .replace(/^audit review[_ ]?/i, "")
      .replace(/_/g, " ")
      .trim()
      .toUpperCase()} DEPARTMENT`;
  } else if (lower.includes("worksheet")) {
    reportType = "WORKSHEET REPORT";
    department = `${raw.replace(/worksheet[_ ]?/i, "").replace(/_/g, " ").toUpperCase()} DEPARTMENT`;
  }

  department = sanitizeDepartmentLabel(department);
  if (!department || department === "DEPARTMENT") {
    department = sanitizeDepartmentLabel(`${raw.replace(/_/g, " ").toUpperCase()} DEPARTMENT`);
  }
  if (!department || department === "DEPARTMENT") {
    department = "DEPARTMENT";
  }

  let year = String(dateObj?.getFullYear?.() || new Date().getFullYear());
  for (const candidate of [auditPeriodEnd, auditPeriodStart]) {
    if (isInvalidPeriodValue(candidate)) continue;
    const m = String(candidate).match(/(20\d{2})/);
    if (m) {
      year = m[1];
      break;
    }
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      year = String(d.getFullYear());
      break;
    }
  }

  return { reportType, department, year };
}

/**
 * Export array of objects ke Excel — desain seperti Internal Audit Report template.
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

  if (typeof status !== "string") status = "Draft";

  const rawSheetName = typeof columns === "string" ? columns : componentName;
  const sheetName = String(rawSheetName).substring(0, 31);
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

  const statusLabel = status.toLowerCase().includes("publish") ? "Published" : "Draft";
  const fileName = `${componentName}_${statusLabel}_${dateStr}.xlsx`;

  const riskIdPrefixByComponent = {
    finance: "A.2.1.",
    accounting: "A.2.2.",
    hrd: "A.2.3.",
    "g&a": "A.2.4.",
    sdp: "A.2.5.",
    tax: "A.2.6.",
    "l&p": "A.2.7.",
    mis: "A.2.8.",
    merchandise: "A.2.9.",
    operational: "A.2.10.",
    warehouse: "A.2.11.",
  };

  const isRiskAssessmentComponent = Object.prototype.hasOwnProperty.call(
    riskIdPrefixByComponent,
    String(componentName || "").toLowerCase()
  );

  const normalizedCols =
    Array.isArray(columns) && columns.length > 0
      ? columns.map((col) =>
          typeof col === "string" ? { header: col, key: col } : col
        )
      : isRiskAssessmentComponent
        ? RISK_ASSESSMENT_EXPORT_COLUMNS
        : Object.keys(data[0]).map((k) => ({ header: k, key: k }));

  const dataForExcel = data.map((item) =>
    normalizedCols.reduce((acc, col) => {
      if (col.key === "risk_id_no" && isRiskAssessmentComponent) {
        const prefix =
          riskIdPrefixByComponent[String(componentName || "").toLowerCase()] ??
          "A.2.1.";
        acc[col.header] = item[col.key] ?? `${prefix}${item.risk_id ?? ""}`;
      } else {
        acc[col.header] = item[col.key] ?? "";
      }
      return acc;
    }, {})
  );

  const { reportType, department, year } = resolveReportTitleParts(
    componentName,
    dateObj,
    auditPeriodStart,
    auditPeriodEnd
  );

  const titleLines = [reportType, department, year];
  const worksheet = XLSX.utils.json_to_sheet([], { origin: titleLines.length + 1 });

  const titleStyle = {
    font: { name: FONT, sz: 14, bold: true, color: { rgb: COLORS.text } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const headerStyle = {
    font: { name: FONT, sz: 11, bold: true, color: { rgb: COLORS.white } },
    fill: { fgColor: { rgb: COLORS.headerBlue } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: COLORS.border } },
      bottom: { style: "thin", color: { rgb: COLORS.border } },
      left: { style: "thin", color: { rgb: COLORS.border } },
      right: { style: "thin", color: { rgb: COLORS.border } },
    },
  };
  const cellStyle = {
    font: { name: FONT, sz: 10, color: { rgb: COLORS.text } },
    fill: { fgColor: { rgb: COLORS.white } },
    alignment: { vertical: "top", horizontal: "left", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: COLORS.border } },
      bottom: { style: "thin", color: { rgb: COLORS.border } },
      left: { style: "thin", color: { rgb: COLORS.border } },
      right: { style: "thin", color: { rgb: COLORS.border } },
    },
  };

  const colCount = Math.max(1, normalizedCols.length);

  titleLines.forEach((line, idx) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[line]], { origin: `A${idx + 1}` });
    const cellAddress = XLSX.utils.encode_cell({ r: idx, c: 0 });
    if (worksheet[cellAddress]) worksheet[cellAddress].s = titleStyle;
  });

  worksheet["!merges"] = titleLines.map((_, i) => ({
    s: { r: i, c: 0 },
    e: { r: i, c: colCount - 1 },
  }));

  const headerOriginRow = titleLines.length + 1;
  worksheet["!rows"] = [
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 28 },
  ];

  const headers = normalizedCols.map((c) => c.header);
  XLSX.utils.sheet_add_aoa(worksheet, [headers], {
    origin: `A${headerOriginRow}`,
  });

  dataForExcel.forEach((row, idx) => {
    XLSX.utils.sheet_add_aoa(worksheet, [headers.map((h) => row[h])], {
      origin: `A${headerOriginRow + 1 + idx}`,
    });
  });

  worksheet["!cols"] = normalizedCols.map((col) => {
    const headerLen = String(col.header || "").length;
    let maxLen = headerLen;
    dataForExcel.forEach((row) => {
      const len = String(row[col.header] ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    const isLong =
      /description|comment|related|detail|note|recommendation|procedure|review/i.test(
        String(col.header || "")
      );
    const width = isLong
      ? Math.min(Math.max(28, maxLen / 2 + 10), 55)
      : Math.min(Math.max(10, maxLen + 2), 28);
    return { wch: width };
  });

  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const headerRowIndex = headerOriginRow - 1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    if (worksheet[addr]) worksheet[addr].s = { ...headerStyle };
  }

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    let maxRowHeight = 20;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!worksheet[addr]) continue;
      const headerName = String(headers[c] || "");
      const value = String(worksheet[addr].v ?? "");
      const isLong =
        value.length > 40 ||
        /description|comment|related|detail|note|recommendation|procedure|review/i.test(
          headerName
        );
      const colWidth = worksheet["!cols"][c]?.wch || 14;
      const lines = Math.max(
        1,
        (value.match(/\n/g) || []).length + 1,
        Math.ceil(value.length / Math.max(1, colWidth))
      );
      if (isLong || lines > 1) {
        maxRowHeight = Math.max(maxRowHeight, Math.min(lines * 14, 120));
      }

      const isStatusCol = /status/i.test(headerName);
      const centered =
        isStatusCol ||
        /^(no\.?)$/i.test(headerName.trim()) ||
        /date|priority|^risk$/i.test(headerName);

      const style = {
        ...cellStyle,
        alignment: {
          vertical: isStatusCol ? "center" : isLong ? "top" : "center",
          horizontal: centered ? "center" : "left",
          wrapText: true,
        },
      };

      // Color-code status cells (Approve, In Review, Complete, …) — same font size as other cells
      if (isStatusCol) {
        const statusColors = resolveStatusStyle(value);
        if (statusColors) {
          style.fill = { fgColor: { rgb: statusColors.fill } };
          style.font = {
            ...style.font,
            color: { rgb: statusColors.font },
          };
        }
      }

      worksheet[addr].s = style;
    }
    worksheet["!rows"][r] = { hpt: maxRowHeight };
  }

  worksheet["!freeze"] = {
    xSplit: "0",
    ySplit: String(headerOriginRow),
    topLeftCell: `A${headerOriginRow + 1}`,
    activePane: "bottomLeft",
    state: "frozen",
  };

  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: range.s.c },
      e: { r: range.e.r, c: range.e.c },
    }),
  };

  worksheet["!margins"] = {
    left: 0.5,
    right: 0.5,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, worksheet, sheetName);
  XLSX.writeFile(wb, fileName);
}
