"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import { exportToStyledExcel } from "@/app/utils/exportExcel";
import { useToast } from "@/app/contexts/ToastContext";

const STEP_STATUS_OPTIONS = ["DRAFT", "IN REVIEW", "APPROVED", "REJECTED"];

function deepClone(obj) {
  try {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

export default function ReportClient({ initialRows = [], initialScheduleData = [], selectedYear = null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user?.role || "").toLowerCase();
  const canEditPublished = role === "reviewer" || role === "admin";

  const [rows, setRows] = useState(initialRows);
  const [scheduleData] = useState(initialScheduleData);
  const toast = useToast();

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [savingPublished, setSavingPublished] = useState(false);
  const [deletingPublished, setDeletingPublished] = useState(false);
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
        credentials: "include",
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

  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  const groupedData = useMemo(() => {
    // Rows from the server are already year-filtered in loadReportData.
    // Only group here; do not filter again (avoids losing rows due to date format mismatches).
    const effectiveRows = rows || [];

    console.log("[SOP-REPORT-CLIENT] initialRows", {
      selectedYear,
      totalRows: rows?.length ?? 0,
      sampleRow: rows?.[0] || null,
    });

    const groups = {};
    effectiveRows.forEach((r) => {
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
      const metaId = r.meta?.id != null ? String(r.meta.id) : "";
      const publishedAtStr = publishedAt ? String(publishedAt) : "no-publish";
      const groupKey = `${metaId}|||${periodStart}|||${periodEnd}|||${r.department}|||${publishedAtStr}|||${r.apiPath}`;
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

  const totalGroups = groupedData.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return groupedData.slice(start, start + PAGE_SIZE);
  }, [groupedData, currentPage]);

  const goToPage = (page) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  };

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const handleView = (group) => {
    if (!group?.items || group.items.length === 0) {
      toast.show(`No data yet. Please publish data first on the ${group.department} SOP Review page.`, "error");
      return;
    }
    setSelectedDetail(group);
    setDetailEditing(false);
    setEditSnapshot(null);
    setViewOpen(true);
  };

  const beginDetailEdit = () => {
    if (!selectedDetail) return;
    const snap = deepClone(selectedDetail);
    snap.items = (snap.items || []).map((it) => ({
      ...it,
      _pendingDeletedStepIds: [],
    }));
    setEditSnapshot(snap);
    setDetailEditing(true);
  };

  const cancelDetailEdit = () => {
    setDetailEditing(false);
    setEditSnapshot(null);
  };

  const patchEditStep = useCallback((itemIdx, stepIdx, patch) => {
    setEditSnapshot((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => {
        if (i !== itemIdx) return it;
        const steps = [...(it._detail?.steps || [])];
        if (!steps[stepIdx]) return it;
        steps[stepIdx] = { ...steps[stepIdx], ...patch };
        return { ...it, _detail: { ...it._detail, steps } };
      });
      return { ...prev, items };
    });
  }, []);

  const removeEditStep = useCallback((itemIdx, stepIdx) => {
    setEditSnapshot((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => {
        if (i !== itemIdx) return it;
        const steps = [...(it._detail?.steps || [])];
        const removed = steps.splice(stepIdx, 1)[0];
        const pending = [...(it._pendingDeletedStepIds || [])];
        const rid = removed?.id != null ? Number(removed.id) : NaN;
        if (Number.isFinite(rid) && rid > 0) pending.push(rid);
        return {
          ...it,
          _pendingDeletedStepIds: pending,
          _detail: { ...it._detail, steps },
        };
      });
      return { ...prev, items };
    });
  }, []);

  const deletePublishedRecord = async (metaId) => {
    const mid = Number(metaId);
    if (!Number.isFinite(mid) || mid <= 0) return;
    const group = editSnapshot || selectedDetail;
    const apiPath = group?.items?.[0]?.apiPath;
    if (!apiPath) {
      toast.show("Missing department for delete.", "error");
      return;
    }
    if (
      !window.confirm(
        "Delete this published record and all of its SOP steps? This cannot be undone.",
      )
    ) {
      return;
    }
    setDeletingPublished(true);
    try {
      const res = await fetch(`/api/SopReview/${encodeURIComponent(apiPath)}/published`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta_ids: [mid] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast.show("Please sign in as Reviewer or Admin.", "error");
        return;
      }
      if (res.status === 403) {
        toast.show(data?.error || "Only Reviewer or Admin can delete published data.", "error");
        return;
      }
      if (!res.ok || !data.success) {
        toast.show("Delete failed: " + (data.error || res.status), "error");
        return;
      }
      toast.show("Published record deleted.", "success");
      setViewOpen(false);
      setSelectedDetail(null);
      setDetailEditing(false);
      setEditSnapshot(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.show("Error: " + (e?.message || ""), "error");
    } finally {
      setDeletingPublished(false);
    }
  };

  const savePublishedEdits = async () => {
    if (!editSnapshot?.items?.length) return;
    const apiPath = editSnapshot.items[0]?.apiPath;
    if (!apiPath) {
      toast.show("Missing department (apiPath) for save.", "error");
      return;
    }
    setSavingPublished(true);
    try {
      const updates = editSnapshot.items.map((item) => {
        const meta = { ...(item._detail?.meta || {}) };
        const metaId = meta.id;
        const steps = (item._detail?.steps || []).map((s) => ({
          id: s.id,
          no: s.no,
          sop_related: s.sop_related,
          status: s.status,
          comment: s.comment,
          reviewer_feedback: s.reviewer_feedback,
          reviewer: s.reviewer,
        }));
        return {
          meta_id: metaId,
          deleted_step_ids: item._pendingDeletedStepIds || [],
          meta: {
            department_name: item.department || meta.department_name,
            preparer_name: meta.preparer_name,
            preparer_date: meta.preparer_date,
            reviewer_name: meta.reviewer_name,
            reviewer_date: meta.reviewer_date,
            reviewer_comment: meta.reviewer_comment,
            preparer_status: meta.preparer_status,
            reviewer_status: meta.reviewer_status,
            audit_fieldwork_start_date: meta.audit_fieldwork_start_date,
            audit_fieldwork_end_date: meta.audit_fieldwork_end_date,
          },
          steps,
        };
      });

      const res = await fetch(`/api/SopReview/${encodeURIComponent(apiPath)}/published`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast.show("Please sign in as Reviewer or Admin.", "error");
        return;
      }
      if (res.status === 403) {
        toast.show(data?.error || "Only Reviewer or Admin can edit published data.", "error");
        return;
      }
      if (!res.ok || !data.success) {
        toast.show("Save failed: " + (data.error || res.status), "error");
        return;
      }

      toast.show("Changes saved.", "success");
      setDetailEditing(false);
      setEditSnapshot(null);
      setViewOpen(false);
      setSelectedDetail(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.show("Error: " + (e?.message || ""), "error");
    } finally {
      setSavingPublished(false);
    }
  };

  const modalDetail = detailEditing && editSnapshot ? editSnapshot : selectedDetail;

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
            "Reviewer Feedback": step.reviewer_feedback || "",
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
      { header: "Reviewer Feedback", key: "Reviewer Feedback" },
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

    const maxStepsDesktop = 500;
    let stepCountDesktop = 0;
    let tableRowsDesktop = "";
    group.items.forEach((item) => {
      if (item._detail?.steps?.length && stepCountDesktop < maxStepsDesktop) {
        item._detail.steps.forEach((step) => {
          if (stepCountDesktop >= maxStepsDesktop) return;
          tableRowsDesktop += `<tr style="page-break-inside:avoid;"><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.no || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.sop_related || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.status || "DRAFT")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.comment || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.reviewer_feedback || "")}</td><td style="border:1px solid #ddd;padding:6px;">${escapeHtml(step.reviewer || "")}</td></tr>`;
          stepCountDesktop++;
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
<table><thead><tr><th>No</th><th>SOP Related</th><th>Status</th><th>Comment</th><th>Reviewer Feedback</th><th>Reviewer</th></tr></thead><tbody>
${tableRowsDesktop}
${stepCountDesktop >= maxStepsDesktop ? `<tr><td colspan="6" style="text-align:center;color:#666;font-style:italic;">... (showing ${maxStepsDesktop} of total steps)</td></tr>` : ""}
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

    // Mobile: generate PDF langsung dengan jsPDF (lebih stabil di HP; html2canvas/html2pdf sering blank kalau tabel panjang)
    setIsExportingPDF(true);
    toast.show("Processing PDF...", "info");
    try {
      const fileName = `SOP_Review_${group.department.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      const maxStepsPdf = 50000;
      const tableData = [];
      let stepCount = 0;
      group.items.forEach((item) => {
        if (item._detail?.steps?.length && stepCount < maxStepsPdf) {
          item._detail.steps.forEach((step) => {
            if (stepCount >= maxStepsPdf) return;
            tableData.push([
              String(step.no ?? ""),
              String(step.sop_related ?? ""),
              String(step.status ?? "DRAFT"),
              String(step.comment ?? ""),
              String(step.reviewer_feedback ?? ""),
              String(step.reviewer ?? ""),
            ]);
            stepCount++;
          });
        }
      });

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const margin = 10;
      const pageW = 210;
      const pageH = 297;
      const maxY = pageH - margin;

      // Kolom total = 190mm supaya pas dengan margin 10mm kiri-kanan
      const colW = [10, 45, 20, 45, 40, 30];
      const colX = [
        margin,
        margin + colW[0],
        margin + colW[0] + colW[1],
        margin + colW[0] + colW[1] + colW[2],
        margin + colW[0] + colW[1] + colW[2] + colW[3],
        margin + colW[0] + colW[1] + colW[2] + colW[3] + colW[4],
      ];
      const tableW = colW.reduce((a, b) => a + b, 0);
      const padX = 1.2;
      const padY = 1.2;
      const lineH = 4;

      const wrap = (text, w) => doc.splitTextToSize(String(text ?? ""), Math.max(1, w));

      const drawPageHeader = () => {
        let y = margin;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("SOP Review Report", margin, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        wrap(`Department: ${group.department || "-"}`, pageW - margin * 2).forEach((l) => {
          doc.text(l, margin, y);
          y += 5;
        });
        doc.text(`Audit Period Start: ${formatDateForDisplay(group.audit_period_start)}`, margin, y);
        y += 5;
        doc.text(`Audit Period End: ${formatDateForDisplay(group.audit_period_end)}`, margin, y);
        y += 5;
        wrap(`Preparer: ${group.preparer || "-"}`, pageW - margin * 2).forEach((l) => {
          doc.text(l, margin, y);
          y += 5;
        });
        wrap(`Reviewer: ${group.reviewer || "-"}`, pageW - margin * 2).forEach((l) => {
          doc.text(l, margin, y);
          y += 5;
        });
        y += 4;
        return y;
      };

      const drawTableHeader = (y) => {
        const h = 8;
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, y, tableW, h, "F");
        doc.rect(margin, y, tableW, h, "S");

        // vertical lines
        for (let i = 1; i < colW.length; i++) {
          doc.line(colX[i], y, colX[i], y + h);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const labels = ["No", "SOP Related", "Status", "Comment", "Reviewer Feedback", "Reviewer"];
        labels.forEach((label, idx) => {
          doc.text(label, colX[idx] + padX, y + 5.5);
        });
        return y + h;
      };

      let y = drawPageHeader();
      y = drawTableHeader(y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setDrawColor(220, 220, 220);

      const ensureSpace = (neededHeight) => {
        if (y + neededHeight <= maxY) return;
        doc.addPage();
        y = drawPageHeader();
        y = drawTableHeader(y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setDrawColor(220, 220, 220);
      };

      tableData.forEach((row) => {
        const cellLines = row.map((val, idx) => wrap(val, colW[idx] - padX * 2));
        const rowLines = Math.max(1, ...cellLines.map((arr) => arr.length));
        const rowH = padY * 2 + rowLines * lineH;
        ensureSpace(rowH);

        // Draw row border box + vertical lines
        doc.rect(margin, y, tableW, rowH, "S");
        for (let i = 1; i < colW.length; i++) {
          doc.line(colX[i], y, colX[i], y + rowH);
        }

        // Draw text
        cellLines.forEach((lines, col) => {
          lines.forEach((line, lineIdx) => {
            doc.text(String(line), colX[col] + padX, y + padY + (lineIdx + 1) * lineH - 1);
          });
        });

        y += rowH;
      });

      // Output and download
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.show("PDF downloaded successfully!", "success");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.show("Failed to export PDF: " + (error?.message || "Unknown error"), "error");
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              window.location.href = "/Page/sop-review";
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              SOP Review Report
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Comprehensive overview of all department SOP reviews that have been published.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-200">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Completed</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-[11px] font-medium text-yellow-700 ring-1 ring-inset ring-yellow-200">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span>In Progress</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>Draft / Not Started</span>
            </span>
          </div>
        </div>

        <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 sm:px-4 py-2.5">
            <p className="text-[11px] sm:text-xs text-slate-600">
              Use this report to quickly review audit periods, fieldwork dates, status per department, and reviewer comments.
            </p>
            {totalGroups > 0 && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                {totalGroups} grouped record{totalGroups > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  {[
                    "Audit Fieldwork - Start",
                    "Audit Fieldwork - End",
                    "Audit Period - Start",
                    "Audit Period - End",
                    "Department",
                    "SOP Sheet",
                    "SOP Availability",
                    "Preparer",
                    "Preparer Completion Date",
                    "SOP Preparer",
                    "SOP Reviewer",
                    "SOP Reviewer Status",
                    "Reviewer Date",
                    "SOP Reviewer Comments",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-center text-[10px] sm:text-xs font-semibold border border-slate-200 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, idx) => {
                  const totalSteps = row.items.reduce(
                    (sum, item) => sum + (item._detail?.steps?.length || 0),
                    0
                  );
                  const hasData = totalSteps > 0;
                  const item = row.items?.[0] || row;
                  const sopSheet = getScheduleDepartmentId(row.department) || "-";
                  const getPreparerStatusBg = (s) => {
                    const st = (s || "DRAFT").toUpperCase();
                    if (st === "COMPLETED") return "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200";
                    if (st === "DRAFT") return "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200";
                    return "bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-200";
                  };
                  const getReviewerStatusBg = (s) => {
                    const st = (s || "DRAFT").toUpperCase();
                    if (st === "COMPLETED" || st === "APPROVED")
                      return "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200";
                    if (st === "DRAFT") return "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200";
                    return "bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-200";
                  };
                  return (
                    <tr
                      key={`${row.audit_period_start}-${row.audit_period_end}-${row.department}-${idx}`}
                      className={`${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      } hover:bg-slate-100 transition-colors`}
                    >
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {row.audit_fieldwork_start !== "#####"
                          ? row.audit_fieldwork_start
                          : "#####"
                        }
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {row.audit_fieldwork_end !== "#####"
                          ? row.audit_fieldwork_end
                          : "#####"
                        }
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {formatDateForDisplay(row.audit_period_start) !== "#####"
                          ? formatDateForDisplay(row.audit_period_start)
                          : "#####"
                        }
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {formatDateForDisplay(row.audit_period_end) !== "#####"
                          ? formatDateForDisplay(row.audit_period_end)
                          : "#####"
                        }
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-900 border border-slate-200 text-center whitespace-nowrap font-semibold">
                        {row.department || "-"}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {sopSheet}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-center border border-slate-200">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            hasData
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                              : "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200"
                          }`}
                        >
                          {hasData ? "Available" : "Not Available"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-left break-words whitespace-pre-wrap align-top max-w-[140px]">
                        {row.preparer || "-"}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {item.preparer_completion_date !== "-" ? item.preparer_completion_date : "0"}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-center border border-slate-200 font-semibold">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${getPreparerStatusBg(
                            item.sop_preparer_status
                          )}`}
                        >
                          {item.sop_preparer_status || "DRAFT"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {item.reviewer !== "-" ? item.reviewer : "0"}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-center border border-slate-200 font-semibold">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${getReviewerStatusBg(
                            item.sop_reviewer_status
                          )}`}
                        >
                          {item.sop_reviewer_status || "DRAFT"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center whitespace-nowrap">
                        {item.reviewer_date !== "-" ? item.reviewer_date : "0"}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-left break-words whitespace-pre-wrap align-top max-w-[160px]">
                        {item.reviewer_comments || ""}
                      </td>
                      <td className="px-2.5 py-2 text-[11px] text-slate-800 border border-slate-200 text-center">
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
                          onClick={() => handleView(row)}
                        >
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {groupedData.length === 0 && (
                  <tr>
                    <td
                      colSpan={15}
                      className="p-6 text-center text-sm sm:text-base text-slate-600 bg-slate-50"
                    >
                      No SOP Review data has been published yet. Please publish data on the SOP Review
                      page per department first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalGroups > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 sm:px-4 py-2.5 bg-slate-50/60">
              <p className="text-xs sm:text-sm text-slate-600">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, totalGroups)} of {totalGroups} report
                {totalGroups > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs sm:text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewOpen && modalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 sm:px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[min(960px,100vw)] max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 min-w-0 truncate">
                SOP Review Data Detail — {modalDetail?.department || "Department"}
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                {canEditPublished && !detailEditing && modalDetail?.items?.length > 0 && (
                  <button
                    type="button"
                    onClick={beginDetailEdit}
                    className="px-2.5 py-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-full text-[11px] font-medium hover:bg-indigo-100"
                  >
                    Edit
                  </button>
                )}
                {detailEditing && (
                  <>
                    <button
                      type="button"
                      onClick={cancelDetailEdit}
                      disabled={savingPublished || deletingPublished}
                      className="px-2.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[11px] font-medium hover:bg-slate-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={savePublishedEdits}
                      disabled={savingPublished || deletingPublished}
                      className="px-2.5 py-1.5 bg-blue-600 text-white border border-blue-700 rounded-full text-[11px] font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingPublished ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
                {modalDetail?.items?.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExportExcel(modalDetail)}
                      className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium hover:bg-emerald-100"
                    >
                      Export Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPDF(modalDetail)}
                      disabled={isExportingPDF}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium border ${
                        isExportingPDF
                          ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      }`}
                    >
                      {isExportingPDF ? "Exporting..." : "Export PDF"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                  onClick={() => {
                    setViewOpen(false);
                    setSelectedDetail(null);
                    setDetailEditing(false);
                    setEditSnapshot(null);
                  }}
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-sm text-slate-800">
              {detailEditing && editSnapshot && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                  Edit mode: only the <strong>SOP steps table</strong> below can be changed (row fields and{" "}
                  <strong>Remove</strong> for a step). Header and audit period are read-only here; use the report list to
                  adjust audit period if needed. Click <strong>Save</strong> to apply table changes.{" "}
                  <strong>Delete published record</strong> removes the entire publication.
                </div>
              )}
              {!modalDetail?.items || modalDetail.items.length === 0 ? (
                <div className="text-center py-10 px-2">
                  <p className="text-slate-600">
                    No data yet. Please publish data first on the relevant SOP Review department page.
                  </p>
                </div>
              ) : (
                <>
                  {modalDetail.items.map((item, itemIdx) => {
                    const stepRows = item._detail?.steps || [];
                    if (!detailEditing && stepRows.length === 0) return null;
                    const itemMeta = item._detail?.meta || {};
                    const itemPreparer = itemMeta.preparer_name || item.preparer || "-";
                    const itemReviewer = itemMeta.reviewer_name || item.reviewer || "-";
                    const itemPublishedAt = itemMeta.published_at || modalDetail.published_at;
                    const getStatusBadge = (status) => {
                      const s = (status || "DRAFT").toUpperCase();
                      if (s === "APPROVED") return "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200";
                      if (s === "REJECTED") return "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200";
                      if (s === "IN REVIEW") return "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200";
                      return "bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-200";
                    };
                    const ed = detailEditing;
                    return (
                      <div
                        key={itemMeta.id ?? `item-${itemIdx}`}
                        className="mb-6 sm:mb-8 space-y-3 sm:space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"
                      >
                        <div className="mb-2 sm:mb-3">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-semibold text-slate-800 text-sm sm:text-base">
                              Published data — {item.department}{" "}
                              <span className="text-xs sm:text-sm font-normal text-slate-500">
                                (published:{" "}
                                {itemPublishedAt ? String(itemPublishedAt).slice(0, 19) : "-"}
                                )
                              </span>
                            </h4>
                            {ed && itemMeta.id != null && (
                              <button
                                type="button"
                                onClick={() => deletePublishedRecord(itemMeta.id)}
                                disabled={deletingPublished || savingPublished}
                                className="shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-medium border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-50"
                              >
                                {deletingPublished ? "Deleting..." : "Delete published record"}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 bg-white rounded-lg border border-slate-100 p-3 sm:p-4">
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Department</div>
                              <div className="text-sm text-slate-900">{item.department || "-"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Preparer</div>
                              <div className="text-sm text-slate-900">{itemPreparer}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Reviewer</div>
                              <div className="text-sm text-slate-900">{itemReviewer}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">
                                Preparer Completion Date
                              </div>
                              <div className="text-sm text-slate-900">
                                {item.preparer_completion_date !== "-"
                                  ? item.preparer_completion_date
                                  : "-"}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">SOP Preparer Status</div>
                              <div className="text-sm text-slate-900">{itemMeta.preparer_status || "DRAFT"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">SOP Reviewer Status</div>
                              <div className="text-sm text-slate-900">{itemMeta.reviewer_status || "DRAFT"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Reviewer Date</div>
                              <div className="text-sm text-slate-900">
                                {item.reviewer_date !== "-" ? item.reviewer_date : "-"}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">
                                Reviewer Comments
                              </div>
                              <div className="text-sm text-slate-900 whitespace-pre-wrap">
                                {item.reviewer_comments || itemMeta.reviewer_comment || ""}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">
                                Audit Period Start
                              </div>
                              <div className="text-sm text-slate-900">
                                {item.audit_period_start !== "#####"
                                  ? item.audit_period_start
                                  : "-"}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Audit Period End</div>
                              <div className="text-sm text-slate-900">
                                {item.audit_period_end !== "#####"
                                  ? item.audit_period_end
                                  : "-"}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">
                                Audit Fieldwork Start
                              </div>
                              <div className="text-sm text-slate-900">
                                {item.audit_fieldwork_start !== "#####"
                                  ? item.audit_fieldwork_start
                                  : "-"}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Audit Fieldwork End</div>
                              <div
                                className={`text-sm ${
                                  item.exceeds_audit_period ? "text-red-600 font-semibold" : "text-slate-900"
                                }`}
                              >
                                {item.audit_fieldwork_end !== "#####"
                                  ? item.audit_fieldwork_end
                                  : "-"}
                                {item.exceeds_audit_period ? " ⚠️" : ""}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-600 text-[11px] mb-0.5">Published At</div>
                              <div className="text-sm text-slate-900">
                                {itemPublishedAt ? String(itemPublishedAt).slice(0, 19) : "-"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-slate-800 mb-2 sm:mb-3">
                            SOP Steps ({stepRows.length} items)
                          </h4>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className={`w-full text-xs border-collapse ${ed ? "min-w-[920px]" : "min-w-[840px]"}`}>
                              <thead>
                                <tr className="bg-slate-50 text-slate-700">
                                  <th className="px-2.5 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                                    No
                                  </th>
                                  <th className="px-2.5 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                                    SOP Related
                                  </th>
                                  <th className="px-2.5 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                                    Status
                                  </th>
                                  <th className="px-2.5 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                                    Reviewer
                                  </th>
                                  <th className="px-2.5 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                                    Comment
                                  </th>
                                  <th className="px-2.5 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                                    Reviewer Feedback
                                  </th>
                                  {ed && (
                                    <th className="px-2.5 py-2 text-center font-semibold text-slate-700 border border-slate-200 w-24">
                                      Actions
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {stepRows.map((step, idx) => (
                                  <tr
                                    key={`${itemMeta.id}-step-${step.id ?? idx}`}
                                    className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                                  >
                                    <td className="px-2.5 py-2 border border-slate-200 align-top">
                                      {ed ? (
                                        <input
                                          type="number"
                                          className="w-14 border border-slate-300 rounded px-1 py-1"
                                          value={step.no ?? idx + 1}
                                          onChange={(e) =>
                                            patchEditStep(itemIdx, idx, {
                                              no: e.target.value === "" ? null : Number(e.target.value),
                                            })
                                          }
                                        />
                                      ) : (
                                        step.no || idx + 1
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2 border border-slate-200 align-top">
                                      {ed ? (
                                        <textarea
                                          rows={2}
                                          className="w-full min-w-[120px] border border-slate-300 rounded px-1 py-1 text-xs"
                                          value={step.sop_related ?? ""}
                                          onChange={(e) =>
                                            patchEditStep(itemIdx, idx, { sop_related: e.target.value })
                                          }
                                        />
                                      ) : (
                                        step.sop_related || "-"
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2 border border-slate-200 align-top">
                                      {ed ? (
                                        <select
                                          className="w-full min-w-[100px] border border-slate-300 rounded px-1 py-1"
                                          value={step.status || "DRAFT"}
                                          onChange={(e) =>
                                            patchEditStep(itemIdx, idx, { status: e.target.value })
                                          }
                                        >
                                          {STEP_STATUS_OPTIONS.map((o) => (
                                            <option key={o} value={o}>
                                              {o}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span
                                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusBadge(
                                            step.status
                                          )}`}
                                        >
                                          {step.status || "DRAFT"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2 border border-slate-200 align-top">
                                      {ed ? (
                                        <input
                                          className="w-full min-w-[80px] border border-slate-300 rounded px-1 py-1"
                                          value={step.reviewer ?? ""}
                                          onChange={(e) =>
                                            patchEditStep(itemIdx, idx, { reviewer: e.target.value })
                                          }
                                        />
                                      ) : (
                                        step.reviewer || "-"
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2 border border-slate-200 align-top whitespace-pre-wrap break-words">
                                      {ed ? (
                                        <textarea
                                          rows={2}
                                          className="w-full min-w-[100px] border border-slate-300 rounded px-1 py-1 text-xs"
                                          value={step.comment ?? ""}
                                          onChange={(e) =>
                                            patchEditStep(itemIdx, idx, { comment: e.target.value })
                                          }
                                        />
                                      ) : (
                                        step.comment || "-"
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2 border border-slate-200 align-top whitespace-pre-wrap break-words">
                                      {ed ? (
                                        <textarea
                                          rows={2}
                                          className="w-full min-w-[100px] border border-slate-300 rounded px-1 py-1 text-xs"
                                          value={step.reviewer_feedback ?? ""}
                                          onChange={(e) =>
                                            patchEditStep(itemIdx, idx, {
                                              reviewer_feedback: e.target.value,
                                            })
                                          }
                                        />
                                      ) : (
                                        step.reviewer_feedback || "-"
                                      )}
                                    </td>
                                    {ed && (
                                      <td className="px-2 py-2 border border-slate-200 text-center align-top">
                                        <button
                                          type="button"
                                          onClick={() => removeEditStep(itemIdx, idx)}
                                          className="text-[11px] font-semibold text-red-700 hover:text-red-900 hover:underline"
                                        >
                                          Remove
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                {ed && stepRows.length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={7}
                                      className="p-4 text-center text-slate-500 border border-slate-200"
                                    >
                                      No steps left. Click <strong>Save</strong> to update the record, or{" "}
                                      <strong>Delete published record</strong> to remove it entirely.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          {ed && stepRows.some((s) => s.id == null) && (
                            <p className="mt-2 text-[11px] text-amber-700">
                              Some rows are missing a database ID — refresh the report page after deploy so step saves work
                              correctly.
                            </p>
                          )}
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
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <span className="text-white text-base sm:text-lg">📅</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                  Set Audit Period Dates
                </h3>
              </div>
              <button
                className="w-8 h-8 flex-shrink-0 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600"
                onClick={() => setPeriodDatePickerOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Audit Period Start
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={tempPeriodStartDate}
                  onChange={(e) => setTempPeriodStartDate(e.target.value)}
                  min={selectedScheduleBounds.min}
                  max={selectedScheduleBounds.max}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Audit Period End
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={tempPeriodEndDate}
                  onChange={(e) => setTempPeriodEndDate(e.target.value)}
                  min={tempPeriodStartDate || undefined}
                  max={selectedScheduleBounds.max}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-200">
                <button
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-sm"
                  onClick={() => setPeriodDatePickerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium text-sm shadow-sm"
                  onClick={saveAuditPeriod}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
