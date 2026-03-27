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
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center whitespace-nowrap">
          {formatDate(row.fieldwork_start)}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center whitespace-nowrap">
          {formatDate(row.fieldwork_end)}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center whitespace-nowrap">
          {formatDate(row.period_start)}
        </td>
        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
          {formatDate(row.period_end)}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left whitespace-nowrap">
          {row.department || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center whitespace-nowrap">
          {row.risk_id || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left align-top break-words" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
          {row.risk_details || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center">
          {row.risk || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center whitespace-nowrap">
          {row.ap_code || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
          {row.substantive_test || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-center">
          {row.check_yn || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
          {row.method || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">
          {row.preparer || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left bg-green-50">
          {row.finding_result || "-"}
        </td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left bg-green-50">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left bg-yellow-50">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left bg-yellow-50">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left bg-yellow-50">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">-</td>
        <td className="px-2.5 py-1.5 text-[11px] text-gray-800 border border-gray-200 text-left">
          {row.completion_status || "-"}
        </td>
      </tr>
    ));
  }, [deferredSelectedRows, formatDate]);

  const openModal = (deptName, periodKey) => {
    setSelectedGroup({ deptName, periodKey });
  };

  const closeModal = () => {
    setSelectedGroup(null);
  };

  const exportRowsToExcel = (rows, filenameSuffix = "All", periodStart = null, periodEnd = null) => {
    const headers = [
      "Audit Fieldwork Start",
      "Audit Fieldwork End",
      "Audit Period Start",
      "Audit Period End",
      "Department",
      "Risk Sheet",
      "Risk ID",
      "Risk Detail",
      "Risk Level",
      "Risk Value",
      "Audit Program Sheet",
      "Audit Program No (AP No.)",
      "Substantive Test Conduct",
      "WP Sheet",
      "Risk Audit Check",
      "Sampling Method",
      "Preparer",
      "Finding Result",
      "Finding Status",
      "Working Paper Sheet Reference",
      "Working Paper Status",
      "Working Paper Date",
      "Evidence Sheet Reference",
      "Evidence Status",
      "Reviewer Status",
      "Follow Up Status",
    ];

    const excelRows = rows.map((row) => ({
      "Audit Fieldwork Start": formatDate(row.fieldwork_start),
      "Audit Fieldwork End": formatDate(row.fieldwork_end),
      "Audit Period Start": formatDate(row.period_start),
      "Audit Period End": formatDate(row.period_end),
      Department: row.department || "-",
      "Risk Sheet": "-",
      "Risk ID": row.risk_id || "-",
      "Risk Detail": row.risk_details || "-",
      "Risk Level": "-",
      "Risk Value": row.risk || "-",
      "Audit Program Sheet": "-",
      "Audit Program No (AP No.)": row.ap_code || "-",
      "Substantive Test Conduct": row.substantive_test || "-",
      "WP Sheet": "-",
      "Risk Audit Check": row.check_yn || "-",
      "Sampling Method": row.method || "-",
      Preparer: row.preparer || "-",
      "Finding Result": row.finding_result || "-",
      "Finding Status": "-",
      "Working Paper Sheet Reference": "-",
      "Working Paper Status": "-",
      "Working Paper Date": "-",
      "Evidence Sheet Reference": "-",
      "Evidence Status": "-",
      "Reviewer Status": "-",
      "Follow Up Status": row.completion_status || "-",
    }));

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
        <th>Audit Fieldwork Start</th>
        <th>Audit Fieldwork End</th>
        <th>Audit Period Start</th>
        <th>Audit Period End</th>
        <th>Department</th>
        <th>Risk ID</th>
        <th>Risk Detail</th>
        <th>Risk Value</th>
        <th>AP No.</th>
        <th>Substantive Test Conduct</th>
        <th>Preparer</th>
        <th>Finding Result</th>
        <th>Follow Up Status</th>
      </tr>
    `;

    const bodyHtml = rows
      .map((row) => {
        return `
          <tr>
            <td>${formatDate(row.fieldwork_start)}</td>
            <td>${formatDate(row.fieldwork_end)}</td>
            <td>${formatDate(row.period_start)}</td>
            <td>${formatDate(row.period_end)}</td>
            <td>${row.department || "-"}</td>
            <td>${row.risk_id || "-"}</td>
            <td>${row.risk_details || "-"}</td>
            <td>${row.risk ?? "-"}</td>
            <td>${row.ap_code || "-"}</td>
            <td>${row.substantive_test || "-"}</td>
            <td>${row.preparer || "-"}</td>
            <td>${row.finding_result || "-"}</td>
            <td>${row.completion_status || "-"}</td>
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
        {/* Header (tanpa tombol export global) */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AUDIT FINDING REPORT</h1>
              <p className="text-gray-600 mt-1">Comprehensive audit finding report with 24 columns</p>
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
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-[1300px] w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th colSpan={2} className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">
                          Audit Fieldwork
                        </th>
                        <th colSpan={2} className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">
                          Audit Period
                        </th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Department</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Risk Sheet</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Risk ID</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200">Risk Detail</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Risk Level</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Risk Value</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Audit Program Sheet</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Audit Program No (AP No.)</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200">Substantive Test Conduct</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">WP Sheet</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Risk Audit Check</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Sampling Method</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200">Preparer</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 bg-green-50 whitespace-nowrap">Finding Result</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 bg-green-50 whitespace-nowrap">Finding Status</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 bg-yellow-50 whitespace-nowrap">Working Paper Sheet Reference</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 bg-yellow-50 whitespace-nowrap">Working Paper Status</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 bg-yellow-50 whitespace-nowrap">Working Paper Date</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Evidence Sheet Reference</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Evidence Status</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Reviewer Status</th>
                        <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">Follow Up Status</th>
                      </tr>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">Start</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">End</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">Start</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">End</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-green-50"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-green-50"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-yellow-50"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-yellow-50"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-yellow-50"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"></th>
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

