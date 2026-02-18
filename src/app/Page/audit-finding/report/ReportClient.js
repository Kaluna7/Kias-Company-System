"use client";

import { useState, useMemo } from "react";
import { exportToStyledExcel } from "@/app/utils/exportExcel";

export default function ReportClient({ initialData = [] }) {
  const [data] = useState(initialData);
  const [selectedPeriod, setSelectedPeriod] = useState(null); // Store the period key for modal

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  // Group data by audit period
  const groupedByPeriod = useMemo(() => {
    const groups = {};
    
    data.forEach((row) => {
      const periodKey = `${row.period_start || 'no-start'}_${row.period_end || 'no-end'}`;
      if (!groups[periodKey]) {
        groups[periodKey] = {
          period_start: row.period_start,
          period_end: row.period_end,
          departments: new Set(),
          data: [],
        };
      }
      groups[periodKey].departments.add(row.department || 'Unknown');
      groups[periodKey].data.push(row);
    });

    // Convert Set to Array for each group
    Object.keys(groups).forEach((key) => {
      groups[key].departments = Array.from(groups[key].departments);
    });

    return groups;
  }, [data]);

  const openModal = (periodKey) => {
    setSelectedPeriod(periodKey);
  };

  const closeModal = () => {
    setSelectedPeriod(null);
  };

  const handleExport = () => {
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

    const rows = data.map((row) => [
      formatDate(row.fieldwork_start),
      formatDate(row.fieldwork_end),
      formatDate(row.period_start),
      formatDate(row.period_end),
      row.department || "-",
      "-", // Risk Sheet - to be filled from other sources
      row.risk_id || "-",
      row.risk_details || "-",
      "-", // Risk Level - to be filled from other sources
      row.risk || "-",
      "-", // Audit Program Sheet - to be filled from other sources
      row.ap_code || "-",
      row.substantive_test || "-",
      "-", // WP Sheet - to be filled from other sources
      row.check_yn || "-",
      row.method || "-",
      row.preparer || "-",
      row.finding_result || "-",
      "-", // Finding Status - to be filled from other sources
      "-", // Working Paper Sheet Reference - to be filled from other sources
      "-", // Working Paper Status - to be filled from other sources
      "-", // Working Paper Date - to be filled from other sources
      "-", // Evidence Sheet Reference - to be filled from other sources
      "-", // Evidence Status - to be filled from other sources
      "-", // Reviewer Status - to be filled from other sources
      row.completion_status || "-", // Follow Up Status
    ]);

    exportToStyledExcel({
      headers,
      rows,
      filename: "Audit_Finding_Report",
      sheetName: "Audit Finding Report",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AUDIT FINDING REPORT</h1>
              <p className="text-gray-600 mt-1">Comprehensive audit finding report with 24 columns</p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </button>
          </div>
        </div>

        {/* Grouped by Audit Period */}
        {Object.keys(groupedByPeriod).length === 0 ? (
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
            {Object.entries(groupedByPeriod).map(([periodKey, group]) => {
              return (
                <div key={periodKey} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  {/* Period Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">Audit Period</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Start:</span>
                            <span className="text-sm font-semibold text-gray-800">{formatDate(group.period_start)}</span>
                            <span className="text-sm text-gray-600 ml-4">End:</span>
                            <span className="text-sm font-semibold text-gray-800">{formatDate(group.period_end)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Departments:</span>
                          <div className="flex flex-wrap gap-2">
                            {group.departments.map((dept, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full border border-blue-200"
                              >
                                {dept}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm text-gray-500 ml-2">({group.data.length} findings)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(periodKey)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Popup */}
        {selectedPeriod && groupedByPeriod[selectedPeriod] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={closeModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[90vh] w-full overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Audit Period Details</h2>
                  <p className="text-sm text-blue-100 mt-1">
                    {formatDate(groupedByPeriod[selectedPeriod].period_start)} - {formatDate(groupedByPeriod[selectedPeriod].period_end)}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4">
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="min-w-[900px] w-full table-fixed border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th colSpan={2} className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">
                          Audit Fieldwork
                        </th>
                        <th colSpan={2} className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50">
                          Audit Period
                        </th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Department</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Risk Sheet</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Risk ID</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Risk Detail</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Risk Level</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Risk Value</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Audit Program Sheet</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Audit Program No (AP No.)</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Substantive Test Conduct</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">WP Sheet</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Risk Audit Check</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Sampling Method</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Preparer</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-green-50">Finding Result</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-green-50">Finding Status</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-yellow-50">Working Paper Sheet Reference</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-yellow-50">Working Paper Status</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-yellow-50">Working Paper Date</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Evidence Sheet Reference</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Evidence Status</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Reviewer Status</th>
                        <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">Follow Up Status</th>
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
                    <tbody>
                      {groupedByPeriod[selectedPeriod].data.map((row, idx) => (
                        <tr
                          key={`${row.department}-${row.id || idx}`}
                          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                        >
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {formatDate(row.fieldwork_start)}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {formatDate(row.fieldwork_end)}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {formatDate(row.period_start)}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {formatDate(row.period_end)}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left whitespace-nowrap">
                            {row.department || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {row.risk_id || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                            {row.risk_details || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                            {row.risk || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {row.ap_code || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                            {row.substantive_test || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                            {row.check_yn || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                            {row.method || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">
                            {row.preparer || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left bg-green-50">
                            {row.finding_result || "-"}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left bg-green-50">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left bg-yellow-50">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left bg-yellow-50">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left bg-yellow-50">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">-</td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left">
                            {row.completion_status || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

