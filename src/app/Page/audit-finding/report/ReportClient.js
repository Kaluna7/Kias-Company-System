"use client";

import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { exportToStyledExcel } from "@/app/utils/exportExcel";

export default function ReportClient({ initialData = [] }) {
  const [selectedGroup, setSelectedGroup] = useState(null); // { deptName, periodKey } | null
  const data = initialData;
  const dateFormatCache = useMemo(() => new Map(), []);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return "-";
    if (dateFormatCache.has(dateStr)) return dateFormatCache.get(dateStr);
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "-";
      const formatted = date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
      dateFormatCache.set(dateStr, formatted);
      return formatted;
    } catch {
      return "-";
    }
  }, [dateFormatCache]);
  const reportColumns = useMemo(
    () => [
      { key: "department", header: "Department", accessor: (row) => row.department || "-", align: "text-left", className: "whitespace-nowrap" },
      { key: "risk_id", header: "Risk ID", accessor: (row) => row.risk_id || "-", align: "text-center", className: "whitespace-nowrap" },
      { key: "risk_description", header: "Risk Description", accessor: (row) => row.risk_description || "-", align: "text-left", wrap: true },
      { key: "risk_details", header: "Risk Details", accessor: (row) => row.risk_details || "-", align: "text-left", wrap: true },
      { key: "owners", header: "Owner", accessor: (row) => row.owners || "-", align: "text-left", wrap: true },
      { key: "ap_code", header: "AP Code", accessor: (row) => row.ap_code || "-", align: "text-center", className: "whitespace-nowrap" },
      { key: "substantive_test", header: "Substantive Test", accessor: (row) => row.substantive_test || "-", align: "text-left", wrap: true },
      { key: "objective", header: "Objective", accessor: (row) => row.objective || "-", align: "text-left", wrap: true },
      { key: "procedures", header: "Procedures", accessor: (row) => row.procedures || "-", align: "text-left", wrap: true },
      { key: "method", header: "Method", accessor: (row) => row.method || "-", align: "text-left", wrap: true },
      { key: "description", header: "Description", accessor: (row) => row.description || "-", align: "text-left", wrap: true },
      { key: "application", header: "Application", accessor: (row) => row.application || "-", align: "text-left", wrap: true },
      { key: "risk", header: "Risk", accessor: (row) => (row.risk !== undefined && row.risk !== null && row.risk !== "" ? String(row.risk) : "-"), align: "text-center" },
      { key: "check_yn", header: "Check (Y/N)", accessor: (row) => row.check_yn || "-", align: "text-center", className: "whitespace-nowrap" },
      { key: "preparer", header: "Preparer", accessor: (row) => row.preparer || "-", align: "text-left", wrap: true },
      { key: "finding_result", header: "Finding Result", accessor: (row) => row.finding_result || "-", align: "text-left", wrap: true },
      { key: "finding_description", header: "Finding Description", accessor: (row) => row.finding_description || "-", align: "text-left", wrap: true },
      { key: "recommendation", header: "Recommendation", accessor: (row) => row.recommendation || "-", align: "text-left", wrap: true },
      { key: "auditee", header: "Auditee", accessor: (row) => row.auditee || "-", align: "text-left", wrap: true },
      { key: "completion_status", header: "Completion Status", accessor: (row) => row.completion_status || "-", align: "text-left", className: "whitespace-nowrap" },
      { key: "completion_date", header: "Completion Date", accessor: (row) => formatDate(row.completion_date), align: "text-center", className: "whitespace-nowrap" },
    ],
    [formatDate]
  );

  // Group data by department (dan di dalamnya masih dipisah per audit period)
  const groupedByDepartment = useMemo(() => {
    const groups = {};

    data.forEach((row) => {
      const dept = row.department || "Unknown";
      const periodKey = `${row.period_start || "no-start"}_${row.period_end || "no-end"}`;

      if (!groups[dept]) {
        groups[dept] = {
          department: dept,
          periods: {},
          total: 0,
        };
      }

      if (!groups[dept].periods[periodKey]) {
        groups[dept].periods[periodKey] = {
          period_start: row.period_start,
          period_end: row.period_end,
          data: [],
        };
      }

      groups[dept].periods[periodKey].data.push(row);
      groups[dept].total += 1;
    });

    return groups;
  }, [data]);

  const departmentEntries = useMemo(
    () => Object.entries(groupedByDepartment),
    [groupedByDepartment]
  );

  const selectedPeriodGroup = useMemo(() => {
    if (!selectedGroup) return null;
    const { deptName, periodKey } = selectedGroup;
    const deptGroup = groupedByDepartment[deptName];
    if (!deptGroup) return null;
    const periodGroup = deptGroup?.periods?.[periodKey];
    if (!periodGroup) return null;
    return { deptName, deptGroup, periodGroup };
  }, [groupedByDepartment, selectedGroup]);
  const deferredSelectedRows = useDeferredValue(selectedPeriodGroup?.periodGroup?.data || []);

  const modalTableRows = useMemo(() => {
    return deferredSelectedRows.map((row, idx) => (
      <tr
        key={`${row.department}-${row.id || idx}`}
        className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
      >
        {reportColumns.map((column) => (
          <td
            key={column.key}
            className={`px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 align-top ${column.align || "text-left"} ${column.className || ""}`}
            style={
              column.wrap
                ? { overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }
                : undefined
            }
            title={column.wrap ? column.accessor(row) : undefined}
          >
            {column.accessor(row)}
          </td>
        ))}
      </tr>
    ));
  }, [deferredSelectedRows, reportColumns]);

  const openModal = (deptName, periodKey) => {
    setSelectedGroup({ deptName, periodKey });
  };

  const closeModal = () => {
    setSelectedGroup(null);
  };

  const handleBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/Page/audit-finding";
  }, []);

  const exportRowsToExcel = (rows, filenameSuffix = "All", periodStart = null, periodEnd = null) => {
    const headers = reportColumns.map((column) => column.header);

    const excelRows = rows.map((row) =>
      reportColumns.reduce((acc, column) => {
        acc[column.header] = column.accessor(row);
        return acc;
      }, {})
    );

    // Gunakan util umum exportToStyledExcel (data, columns, status, componentName, date, periodStart, periodEnd)
    exportToStyledExcel(
      excelRows,
      headers,
      "Published",
      `Audit Finding - ${filenameSuffix}`,
      new Date(),
      periodStart,
      periodEnd
    );
  };

  // Simple PDF export via print dialog (user can "Save as PDF")
  const exportRowsToPdf = (rows, title = "Audit Finding Report") => {
    if (!rows || rows.length === 0) return;

    const popup = window.open("", "_blank", "width=1200,height=800");
    if (!popup) return;

    const style = `
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; }
        h1 { font-size: 18px; margin-bottom: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; vertical-align: top; }
        th { background: #f3f4f6; }
      </style>
    `;

    const headerHtml = `
      <tr>
        ${reportColumns.map((column) => `<th>${column.header}</th>`).join("")}
      </tr>
    `;

    const bodyHtml = rows
      .map((row) => {
        return `
          <tr>
            ${reportColumns.map((column) => `<td>${column.accessor(row)}</td>`).join("")}
          </tr>
        `;
      })
      .join("");

    popup.document.write(`
      <html>
        <head>
          <title>${title}</title>
          ${style}
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead>${headerHtml}</thead>
            <tbody>${bodyHtml}</tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    popup.document.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-full mx-auto">
        <div className="mb-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        {/* Header (tanpa tombol export global) */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AUDIT FINDING REPORT</h1>
              <p className="text-gray-600 mt-1">Report columns now follow the audit finding table data.</p>
            </div>
          </div>
        </div>

        {/* Grouped by Department */}
        {Object.keys(groupedByDepartment).length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-semibold text-gray-600">No Data</p>
              <p className="text-sm text-gray-400 mt-1">No audit finding data available</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {departmentEntries.map(([deptName, group]) => {
              const periodEntries = Object.entries(group.periods);
              return (
                <div key={deptName} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  {/* Department Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">Department: {deptName}</h3>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                            {group.total} findings
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          This section shows all published findings for <span className="font-semibold">{deptName}</span>, grouped by audit period.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Period chips for this department */}
                  <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2">
                    {periodEntries.map(([periodKey, period]) => (
                      <button
                        key={periodKey}
                        onClick={() => openModal(deptName, periodKey)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-blue-50 text-xs text-gray-800 rounded-full border border-gray-200 shadow-sm transition-colors"
                      >
                        <span className="font-semibold text-blue-700">View data</span>
                        <span className="text-[11px] text-gray-500">({period.data.length} findings)</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Popup: detail per department + period */}
        {selectedPeriodGroup && (() => {
          const { deptName, periodGroup } = selectedPeriodGroup;
          return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="bg-white/95 rounded-2xl shadow-2xl max-w-[95vw] max-h-[90vh] w-full overflow-hidden flex flex-col border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 p-4 flex items-center justify-between shadow-md">
                <div>
                  <h2 className="text-xl font-bold text-white">Audit Finding Details</h2>
                  <p className="text-sm text-blue-100 mt-1">
                    {deptName} &middot; {formatDate(periodGroup.period_start)} - {formatDate(periodGroup.period_end)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportRowsToExcel(
                        periodGroup.data,
                        `${deptName}`,
                        periodGroup.period_start,
                        periodGroup.period_end
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400/90 hover:bg-emerald-300 text-white shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M6 5h12" />
                    </svg>
                    Export Excel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportRowsToPdf(periodGroup.data, `Audit Finding Report - ${deptName}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-400/90 hover:bg-red-300 text-white shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m6-7H9a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V9l-4-5z" />
                    </svg>
                    Export PDF
                  </button>
                  <button
                    onClick={closeModal}
                    className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4 bg-slate-50">
                <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <span className="font-semibold">Audit period:</span> {formatDate(periodGroup.period_start)} - {formatDate(periodGroup.period_end)}
                  <span className="mx-2 text-blue-300">|</span>
                  <span className="font-semibold">Published date:</span> {formatDate(periodGroup.data?.[0]?.fieldwork_end)}
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-[2200px] w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        {reportColumns.map((column) => (
                          <th
                            key={column.key}
                            className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200"
                          >
                            {column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{modalTableRows}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
        })()}
      </div>
    </div>
  );
}

