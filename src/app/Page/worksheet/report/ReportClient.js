"use client";

import { useEffect, useMemo, useState } from "react";
import { displayWorksheetAuditArea } from "@/app/data/worksheetAuditAreaTree";
import {
  displayWorksheetStatusLabel,
  worksheetStatusReportCellClass,
} from "@/lib/worksheetStatusDisplay";
import { worksheetStatusWpBadgeClass } from "@/lib/worksheetStatusWpDisplay";

/** Same department → schedule department_id as worksheet dept page / SOP report */
const WORKSHEET_DEPT_TO_SCHEDULE_ID = {
  FINANCE: "A1.1",
  ACCOUNTING: "A1.2",
  HRD: "A1.3",
  "G&A": "A1.4",
  "DESIGN STORE PLANNER": "A1.5",
  TAX: "A1.6",
  "SECURITY L&P": "A1.7",
  MIS: "A1.8",
  MERCHANDISE: "A1.9",
  OPERATIONAL: "A1.10",
  WAREHOUSE: "A1.11",
};

function normalizeScheduleDate(raw) {
  if (raw == null || raw === "") return null;
  const dateStr = String(raw);
  let out = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    out = d.toISOString().slice(0, 10);
  }
  return out;
}

/** YYYY-MM-DD in the viewer's local calendar (for comparing publish day vs period end). */
function toLocalIsoDate(v) {
  if (v == null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return "-";
  }
}

