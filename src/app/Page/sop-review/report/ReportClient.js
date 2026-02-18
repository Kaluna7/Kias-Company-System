"use client";

import { useState, useMemo, useCallback } from "react";
import { exportToStyledExcel } from "@/app/utils/exportExcel";
import { useToast } from "@/app/contexts/ToastContext";

export default function ReportClient({ initialRows = [], initialScheduleData = [] }) {
  const [rows, setRows] = useState(initialRows);
  const [scheduleData] = useState(initialScheduleData);
  const toast = useToast();

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [periodDatePickerOpen, setPeriodDatePickerOpen] = useState(false);
  const [selectedApiPath, setSelectedApiPath] = useState("finance");
  const [tempPeriodStartDate, setTempPeriodStartDate] = useState("");
  const [tempPeriodEndDate, setTempPeriodEndDate] = useState("");

  const getScheduleDepartmentId = (deptName) => {
    const deptMap = {
      FINANCE: "A1.1",
      ACCOUNTING: "A1.2",
      HRD: "A1.3",
      "HUMAN RESOURCES": "A1.3",
      "G&A": "A1.4",
      "GENERAL AFFAIR": "A1.4",
      SDP: "A1.5",
      "STORE DESIGN & PLANNER": "A1.5",
      TAX: "A1.6",
      "L&P": "A1.7",
      "L & P": "A1.7",
      SECURITY: "A1.7",
      MIS: "A1.8",
      MERCHANDISE: "A1.9",
      OPERATIONAL: "A1.10",
      WAREHOUSE: "A1.11",
    };
    return deptMap[(deptName || "").toUpperCase()] || null;
  };

  const getScheduleForDepartment = useCallback((deptName) => {
    if (!scheduleData?.length) return null;
    const deptId = getScheduleDepartmentId(deptName);
    if (!deptId) return null;
    return scheduleData.find((s) => s.department_id === deptId) || null;
  }, [scheduleData]);

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr || dateStr === "#####" || dateStr === "no-period") return "#####";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return "#####";
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
    } catch {
      return "#####";
    }
  };

  const openPeriodDatePicker = (apiPath, startVal, endVal) => {
    const startDate = startVal && startVal !== "#####" ? String(startVal).slice(0, 10) : "";
    const endDate = endVal && endVal !== "#####" ? String(endVal).slice(0, 10) : "";
    setSelectedApiPath(apiPath || "finance");
    setTempPeriodStartDate(startDate);
    setTempPeriodEndDate(endDate);
    setPeriodDatePickerOpen(true);
  };

  const selectedScheduleBounds = useMemo(() => {
    const selected = rows.find((r) => r.apiPath === selectedApiPath) || null;
    if (!selected) return { min: undefined, max: undefined };
    const sched = getScheduleForDepartment(selected.department);
    const min = sched?.start_date ? String(sched.start_date).slice(0, 10) : undefined;
    const max = sched?.end_date ? String(sched.end_date).slice(0, 10) : undefined;
    return { min, max };
  }, [rows, selectedApiPath, getScheduleForDepartment]);

  const saveAuditPeriod = async () => {
    if (!tempPeriodStartDate || !tempPeriodEndDate) {
      toast.show("Please select Start and End date!", "error");
      return;
    }
    if (new Date(tempPeriodStartDate) > new Date(tempPeriodEndDate)) {
      toast.show("Start date cannot be after End date!", "error");
      return;
    }
    if (selectedScheduleBounds.min && tempPeriodStartDate < selectedScheduleBounds.min) {
      toast.show(`Audit Period Start must be on/after ${selectedScheduleBounds.min}`, "error");
      return;
    }
    if (selectedScheduleBounds.max && tempPeriodEndDate > selectedScheduleBounds.max) {
      toast.show(`Audit Period End must be on/before ${selectedScheduleBounds.max}`, "error");
      return;
    }
    try {
      const res = await fetch(`/api/SopReview/${selectedApiPath}/audit-period`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_period_start: tempPeriodStartDate, audit_period_end: tempPeriodEndDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.show("Failed to save data: " + (data.error || "Unknown error"), "error");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.apiPath === selectedApiPath
            ? { ...r, audit_period_start: tempPeriodStartDate, audit_period_end: tempPeriodEndDate }
            : r
        )
      );
      setPeriodDatePickerOpen(false);
      toast.show("Audit Period dates saved successfully!", "success");
    } catch (err) {
      console.error("Error saving audit period:", err);
      toast.show("Error saving data: " + err.message, "error");
    }
  };

  const groupedData = useMemo(() => {
    const groups = {};
    (rows || []).forEach((r) => {
      const meta = r.meta || {};
      const schedule = getScheduleForDepartment(r.department);
      const hasSteps = Array.isArray(r.steps) && r.steps.length > 0;
      const publishedAt = meta?.published_at || r.published_at || null;
      if (!publishedAt) return;
      const periodStart = r.audit_period_start && r.audit_period_start !== "#####"
        ? String(r.audit_period_start).slice(0, 10)
        : schedule?.start_date ? String(schedule.start_date).slice(0, 10) : "no-period";
      const periodEnd = r.audit_period_end && r.audit_period_end !== "#####"
        ? String(r.audit_period_end).slice(0, 10)
        : schedule?.end_date ? String(schedule.end_date).slice(0, 10) : "no-period";
      const publishedAtStr = publishedAt ? String(publishedAt) : "no-publish";
      const groupKey = `${periodStart}|||${periodEnd}|||${r.department}|||${publishedAtStr}|||${r.apiPath}`;
      if (!groups[groupKey]) {
        const auditFieldworkStart = periodStart !== "no-period" ? formatDateForDisplay(periodStart) : "#####";
        const auditFieldworkEnd = meta?.audit_fieldwork_end_date ? formatDateForDisplay(meta.audit_fieldwork_end_date) : "#####";
        const auditFieldworkEndDate = meta?.audit_fieldwork_end_date ? new Date(meta.audit_fieldwork_end_date) : null;
        const auditPeriodEndDate = periodEnd !== "no-period" ? new Date(periodEnd) : null;
        const exceedsAuditPeriod = auditFieldworkEndDate && auditPeriodEndDate ? auditFieldworkEndDate > auditPeriodEndDate : false;
        groups[groupKey] = {
          audit_period_start: periodStart,
          audit_period_end: periodEnd,
          audit_fieldwork_start: auditFieldworkStart,
          audit_fieldwork_end: auditFieldworkEnd,
          exceeds_audit_period: exceedsAuditPeriod,
          department: r.department,
          apiPath: r.apiPath,
          items: [],
          preparer: meta.preparer_name || r.preparer || "",
          reviewer: meta.reviewer_name || "",
          published_at: publishedAt,
        };
      }
      const itemAuditFieldworkStart = periodStart !== "no-period" ? formatDateForDisplay(periodStart) : "#####";
      const itemAuditFieldworkEnd = meta?.audit_fieldwork_end_date ? formatDateForDisplay(meta.audit_fieldwork_end_date) : "#####";
      const auditFieldworkEndDate = meta?.audit_fieldwork_end_date ? new Date(meta.audit_fieldwork_end_date) : null;
      const auditPeriodEndDate = periodEnd !== "no-period" ? new Date(periodEnd) : null;
      const exceedsAuditPeriod = auditFieldworkEndDate && auditPeriodEndDate ? auditFieldworkEndDate > auditPeriodEndDate : false;
      groups[groupKey].items.push({
        apiPath: r.apiPath,
        audit_period_start: formatDateForDisplay(periodStart),
        audit_period_end: formatDateForDisplay(periodEnd),
        audit_fieldwork_start: itemAuditFieldworkStart,
        audit_fieldwork_end: itemAuditFieldworkEnd,
        exceeds_audit_period: exceedsAuditPeriod,
        department: r.department,
        sop_available: hasSteps ? "AVAILABLE" : "Not Available",
        preparer: meta.preparer_name || r.preparer || "-",
        preparer_completion_date: meta.preparer_date ? String(meta.preparer_date).slice(0, 10) : "-",
        sop_preparer_status: meta.preparer_status || "DRAFT",
        reviewer: meta.reviewer_name || "-",
        sop_reviewer_status: meta.reviewer_status || "DRAFT",
        reviewer_date: meta.reviewer_date ? String(meta.reviewer_date).slice(0, 10) : "-",
        reviewer_comments: meta.reviewer_comment || "",
        _detail: { meta: r.meta, steps: r.steps, department: r.department, preparer: r.preparer || meta.preparer_name || "" },
      });
    });
    return Object.values(groups).sort((a, b) => {
      const aPub = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bPub = b.published_at ? new Date(b.published_at).getTime() : 0;
      if (aPub !== bPub) return bPub - aPub;
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      if (a.audit_period_start !== b.audit_period_start) return a.audit_period_start.localeCompare(b.audit_period_start);
      if (a.audit_period_end !== b.audit_period_end) return a.audit_period_end.localeCompare(b.audit_period_end);
      return 0;
    });
  }, [rows, getScheduleForDepartment]);

  const handleView = (group) => {
    if (!group?.items || group.items.length === 0) {
      toast.show(`No data yet. Please publish data first on the ${group.department} SOP Review page.`, "error");
      return;
    }
    setSelectedDetail(group);
    setViewOpen(true);
  };

  const handleExportExcel = (group) => {
    if (!group?.items || group.items.length === 0) {
      toast.show("No data to export", "error");
      return;
    }
    const exportData = [];
    group.items.forEach((item) => {
      if (item._detail?.steps && item._detail.steps.length > 0) {
        item._detail.steps.forEach((step) => {
          exportData.push({
            "Audit Period Start": item.audit_period_start !== "#####" ? item.audit_period_start : "",
            "Audit Period End": item.audit_period_end !== "#####" ? item.audit_period_end : "",
            "Department": item.department,
            "Preparer": item.preparer,
            "Reviewer": item.reviewer,
            "No": step.no || "",
            "SOP Related": step.sop_related || "",
            "Status": step.status || "DRAFT",
            "Comment": step.comment || "",
            "Step Reviewer": step.reviewer || "",
            "Preparer Status": item.sop_preparer_status || "DRAFT",
            "Reviewer Status": item.sop_reviewer_status || "DRAFT",
            "Reviewer Comments": item.reviewer_comments || "",
          });
        });
      }
    });
    if (exportData.length === 0) {
      toast.show("No data to export", "error");
      return;
    }
    const columns = [
      { header: "Audit Period Start", key: "Audit Period Start" },
      { header: "Audit Period End", key: "Audit Period End" },
      { header: "Department", key: "Department" },
      { header: "Preparer", key: "Preparer" },
      { header: "Reviewer", key: "Reviewer" },
      { header: "No", key: "No" },
      { header: "SOP Related", key: "SOP Related" },
      { header: "Status", key: "Status" },
      { header: "Comment", key: "Comment" },
      { header: "Step Reviewer", key: "Step Reviewer" },
      { header: "Preparer Status", key: "Preparer Status" },
      { header: "Reviewer Status", key: "Reviewer Status" },
      { header: "Reviewer Comments", key: "Reviewer Comments" },
    ];
    const deptShort = group.department.length > 10 ? group.department.substring(0, 10) : group.department;
    const periodStart = group.audit_period_start !== "#####" && group.audit_period_start ? group.audit_period_start.replace(/-/g, "") : "";
    const periodEnd = group.audit_period_end !== "#####" && group.audit_period_end ? group.audit_period_end.replace(/-/g, "") : "";
    let sheetName = `SOP_${deptShort}`;
    if (periodStart && periodEnd) sheetName = `SOP_${deptShort}_${periodStart}_${periodEnd}`;
    else if (periodStart) sheetName = `SOP_${deptShort}_${periodStart}`;
    sheetName = sheetName.substring(0, 31);
    const auditPeriodStart = group.audit_period_start && group.audit_period_start !== "#####" ? group.audit_period_start : null;
    const auditPeriodEnd = group.audit_period_end && group.audit_period_end !== "#####" ? group.audit_period_end : null;
    exportToStyledExcel(exportData, columns, "Published", sheetName, new Date(), auditPeriodStart, auditPeriodEnd);
  };

  const handleExportPDF = async (group) => {
    if (!group?.items || group.items.length === 0) {
      toast.show("No data to export", "error");
      return;
    }

    if (isExportingPDF) {
      toast.show("Export in progress, please wait...", "info");
      return;
    }

    const escapeHtml = (text) => {
      if (!text) return "";
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const maxSteps = 500;
    let stepCount = 0;
    let tableRows = "";
    group.items.forEach((item) => {
      if (item._detail?.steps?.length && stepCount < maxSteps) {
        item._detail.steps.forEach((step) => {
          if (stepCount >= maxSteps) return;
          tableRows += `<tr><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.no || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.sop_related || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.status || "DRAFT")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.comment || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.reviewer || "")}</td></tr>`;
          stepCount++;
        });
      }
    });

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Desktop: popup dengan view PDF langsung + print
    if (!isMobile) {
      const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>SOP Review Report - ${escapeHtml(group.department)}</title>
<style>
  @media print {
    @page {
      margin: 1cm;
      size: A4;
    }
    body {
      margin: 0;
      padding: 15px;
    }
  }
  body{font-family:Arial,sans-serif;padding:20px;margin:0;}
  h1{color:#1e293b;margin-top:0;}
  table{width:100%;border-collapse:collapse;margin-top:20px;page-break-inside:auto;}
  tr{page-break-inside:avoid;page-break-after:auto;}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;}
  th{background:#f3f4f6;font-weight:bold;}
</style>
<script>
  window.onload = function() {
    setTimeout(function() {
      window.print();
    }, 500);
  };
</script>
</head><body>
<h1>SOP Review Report</h1>
<p><strong>Department:</strong> ${escapeHtml(group.department)}</p>
<p><strong>Audit Period Start:</strong> ${escapeHtml(formatDateForDisplay(group.audit_period_start))}</p>
<p><strong>Audit Period End:</strong> ${escapeHtml(formatDateForDisplay(group.audit_period_end))}</p>
<p><strong>Preparer:</strong> ${escapeHtml(group.preparer || "-")}</p>
<p><strong>Reviewer:</strong> ${escapeHtml(group.reviewer || "-")}</p>
<table><thead><tr><th>No</th><th>SOP Related</th><th>Status</th><th>Comment</th><th>Reviewer</th></tr></thead><tbody>
${tableRows}
${stepCount >= maxSteps ? `<tr><td colspan="5" style="text-align:center;color:#666;font-style:italic;">... (showing ${maxSteps} of total steps)</td></tr>` : ""}
</tbody></table>
</body></html>`;

      try {
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, "_blank");
        
        if (!printWindow) {
          toast.show("Please allow popups to view and print PDF.", "warning");
          URL.revokeObjectURL(blobUrl);
          setIsExportingPDF(false);
          return;
        }
        
        printWindow.addEventListener("load", () => {
          setTimeout(() => {
            try {
              printWindow.print();
            } catch (e) {
              console.warn("Print error:", e);
            }
            // Cleanup setelah print dialog muncul
            setTimeout(() => {
              URL.revokeObjectURL(blobUrl);
            }, 2000);
          }, 500);
        });
        
        toast.show("Print dialog opened. In print settings, turn off 'Headers and footers' to remove the URL.", "info");
      } catch (err) {
        console.error("PDF popup error:", err);
        toast.show("Failed to open print dialog: " + (err?.message || ""), "error");
      } finally {
        setIsExportingPDF(false);
      }
      return;
    }

    // Mobile: generate PDF file dan download (agar tidak crash)
    setIsExportingPDF(true);
    toast.show("Processing PDF...", "info");
    try {
      if (!window.html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load PDF library"));
          document.head.appendChild(script);
        });
      }

      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.width = "210mm";
      tempDiv.style.padding = "15mm";
      tempDiv.style.fontFamily = "Arial, sans-serif";
      tempDiv.style.fontSize = "11px";
      tempDiv.style.lineHeight = "1.4";
      tempDiv.style.color = "#000";
      tempDiv.style.backgroundColor = "#fff";
      tempDiv.innerHTML = `
        <div style="margin-bottom: 15px;">
          <h1 style="color: #1e293b; font-size: 20px; margin-bottom: 10px; margin-top: 0;">SOP Review Report</h1>
          <p style="margin: 4px 0;"><strong>Department:</strong> ${escapeHtml(group.department)}</p>
          <p style="margin: 4px 0;"><strong>Audit Period Start:</strong> ${escapeHtml(formatDateForDisplay(group.audit_period_start))}</p>
          <p style="margin: 4px 0;"><strong>Audit Period End:</strong> ${escapeHtml(formatDateForDisplay(group.audit_period_end))}</p>
          <p style="margin: 4px 0;"><strong>Preparer:</strong> ${escapeHtml(group.preparer || "-")}</p>
          <p style="margin: 4px 0;"><strong>Reviewer:</strong> ${escapeHtml(group.reviewer || "-")}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px;">
          <thead>
            <tr style="background: #f3f4f6; font-weight: bold;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">No</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">SOP Related</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Status</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Comment</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Reviewer</th>
            </tr>
          </thead>
          <tbody>${tableRows}${stepCount >= maxSteps ? `<tr><td colspan="5" style="padding: 8px; text-align: center; color: #666; font-style: italic;">... (showing ${maxSteps} of total steps)</td></tr>` : ""}</tbody>
        </table>
      `;
      document.body.appendChild(tempDiv);

      await window.html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `SOP_Review_${group.department.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(tempDiv).save();

      document.body.removeChild(tempDiv);
      toast.show("PDF downloaded successfully!", "success");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.show("Failed to export PDF: " + (error?.message || "Unknown error"), "error");
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">SOP Review Report</h1>
          <p className="text-xs sm:text-sm text-gray-600">Comprehensive overview of all department SOP reviews (published)</p>
        </div>
        <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm mt-4">
          <table className="min-w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-100">
                {["Department", "Preparer", "Reviewer", "Audit Period Start", "Audit Period End", "Status", "Action"].map((h) => (
                  <th key={h} className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedData.map((row, idx) => {
                const totalSteps = row.items.reduce((sum, item) => sum + (item._detail?.steps?.length || 0), 0);
                const hasData = totalSteps > 0;
                return (
                  <tr
                    key={`${row.audit_period_start}-${row.audit_period_end}-${row.department}-${idx}`}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                  >
                    <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap font-semibold">
                      {row.department || "-"}
                    </td>
                    <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                      {row.preparer || "-"}
                    </td>
                    <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                      {row.reviewer || "-"}
                    </td>
                    <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                      {formatDateForDisplay(row.audit_period_start) !== "#####" ? formatDateForDisplay(row.audit_period_start) : "-"}
                    </td>
                    <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                      {formatDateForDisplay(row.audit_period_end) !== "#####" ? formatDateForDisplay(row.audit_period_end) : "-"}
                    </td>
                    <td
                      className={`p-1 text-xs text-center border border-gray-200 font-semibold ${
                        hasData ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {hasData ? "AVAILABLE" : "-"}
                    </td>
                    <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                      <button
                        className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs hover:bg-blue-100"
                        onClick={() => handleView(row)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {groupedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-sm text-gray-600">
                    No SOP Review data has been published yet. Please publish data on the SOP Review page per department first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewOpen && selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-lg w-[min(900px,95vw)] max-h-[85vh] overflow-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">SOP Review Data Detail — {selectedDetail?.department || "Department"}</h3>
                <div className="flex items-center gap-2">
                  {selectedDetail?.items?.length > 0 && (
                    <>
                      <button onClick={() => handleExportExcel(selectedDetail)} className="px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100">
                        Export Excel
                      </button>
                      <button 
                        onClick={() => handleExportPDF(selectedDetail)} 
                        disabled={isExportingPDF}
                        className={`px-2 py-1.5 border rounded text-xs ${
                          isExportingPDF 
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                            : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        }`}
                      >
                        {isExportingPDF ? "Exporting..." : "Export PDF"}
                      </button>
                    </>
                  )}
                  <button className="text-gray-600 hover:text-gray-800 p-1" onClick={() => { setViewOpen(false); setSelectedDetail(null); }} aria-label="Close">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4 text-sm text-gray-800">
                {!selectedDetail?.items || selectedDetail.items.length === 0 ? (
                  <div className="text-center py-8 px-2">
                    <p className="text-gray-600">No data yet. Please publish data first on the relevant SOP Review department page.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-700 mb-2">Group Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
                        <div><div className="font-semibold text-gray-700 text-xs">Department</div><div className="text-sm">{selectedDetail.department || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Preparer</div><div className="text-sm">{selectedDetail.preparer || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Reviewer</div><div className="text-sm">{selectedDetail.reviewer || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Audit Period Start</div><div className="text-sm">{formatDateForDisplay(selectedDetail.audit_period_start)}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Audit Period End</div><div className="text-sm">{formatDateForDisplay(selectedDetail.audit_period_end)}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Audit Fieldwork Start</div><div className="text-sm">{formatDateForDisplay(selectedDetail.audit_fieldwork_start)}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Audit Fieldwork End</div><div className={`text-sm ${selectedDetail.items?.some((i) => i.exceeds_audit_period) ? "text-red-600 font-bold" : ""}`}>{formatDateForDisplay(selectedDetail.audit_fieldwork_end)}{selectedDetail.items?.some((i) => i.exceeds_audit_period) ? " ⚠️" : ""}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Published At</div><div className="text-sm">{selectedDetail.published_at ? String(selectedDetail.published_at).slice(0, 19) : "-"}</div></div>
                      </div>
                    </div>
                    {selectedDetail.items.map((item, itemIdx) => {
                      if (!item._detail?.steps || item._detail.steps.length === 0) return null;
                      const getStatusBadge = (status) => {
                        const s = (status || "DRAFT").toUpperCase();
                        if (s === "APPROVED") return "bg-green-100 text-green-800";
                        if (s === "REJECTED") return "bg-red-100 text-red-800";
                        if (s === "IN REVIEW") return "bg-blue-100 text-blue-800";
                        return "bg-yellow-100 text-yellow-800";
                      };
                      return (
                        <div key={itemIdx} className="space-y-2">
                          <h4 className="font-semibold text-gray-700">SOP Steps — {item.department} ({item._detail.steps.length} items)</h4>
                          {item._detail?.meta && (
                            <div className="bg-gray-50 rounded p-2 border border-gray-200 mb-2">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div><span className="font-semibold text-gray-700">Preparer:</span> {item._detail.meta.preparer_name || item.preparer || "-"}</div>
                                <div><span className="font-semibold text-gray-700">Preparer Status:</span> {item._detail.meta.preparer_status || "DRAFT"}</div>
                                <div><span className="font-semibold text-gray-700">Reviewer:</span> {item._detail.meta.reviewer_name || "-"}</div>
                                <div><span className="font-semibold text-gray-700">Reviewer Status:</span> {item._detail.meta.reviewer_status || "DRAFT"}</div>
                              </div>
                            </div>
                          )}
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-[600px] w-full text-xs border-collapse">
                              <thead><tr className="bg-gray-100">
                                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-200">No</th>
                                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-200">SOP Related</th>
                                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-200">Status</th>
                                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-200">Reviewer</th>
                                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-200">Comment</th>
                              </tr></thead>
                              <tbody>
                                {item._detail.steps.map((step, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                    <td className="p-2 border border-gray-200">{step.no || idx + 1}</td>
                                    <td className="p-2 border border-gray-200">{step.sop_related || "-"}</td>
                                    <td className="p-2 border border-gray-200"><span className={`px-2 py-1 rounded text-[10px] font-semibold ${getStatusBadge(step.status)}`}>{step.status || "DRAFT"}</span></td>
                                    <td className="p-2 border border-gray-200">{step.reviewer || "-"}</td>
                                    <td className="p-2 border border-gray-200 whitespace-pre-wrap break-words">{step.comment || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {periodDatePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:px-4">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[min(500px,95vw)] overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"><span className="text-white text-base sm:text-lg">📅</span></div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">Set Audit Period Dates</h3>
                </div>
                <button className="w-8 h-8 flex-shrink-0 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600" onClick={() => setPeriodDatePickerOpen(false)}>✕</button>
              </div>
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Audit Period Start</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={tempPeriodStartDate} onChange={(e) => setTempPeriodStartDate(e.target.value)} min={selectedScheduleBounds.min} max={selectedScheduleBounds.max} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Audit Period End</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={tempPeriodEndDate} onChange={(e) => setTempPeriodEndDate(e.target.value)} min={tempPeriodStartDate || undefined} max={selectedScheduleBounds.max} />
                </div>
                <div className="flex flex-wrap justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-200">
                  <button className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-sm" onClick={() => setPeriodDatePickerOpen(false)}>Cancel</button>
                  <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium text-sm shadow-sm" onClick={saveAuditPeriod}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
