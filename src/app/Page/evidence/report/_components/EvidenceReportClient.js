"use client";
import { useState, useMemo } from "react";

export default function EvidenceReportClient({ initialData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Group data by department and created_date (same date)
  const groupedData = useMemo(() => {
    const groups = {};
    
    data.forEach(row => {
      // Get date string (YYYY-MM-DD) for grouping
      const dateKey = row.created_at 
        ? new Date(row.created_at).toISOString().split('T')[0]
        : 'no-date';
      
      const groupKey = `${row.department}|||${dateKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          department: row.department,
          createdDate: row.created_at ? new Date(row.created_at) : null,
          dateKey: dateKey,
          preparer: row.preparer || "",
          overallStatus: row.overall_status || "",
          items: []
        };
      }
      
      groups[groupKey].items.push(row);
      
      // Update preparer and overall_status from latest item
      if (row.preparer) groups[groupKey].preparer = row.preparer;
      if (row.overall_status) groups[groupKey].overallStatus = row.overall_status;
    });
    
    // Convert to array and sort
    return Object.values(groups).sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      if (a.createdDate && b.createdDate) {
        return b.createdDate - a.createdDate;
      }
      return 0;
    });
  }, [data]);

  const loadData = async () => {
    // Map department untuk API endpoint
    const departmentMap = {
      'FINANCE': '/api/evidence/finance',
      'ACCOUNTING': '/api/evidence/accounting',
      'OPERATIONAL': '/api/evidence/ops',
      'HRD': '/api/evidence/hrd',
      'G&A': '/api/evidence/g&a',
      'SDP': '/api/evidence/sdp',
      'TAX': '/api/evidence/tax',
      'L&P': '/api/evidence/l&p',
      'MIS': '/api/evidence/mis',
      'MERCHANDISE': '/api/evidence/merch',
      'WAREHOUSE': '/api/evidence/whs',
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
            // Only include rows that have been saved as evidence (have id from evidence table)
            // The 'id' field indicates that this record exists in the evidence table
            json.data.forEach(row => {
              // Only include if it has been saved as evidence (has id from evidence table)
              // This means the user has clicked Save at least once
              if (row.id != null && row.ap_id && row.ap_code) {
                allData.push({
                  ...row,
                  // normalize: new API returns `attachment`, old one had `file_url`
                  file_url: row.file_url || row.attachment || "",
                  // meta is returned per department
                  preparer: row.preparer || json?.meta?.preparer || "",
                  overall_status: row.overall_status || json?.meta?.overall_status || "",
                  department: dept,
                });
              }
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
  };

  const handleView = (group) => {
    setSelectedGroup(group);
    setViewOpen(true);
  };

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      <div className="px-3 sm:px-4 pt-6 pb-4 flex flex-col h-full">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-700 font-semibold">B3.1 EVIDENCE REPORT</div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          {loading && <div className="text-sm text-gray-600 mb-4">Loading...</div>}
          {error && <div className="text-sm text-red-600 mb-4">Failed to load data: {error}</div>}

          {/* Grouped Data Display */}
          <div className="mt-4 space-y-4">
            {groupedData.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-gray-600">
                Belum ada data evidence yang disimpan. Silakan save data di evidence department terlebih dahulu.
              </div>
            )}
            
            {groupedData.map((group, groupIdx) => (
              <div
                key={`${group.department}-${group.dateKey}-${groupIdx}`}
                className="border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Group Header */}
                <div className="bg-gradient-to-r from-[#141D38] to-[#1a2744] text-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold">{group.department}</h3>
                        <span className="text-sm text-blue-200">
                          {group.createdDate 
                            ? group.createdDate.toLocaleDateString("en-GB", { 
                                day: "2-digit", 
                                month: "short", 
                                year: "numeric" 
                              })
                            : "No Date"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-300">
                          <span className="font-semibold">Preparer:</span> {group.preparer || "-"}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          group.overallStatus === "COMPLETE"
                            ? "bg-yellow-500 text-yellow-900"
                            : group.overallStatus === "INCOMPLETE"
                            ? "bg-gray-500 text-gray-900"
                            : "bg-gray-400 text-gray-900"
                        }`}>
                          {group.overallStatus || "-"}
                        </span>
                        <span className="text-gray-300">
                          <span className="font-semibold">Items:</span> {group.items.length}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleView(group)}
                      className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                {/* Group Summary Table */}
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="min-w-[480px] w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left font-semibold border border-gray-200">AP Code</th>
                        <th className="p-2 text-left font-semibold border border-gray-200">Substantive Test</th>
                        <th className="p-2 text-left font-semibold border border-gray-200">File Name</th>
                        <th className="p-2 text-center font-semibold border border-gray-200">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.slice(0, 5).map((item, idx) => (
                        <tr
                          key={`${item.ap_id}-${idx}`}
                          className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="p-2 border border-gray-200 font-medium">{item.ap_code || "-"}</td>
                          <td className="p-2 border border-gray-200">
                            <div className="max-w-xs truncate" title={item.substantive_test || "-"}>
                              {item.substantive_test || "-"}
                            </div>
                          </td>
                          <td className="p-2 border border-gray-200">
                            {item.file_name ? (
                              <span className="text-blue-600 font-medium">{item.file_name}</span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-2 border border-gray-200 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              item.status === "COMPLETE"
                                ? "bg-green-200 text-green-900"
                                : item.status === "IN PROGRESS"
                                ? "bg-yellow-200 text-yellow-900"
                                : "bg-gray-200 text-gray-800"
                            }`}>
                              {item.status || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {group.items.length > 5 && (
                        <tr>
                          <td colSpan={4} className="p-2 text-center text-gray-500 italic border border-gray-200">
                            ... and {group.items.length - 5} more items. Click &quot;View Details&quot; to see all.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal View Group Data */}
      {viewOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-lg w-[min(1200px,95vw)] max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedGroup.department} - Evidence Details
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Created Date: {selectedGroup.createdDate 
                      ? selectedGroup.createdDate.toLocaleDateString("en-GB", { 
                          day: "2-digit", 
                          month: "short", 
                          year: "numeric" 
                        })
                      : "No Date"} | Total Items: {selectedGroup.items.length}
                  </p>
                </div>
                <button
                  className="text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    setViewOpen(false);
                    setSelectedGroup(null);
                  }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Group Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Preparer</div>
                    <div className="text-sm mt-1">{selectedGroup.preparer || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Overall Status</div>
                    <div className="text-sm mt-1">
                      <span
                        className={`px-2 py-1 rounded font-semibold ${
                          selectedGroup.overallStatus === "COMPLETE"
                            ? "bg-yellow-200 text-yellow-900"
                            : selectedGroup.overallStatus === "INCOMPLETE"
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedGroup.overallStatus || "-"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Total Evidence Items</div>
                    <div className="text-sm mt-1 font-bold text-blue-600">{selectedGroup.items.length}</div>
                  </div>
                </div>
              </div>

              {/* All Items Table */}
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-[520px] w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#141D38] text-white">
                      <th className="p-2 text-left font-semibold border border-gray-300">AP Code</th>
                      <th className="p-2 text-left font-semibold border border-gray-300">Substantive Test</th>
                      <th className="p-2 text-left font-semibold border border-gray-300">File Name</th>
                      <th className="p-2 text-center font-semibold border border-gray-300">Status</th>
                      <th className="p-2 text-center font-semibold border border-gray-300">Updated Date</th>
                      <th className="p-2 text-center font-semibold border border-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.items.map((item, idx) => (
                      <tr
                        key={`${item.ap_id}-${item.id}-${idx}`}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="p-2 border border-gray-200 font-medium">{item.ap_code || "-"}</td>
                        <td className="p-2 border border-gray-200">
                          <div className="max-w-md break-words">{item.substantive_test || "-"}</div>
                        </td>
                        <td className="p-2 border border-gray-200">
                          {item.file_name ? (
                            <span className="text-blue-600 font-medium">{item.file_name}</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2 border border-gray-200 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            item.status === "COMPLETE"
                              ? "bg-green-200 text-green-900"
                              : item.status === "IN PROGRESS"
                              ? "bg-yellow-200 text-yellow-900"
                              : "bg-gray-200 text-gray-800"
                          }`}>
                            {item.status || "-"}
                          </span>
                        </td>
                        <td className="p-2 border border-gray-200 text-center whitespace-nowrap">
                          {item.updated_at 
                            ? new Date(item.updated_at).toLocaleDateString("en-GB", { 
                                day: "2-digit", 
                                month: "short", 
                                year: "numeric" 
                              })
                            : "-"}
                        </td>
                        <td className="p-2 border border-gray-200 text-center">
                          {item.file_url && (
                            <a
                              href={item.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs"
                            >
                              Open
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Files Section */}
              {selectedGroup.items.some(item => item.file_url || item.file_name) && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Uploaded Files</h4>
                  <div className="space-y-2">
                    {selectedGroup.items
                      .filter(item => item.file_url || item.file_name)
                      .map((item, idx) => (
                        <div key={`file-${item.ap_id}-${idx}`} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-medium text-blue-900 text-xs">AP Code: {item.ap_code || "-"}</div>
                              <div className="text-sm text-gray-700">{item.file_name || "N/A"}</div>
                              {item.file_url && (
                                <a
                                  href={item.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline break-all text-xs"
                                >
                                  {item.file_url}
                                </a>
                              )}
                            </div>
                            {item.file_url && (
                              <a
                                href={item.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex justify-end">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-sm hover:bg-gray-300"
                onClick={() => {
                  setViewOpen(false);
                  setSelectedGroup(null);
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