export default function ReportClient({ initialData = [], scheduleRows = [], selectedYear = null }) {
  const [data, setData] = useState(initialData);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const enrichedRows = useMemo(() => {
    return (data || []).map((row) => {
      const dept = row.department || row.department_name || "";
      const schedId = WORKSHEET_DEPT_TO_SCHEDULE_ID[dept];
      const sched = schedId ? scheduleRows.find((s) => s.department_id === schedId) : null;
      const periodStart = normalizeScheduleDate(sched?.start_date);
      const periodEnd = normalizeScheduleDate(sched?.end_date);
      const publishLocalIso = toLocalIsoDate(row.created_at);
      const exceeds = Boolean(periodEnd && publishLocalIso && publishLocalIso > periodEnd);
      return {
        ...row,
        _audit_period_start_iso: periodStart,
        _audit_period_end_iso: periodEnd,
        _publish_local_iso: publishLocalIso,
        exceeds_audit_period: exceeds,
      };
    });
  }, [data, scheduleRows]);

  const handleBack = () => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/Page/worksheet";
  };

  const handleView = (row) => {
    setSelectedRow(row);
    setViewOpen(true);
  };

  const colCount = 12;

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 py-4">
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Worksheet Report</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Published worksheets with audit period from Schedule (Worksheet module), fieldwork start from preparer date,
            and fieldwork end from publish time. Late publish (after period end) is highlighted in red.
            {selectedYear != null && !Number.isNaN(selectedYear) ? (
              <span className="font-medium text-slate-700"> Year: {selectedYear}.</span>
            ) : null}
          </p>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full table-fixed border-collapse text-[11px] sm:text-xs">
            <colgroup>
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                {[
                  "Audit fieldwork — Start",
                  "Audit fieldwork — End",
                  "Audit period — Start",
                  "Audit period — End",
                  "Department",
                  "Preparer",
                  "Reviewer",
                  "Reviewer date",
                  "Status worksheet",
                  "Status WP",
                  "Audit area",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-2 text-center text-[10px] sm:text-xs font-semibold text-gray-700 border border-gray-200 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedRows.map((row, idx) => (
                <tr
                  key={`${row.department}-${row.id || idx}`}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-slate-100`}
                >
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.preparer_date
                      ? formatDateForDisplay(row.preparer_date)
                      : row.date1 || "-"}
                  </td>
                  <td
                    className={`p-1 text-xs border border-gray-200 text-center whitespace-nowrap font-medium ${
                      row.exceeds_audit_period ? "text-red-600" : "text-gray-800"
                    }`}
                    title={
                      row.exceeds_audit_period
                        ? "Published after audit period end"
                        : row.created_at
                          ? "Publish time (when saved to report)"
                          : undefined
                    }
                  >
                    {row.created_at ? formatDateForDisplay(row.created_at) : "-"}
                    {row.exceeds_audit_period ? " ⚠" : ""}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row._audit_period_start_iso ? formatDateForDisplay(row._audit_period_start_iso) : "-"}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row._audit_period_end_iso ? formatDateForDisplay(row._audit_period_end_iso) : "-"}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap font-semibold">
                    {row.department || row.department_name || "-"}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                    {row.preparer || row.preparer_name || "-"}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                    {row.reviewer || row.reviewer_name || "-"}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.reviewer_date
                      ? formatDateForDisplay(row.reviewer_date)
                      : row.date2 || "-"}
                  </td>
                  <td
                    className={`p-1 text-xs text-center border border-gray-200 font-semibold ${worksheetStatusReportCellClass(
                      row.status_worksheet ?? row.statusWorksheet,
                    )}`}
                  >
                    {displayWorksheetStatusLabel(row.status_worksheet ?? row.statusWorksheet)}
                  </td>
                  <td className="p-1 text-xs border border-gray-200 text-center whitespace-nowrap align-middle">
                    <span
                      className={`inline-flex min-w-[4.5rem] justify-center px-2 py-0.5 rounded-md text-[11px] leading-tight ${worksheetStatusWpBadgeClass(row.status_wp ?? row.statusWP)}`}
                    >
                      {row.status_wp || row.statusWP || "-"}
                    </span>
                  </td>
                  <td
                    className="p-1 text-xs text-gray-800 border border-gray-200 text-center max-w-[140px] truncate align-top"
                    title={row.audit_area || row.auditArea || ""}
                  >
                    {displayWorksheetAuditArea(row.audit_area || row.auditArea)}
                  </td>
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                    <button
                      type="button"
                      className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs hover:bg-blue-100"
                      onClick={() => handleView(row)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {enrichedRows.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="p-4 text-center text-sm text-gray-600">
                    No worksheet data saved yet. Save data from the worksheet page first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
          <div className="bg-white rounded-xl shadow-xl w-[min(900px,95vw)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/80">
              <h3 className="text-lg font-semibold text-slate-900">Worksheet data detail</h3>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-800 rounded-lg p-2 hover:bg-slate-100"
                onClick={() => {
                  setViewOpen(false);
                  setSelectedRow(null);
                }}
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-800">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Worksheet information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Audit period — Start</div>
                    <div className="text-sm">
                      {selectedRow._audit_period_start_iso
                        ? formatDateForDisplay(selectedRow._audit_period_start_iso)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Audit period — End</div>
                    <div className="text-sm">
                      {selectedRow._audit_period_end_iso
                        ? formatDateForDisplay(selectedRow._audit_period_end_iso)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Audit fieldwork — Start</div>
                    <div className="text-sm text-slate-900">
                      {selectedRow.preparer_date
                        ? formatDateForDisplay(selectedRow.preparer_date)
                        : selectedRow.date1 || "-"}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">From preparer date on the worksheet</p>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Audit fieldwork — End</div>
                    <div
                      className={`text-sm ${
                        selectedRow.exceeds_audit_period ? "text-red-600 font-semibold" : "text-slate-900"
                      }`}
                    >
                      {selectedRow.created_at ? formatDateForDisplay(selectedRow.created_at) : "-"}
                      {selectedRow.exceeds_audit_period ? " ⚠" : ""}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Publish time (record created on report). Red if after audit period end.
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Department</div>
                    <div className="text-sm">{selectedRow.department || selectedRow.department_name || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Preparer</div>
                    <div className="text-sm">{selectedRow.preparer || selectedRow.preparer_name || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Reviewer</div>
                    <div className="text-sm">{selectedRow.reviewer || selectedRow.reviewer_name || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Reviewer date</div>
                    <div className="text-sm">
                      {selectedRow.reviewer_date
                        ? formatDateForDisplay(selectedRow.reviewer_date)
                        : selectedRow.date2 || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Status worksheet</div>
                    <div className="text-sm">
                      {displayWorksheetStatusLabel(selectedRow.status_worksheet ?? selectedRow.statusWorksheet)}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Status WP</div>
                    <div className="text-sm mt-0.5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-md text-xs ${worksheetStatusWpBadgeClass(selectedRow.status_wp ?? selectedRow.statusWP)}`}
                      >
                        {selectedRow.status_wp || selectedRow.statusWP || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="font-semibold text-gray-700 text-xs">Audit area</div>
                    <div className="text-sm break-words">
                      {displayWorksheetAuditArea(selectedRow.audit_area || selectedRow.auditArea)}
                    </div>
                  </div>
                </div>
              </div>

              {(selectedRow.file_path || selectedRow.filePath) && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Uploaded file</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-blue-900 mb-1">File name</div>
                        <a
                          href={selectedRow.file_path || selectedRow.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline break-all font-medium text-sm"
                        >
                          {selectedRow.file_path || selectedRow.filePath}
                        </a>
                      </div>
                      <a
                        href={selectedRow.file_path || selectedRow.filePath}
                        download
                        className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs hover:bg-slate-900 flex items-center gap-1 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
