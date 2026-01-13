"use client";
import { useEffect, useState, useCallback } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import SmallSidebar from "@/app/components/layout/SmallSidebar";

export default function EvidenceReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const loadData = useCallback(async () => {
    // Map department untuk API endpoint
    const departmentMap = {
      'FINANCE': '/api/evidence/finance',
      'ACCOUNTING': '/api/evidence/accounting',
      'OPERATIONAL': '/api/evidence/ops',
      // Add more departments as they are implemented
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
          const res = await fetch(`${endpoint}?department=${dept}`);
          const json = await res.json();
          
          if (res.ok && json.success && Array.isArray(json.data)) {
            // Tambahkan department name ke setiap row
            json.data.forEach(row => {
              allData.push({
                ...row,
                department: dept,
              });
            });
          }
        } catch (err) {
          // Skip jika API tidak tersedia untuk department tertentu
          console.log(`API not available for ${dept}:`, err);
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
    <main className="flex flex-row w-full h-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="EVIDENCE REPORT" showSearch={false} />
        <div className="mt-12 ml-14 flex-1 p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-[95%] mx-auto border border-gray-200">
            {loading && <div className="text-sm text-gray-600 mb-4">Memuat data...</div>}
            {error && <div className="text-sm text-red-600 mb-4">Gagal memuat data: {error}</div>}

            <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm mt-4">
              <table className="min-w-full table-fixed border-collapse text-xs">
                {/* --- Column Widths --- */}
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>

                {/* --- HEADER --- */}
                <thead>
                  <tr className="bg-[#141D38] text-white">
                    {[
                      "Department",
                      "Preparer",
                      "AP Code",
                      "Substantive Test",
                      "File Name",
                      "Overall Status",
                      "Created Date",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="p-2 text-center text-xs font-semibold border border-gray-300"
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
                        {row.department || "-"}
                      </td>

                      {/* Preparer */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                        {row.preparer || "-"}
                      </td>

                      {/* AP Code */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap font-medium">
                        {row.ap_code || "-"}
                      </td>

                      {/* Substantive Test */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                        {row.substantive_test || "-"}
                      </td>

                      {/* File Name */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words align-top">
                        {row.file_name ? (
                          <span className="text-blue-600 font-medium">{row.file_name}</span>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* Overall Status */}
                      <td
                        className={`p-1 text-xs text-center border border-gray-200 font-semibold whitespace-nowrap ${
                          row.overall_status === "COMPLETE"
                            ? "bg-yellow-200 text-yellow-900"
                            : row.overall_status === "INCOMPLETE"
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {row.overall_status || "-"}
                      </td>

                      {/* Created Date */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                        {row.created_at 
                          ? new Date(row.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "-"}
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
                      <td colSpan={8} className="p-4 text-center text-sm text-gray-600">
                        Belum ada data evidence yang disimpan. Silakan save data di evidence department terlebih dahulu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal View Data */}
      {viewOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg w-[min(900px,95vw)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">Evidence Data Detail</h3>
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
                <h4 className="font-semibold text-gray-700 mb-2">Evidence Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Department</div>
                    <div className="text-sm">{selectedRow.department || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Preparer</div>
                    <div className="text-sm">{selectedRow.preparer || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">AP Code</div>
                    <div className="text-sm font-medium">{selectedRow.ap_code || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Overall Status</div>
                    <div className="text-sm">
                      <span
                        className={`px-2 py-1 rounded font-semibold ${
                          selectedRow.overall_status === "COMPLETE"
                            ? "bg-yellow-200 text-yellow-900"
                            : selectedRow.overall_status === "INCOMPLETE"
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedRow.overall_status || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="font-semibold text-gray-700 text-xs">Substantive Test</div>
                    <div className="text-sm mt-1">{selectedRow.substantive_test || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Created Date</div>
                    <div className="text-sm">
                      {selectedRow.created_at 
                        ? new Date(selectedRow.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Updated Date</div>
                    <div className="text-sm">
                      {selectedRow.updated_at 
                        ? new Date(selectedRow.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* File Section */}
              {(selectedRow.file_url || selectedRow.file_name) && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Uploaded File</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">File Name:</div>
                        <div className="text-sm text-gray-700 mb-2">{selectedRow.file_name || "N/A"}</div>
                        {selectedRow.file_url && (
                          <a
                            href={selectedRow.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline break-all font-medium text-sm"
                          >
                            {selectedRow.file_url}
                          </a>
                        )}
                      </div>
                      {selectedRow.file_url && (
                        <a
                          href={selectedRow.file_url}
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
                      )}
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
    </main>
  );
}

