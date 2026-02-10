"use client";

import { useState, useMemo, useCallback } from "react";

export default function ReportClient({ initialRows, initialScheduleData }) {
  const [rows, setRows] = useState(initialRows);
  const [scheduleData] = useState(initialScheduleData);
  
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

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
    if (!scheduleData.length) return null;
    const deptId = getScheduleDepartmentId(deptName);
    if (!deptId) return null;
    return scheduleData.find((s) => s.department_id === deptId) || null;
  }, [scheduleData]);

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr || dateStr === "#####") return "#####";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "#####";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
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
      alert("Harap pilih Start dan End date!");
      return;
    }
    if (new Date(tempPeriodStartDate) > new Date(tempPeriodEndDate)) {
      alert("Start date tidak boleh lebih besar dari End date!");
      return;
    }

    // Bound Audit Period selection to Main Schedule dates (audit fieldwork window)
    if (selectedScheduleBounds.min && tempPeriodStartDate < selectedScheduleBounds.min) {
      alert(`Audit Period Start must be on/after ${selectedScheduleBounds.min}`);
      return;
    }
    if (selectedScheduleBounds.max && tempPeriodEndDate > selectedScheduleBounds.max) {
      alert(`Audit Period End must be on/before ${selectedScheduleBounds.max}`);
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
        alert("Gagal menyimpan data: " + (data.error || "Unknown error"));
        return;
      }

      // Update local state without full reload
      setRows((prev) =>
        prev.map((r) =>
          r.apiPath === selectedApiPath
            ? { ...r, audit_period_start: tempPeriodStartDate, audit_period_end: tempPeriodEndDate }
            : r
        )
      );
      setPeriodDatePickerOpen(false);
      alert("✅ Audit Period dates berhasil disimpan!");
    } catch (err) {
      console.error("Error saving audit period:", err);
      alert("❌ Error menyimpan data: " + err.message);
    }
  };

  const tableItems = useMemo(() => {
    return rows.map((r) => {
      const meta = r.meta || {};
      const schedule = getScheduleForDepartment(r.department);
        const hasSteps = Array.isArray(r.steps) && r.steps.length > 0;
      return {
        apiPath: r.apiPath,
        audit_period_start: formatDateForDisplay(r.audit_period_start),
        audit_period_end: formatDateForDisplay(r.audit_period_end),
        audit_fieldwork_start: schedule ? formatDateForDisplay(schedule.start_date) : "#####",
        audit_fieldwork_end: schedule ? formatDateForDisplay(schedule.end_date) : "#####",
        department: r.department,
          sop_available: hasSteps ? "AVAILABLE" : "Not Available",
        preparer: meta.preparer_name || "-",
        preparer_completion_date: meta.preparer_date ? String(meta.preparer_date).slice(0, 10) : "-",
        sop_preparer_status: meta.preparer_status || "DRAFT",
        reviewer: meta.reviewer_name || "-",
        sop_reviewer_status: meta.reviewer_status || "DRAFT",
        reviewer_date: meta.reviewer_date ? String(meta.reviewer_date).slice(0, 10) : "-",
        reviewer_comments: meta.reviewer_comment || "",
        _detail: { meta: r.meta, steps: r.steps, department: r.department },
      };
    });
  }, [rows, getScheduleForDepartment]);

  const handleView = (row) => {
    if (!row?._detail?.steps || row._detail.steps.length === 0) {
      alert(`Data belum ada. Silakan publish data terlebih dahulu di halaman ${row.department} SOP Review.`);
      return;
    }
    setSelectedDetail(row._detail);
    setViewOpen(true);
  };

  return (
    <>
      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-blue-50/50 border-b border-slate-200">
                {[
                  "Audit Period Start",
                  "Audit Period End",
                  "Audit Fieldwork Start",
                  "Audit Fieldwork End",
                  "Department",
                  "SOP Available",
                  "Preparer",
                  "Preparer Completion Date",
                  "SOP Preparer Status",
                  "Reviewer",
                  "SOP Reviewer Status",
                  "Reviewer Date",
                  "SOP Reviewer Comments",
                  "Action",
                ].map((h) => (
                  <th key={h} className="p-3 text-center text-xs font-bold text-slate-700 border-r border-slate-200/60 sticky top-0 bg-gradient-to-r from-slate-100 to-blue-50/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {tableItems.map((row, idx) => {
                const getStatusBadge = (status) => {
                  const statusUpper = (status || "DRAFT").toUpperCase();
                  if (statusUpper === "APPROVED") return "bg-green-100 text-green-800 border-green-200";
                  if (statusUpper === "REJECTED") return "bg-red-100 text-red-800 border-red-200";
                  if (statusUpper === "IN REVIEW") return "bg-blue-100 text-blue-800 border-blue-200";
                  return "bg-yellow-100 text-yellow-800 border-yellow-200";
                };

                return (
                  <tr key={`${row.department}-${idx}`} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-blue-50/30 transition-colors duration-150`}>
                    <td
                      className="p-2 text-xs text-slate-800 border-r border-slate-200/60 text-center whitespace-nowrap cursor-pointer hover:bg-blue-100/50 transition-colors"
                      onClick={() => openPeriodDatePicker(row.apiPath, rows.find((r) => r.apiPath === row.apiPath)?.audit_period_start, rows.find((r) => r.apiPath === row.apiPath)?.audit_period_end)}
                      title="Klik untuk mengatur Audit Period dates"
                    >
                      {row.audit_period_start !== "#####" ? (
                        <span className="font-medium">{row.audit_period_start}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Klik untuk set</span>
                      )}
                    </td>
                    <td
                      className="p-2 text-xs text-slate-800 border-r border-slate-200/60 text-center whitespace-nowrap cursor-pointer hover:bg-blue-100/50 transition-colors"
                      onClick={() => openPeriodDatePicker(row.apiPath, rows.find((r) => r.apiPath === row.apiPath)?.audit_period_start, rows.find((r) => r.apiPath === row.apiPath)?.audit_period_end)}
                      title="Klik untuk mengatur Audit Period dates"
                    >
                      {row.audit_period_end !== "#####" ? (
                        <span className="font-medium">{row.audit_period_end}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Klik untuk set</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-center whitespace-nowrap">
                      {row.audit_fieldwork_start !== "#####" ? (
                        <span className="font-medium">{row.audit_fieldwork_start}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-center whitespace-nowrap">
                      {row.audit_fieldwork_end !== "#####" ? (
                        <span className="font-medium">{row.audit_fieldwork_end}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-2 text-xs font-semibold text-slate-800 border-r border-slate-200/60 text-center whitespace-nowrap">{row.department || "-"}</td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                        row.sop_available === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {row.sop_available || "-"}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-left break-words whitespace-pre-wrap align-top">{row.preparer || "-"}</td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-center">{row.preparer_completion_date || "-"}</td>
                    <td className={`p-2 text-xs text-center border-r border-slate-200/60 font-semibold rounded ${getStatusBadge(row.sop_preparer_status)}`}>
                      {row.sop_preparer_status || "DRAFT"}
                    </td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-left break-words whitespace-pre-wrap align-top">{row.reviewer || "-"}</td>
                    <td className={`p-2 text-xs text-center border-r border-slate-200/60 font-semibold rounded ${getStatusBadge(row.sop_reviewer_status)}`}>
                      {row.sop_reviewer_status || "DRAFT"}
                    </td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-center">{row.reviewer_date || "-"}</td>
                    <td className="p-2 text-xs text-slate-700 border-r border-slate-200/60 text-left whitespace-pre-wrap break-words align-top max-w-xs">
                      {row.reviewer_comments ? (
                        <span className="line-clamp-2">{row.reviewer_comments}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-slate-800 border-r border-slate-200/60 text-center">
                      {row._detail?.steps?.length > 0 ? (
                        <button
                          className="px-3 py-1.5 bg-blue-600 text-white border border-blue-700 rounded-lg text-xs font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow-md transform hover:scale-105"
                          onClick={() => handleView(row)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {tableItems.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">Belum ada data</div>
                      <div className="text-xs text-slate-500">Silakan publish SOP Review per department terlebih dahulu.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Detail Modal */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[min(1000px,95vw)] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Published Data Detail</h3>
                  <p className="text-xs text-slate-600">{selectedDetail?.department || "Department"}</p>
                </div>
              </div>
              <button
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"
                onClick={() => { setViewOpen(false); setSelectedDetail(null); }}
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {!selectedDetail?.steps?.length ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <div className="text-red-600 font-semibold mb-2 text-lg">Data belum ada</div>
                  <div className="text-slate-600">Silakan publish data terlebih dahulu di halaman SOP Review departemen terkait.</div>
                </div>
              ) : (
                <>
                  {selectedDetail?.meta && (
                    <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">📊</span>
                        Sidebar Data
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Department</div>
                          <div className="text-sm font-medium text-slate-800">{selectedDetail.meta.department_name || selectedDetail.department || "-"}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">SOP Status</div>
                          <div className="text-sm font-medium text-slate-800">{selectedDetail.meta.sop_status || "-"}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Preparer</div>
                          <div className="text-sm font-medium text-slate-800">{selectedDetail.meta.preparer_name || "-"}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Preparer Date</div>
                          <div className="text-sm font-medium text-slate-800">{selectedDetail.meta.preparer_date ? String(selectedDetail.meta.preparer_date).slice(0, 10) : "-"}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Preparer Status</div>
                          <div className={`text-sm font-semibold inline-block px-2 py-1 rounded ${
                            selectedDetail.meta.preparer_status === "APPROVED" ? "bg-green-100 text-green-800" :
                            selectedDetail.meta.preparer_status === "REJECTED" ? "bg-red-100 text-red-800" :
                            selectedDetail.meta.preparer_status === "IN REVIEW" ? "bg-blue-100 text-blue-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {selectedDetail.meta.preparer_status || "-"}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Reviewer</div>
                          <div className="text-sm font-medium text-slate-800">{selectedDetail.meta.reviewer_name || "-"}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Reviewer Date</div>
                          <div className="text-sm font-medium text-slate-800">{selectedDetail.meta.reviewer_date ? String(selectedDetail.meta.reviewer_date).slice(0, 10) : "-"}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Reviewer Status</div>
                          <div className={`text-sm font-semibold inline-block px-2 py-1 rounded ${
                            selectedDetail.meta.reviewer_status === "APPROVED" ? "bg-green-100 text-green-800" :
                            selectedDetail.meta.reviewer_status === "REJECTED" ? "bg-red-100 text-red-800" :
                            selectedDetail.meta.reviewer_status === "IN REVIEW" ? "bg-blue-100 text-blue-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {selectedDetail.meta.reviewer_status || "-"}
                          </div>
                        </div>
                        <div className="md:col-span-2 bg-white p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-600 text-xs mb-1">Reviewer Comment</div>
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">{selectedDetail.meta.reviewer_comment || "-"}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center text-green-600">📝</span>
                      SOP Steps (Published Data)
                    </h4>
                    <div className="overflow-auto border border-slate-200 rounded-xl">
                      <table className="min-w-full text-xs border-collapse">
                        <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0">
                          <tr>
                            <th className="p-3 border-r border-slate-200 text-left font-bold text-slate-700">No</th>
                            <th className="p-3 border-r border-slate-200 text-left font-bold text-slate-700">SOP Related</th>
                            <th className="p-3 border-r border-slate-200 text-left font-bold text-slate-700">Status</th>
                            <th className="p-3 border-r border-slate-200 text-left font-bold text-slate-700">Reviewer</th>
                            <th className="p-3 text-left font-bold text-slate-700">Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDetail.steps.map((step, idx) => {
                            const getStatusBadge = (status) => {
                              const statusUpper = (status || "DRAFT").toUpperCase();
                              if (statusUpper === "APPROVED") return "bg-green-100 text-green-800";
                              if (statusUpper === "REJECTED") return "bg-red-100 text-red-800";
                              if (statusUpper === "IN REVIEW") return "bg-blue-100 text-blue-800";
                              return "bg-yellow-100 text-yellow-800";
                            };
                            return (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                <td className="p-2 border-r border-slate-200 font-medium">{step.no || idx + 1}</td>
                                <td className="p-2 border-r border-slate-200">{step.sop_related || "-"}</td>
                                <td className="p-2 border-r border-slate-200">
                                  <span className={`px-2 py-1 rounded text-[10px] font-semibold ${getStatusBadge(step.status)}`}>
                                    {step.status || "DRAFT"}
                                  </span>
                                </td>
                                <td className="p-2 border-r border-slate-200">{step.reviewer || "-"}</td>
                                <td className="p-2 whitespace-pre-wrap break-words">{step.comment || "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Period Date Picker Modal */}
      {periodDatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[min(500px,95vw)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">📅</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Set Audit Period Dates</h3>
              </div>
              <button
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"
                onClick={() => setPeriodDatePickerOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Audit Period Start</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={tempPeriodStartDate}
                  onChange={(e) => setTempPeriodStartDate(e.target.value)}
                  min={selectedScheduleBounds.min}
                  max={selectedScheduleBounds.max}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Audit Period End</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={tempPeriodEndDate}
                  onChange={(e) => setTempPeriodEndDate(e.target.value)}
                  min={tempPeriodStartDate || undefined}
                  max={selectedScheduleBounds.max}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                  onClick={() => setPeriodDatePickerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
                  onClick={saveAuditPeriod}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

