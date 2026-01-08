"use client";
import { useEffect, useState, useCallback } from "react";

export default function WorksheetReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const loadData = useCallback(async () => {
    // Map department untuk API endpoint
    const departmentMap = {
      'FINANCE': '/api/worksheet/finance',
      'ACCOUNTING': '/api/worksheet/accounting',
      'HRD': '/api/worksheet/hrd',
      'G&A': '/api/worksheet/g&a',
      'DESIGN STORE PLANNER': '/api/worksheet/sdp',
      'TAX': '/api/worksheet/tax',
      'SECURITY L&P': '/api/worksheet/l&p',
      'MIS': '/api/worksheet/mis',
      'MERCHANDISE': '/api/worksheet/merch',
      'OPERATIONAL': '/api/worksheet/ops',
      'WAREHOUSE': '/api/worksheet/whs',
    };
    setLoading(true);
    setError(null);
    try {
      // Load data dari semua department yang tersedia
      const allData = [];
      const departments = Object.keys(departmentMap);
      
      for (const dept of departments) {
        try {
          const endpoint = departmentMap[dept];
          const res = await fetch(endpoint);
          const json = await res.json();
          
          if (res.ok && json.success && Array.isArray(json.rows)) {
            // Tambahkan department name ke setiap row
            json.rows.forEach(row => {
              allData.push({
                ...row,
                department: dept,
              });
            });
          }
        } catch (err) {
          // Skip jika API tidak tersedia untuk department tertentu
          console.log(`API not available for ${dept}`);
        }
      }

      // Sort by department and created_at
      allData.sort((a, b) => {
        if (a.department !== b.department) {
          return a.department.localeCompare(b.department);
        }
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      setData(allData);
    } catch (err) {
      console.error("Load report error:", err);
      setError(String(err));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleView = (row) => {
    setSelectedRow(row);
    setViewOpen(true);
  };

  return (
    <div className="flex flex-col">
      <div className="p-4">
        {loading && <div className="text-sm text-gray-600 mb-4">Memuat data...</div>}
        {error && <div className="text-sm text-red-600 mb-4">Gagal memuat data: {error}</div>}

        <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm mt-4">
          <table className="min-w-full table-fixed border-collapse text-xs">
            {/* --- Column Widths --- */}
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>

            {/* --- HEADER --- */}
            <thead>
              <tr className="bg-gray-100">
                {[
                  "Department",
                  "Preparer",
                  "Reviewer",
                  "Preparer Date",
                  "Reviewer Date",
                  "Status Documents",
                  "Status Worksheet",
                  "Status WP",
                  "Audit Area",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            {/* --- BODY --- */}
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={`${row.department}-${row.id || idx}`}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                >
                  {/* Department */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap font-semibold">
                    {row.department || row.department_name || "-"}
                  </td>

                  {/* Preparer */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                    {row.preparer || row.preparer_name || "-"}
                  </td>

                  {/* Reviewer */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                    {row.reviewer || row.reviewer_name || "-"}
                  </td>

                  {/* Preparer Date */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.preparer_date 
                      ? new Date(row.preparer_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                      : row.date1 || "-"}
                  </td>

                  {/* Reviewer Date */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.reviewer_date 
                      ? new Date(row.reviewer_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                      : row.date2 || "-"}
                  </td>

                  {/* Status Documents */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.status_documents || row.statusDocuments || "-"}
                  </td>

                  {/* Status Worksheet */}
                  <td
                    className={`p-1 text-xs text-center border border-gray-200 font-semibold ${
                      row.status_worksheet === "COMPLETED" || row.statusWorksheet === "COMPLETED"
                        ? "bg-green-100 text-green-800"
                        : row.status_worksheet === "IN PROGRESS" || row.statusWorksheet === "IN PROGRESS"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {row.status_worksheet || row.statusWorksheet || "-"}
                  </td>

                  {/* Status WP */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.status_wp || row.statusWP || "-"}
                  </td>

                  {/* Audit Area */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                    {row.audit_area || row.auditArea || "-"}
                  </td>

                  {/* Action - View button */}
                  <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                    <button
                      className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs hover:bg-blue-100"
                      onClick={() => handleView(row)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-sm text-gray-600">
                    Belum ada data worksheet yang disimpan. Silakan save data di worksheet terlebih dahulu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal View Data */}
      {viewOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg w-[min(900px,95vw)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">Worksheet Data Detail</h3>
              <button
                className="text-gray-600 hover:text-gray-800"
                onClick={() => {
                  setViewOpen(false);
                  setSelectedRow(null);
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-800">
              {/* Data Summary */}
              <div className="mb-4">
                <h4 className="font-semibold text-gray-700 mb-2">Worksheet Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
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
                    <div className="font-semibold text-gray-700 text-xs">Preparer Date</div>
                    <div className="text-sm">
                      {selectedRow.preparer_date 
                        ? new Date(selectedRow.preparer_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                        : selectedRow.date1 || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Reviewer Date</div>
                    <div className="text-sm">
                      {selectedRow.reviewer_date 
                        ? new Date(selectedRow.reviewer_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                        : selectedRow.date2 || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Status Documents</div>
                    <div className="text-sm">{selectedRow.status_documents || selectedRow.statusDocuments || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Status Worksheet</div>
                    <div className="text-sm">{selectedRow.status_worksheet || selectedRow.statusWorksheet || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Status WP</div>
                    <div className="text-sm">{selectedRow.status_wp || selectedRow.statusWP || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Audit Area</div>
                    <div className="text-sm">{selectedRow.audit_area || selectedRow.auditArea || "-"}</div>
                  </div>
                </div>
              </div>

              {/* File Section */}
              {(selectedRow.file_path || selectedRow.filePath) && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Uploaded File</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">File Name:</div>
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
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end px-4 py-3 border-t">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-sm hover:bg-gray-300"
                onClick={() => {
                  setViewOpen(false);
                  setSelectedRow(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

