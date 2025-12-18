"use client";
import { useEffect, useState } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";

export default function ReportSOP() {
  const [meta, setMeta] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  // audit period dates (bisa di-edit di report page)
  const [auditPeriodStart, setAuditPeriodStart] = useState("#####");
  const [auditPeriodEnd, setAuditPeriodEnd] = useState("#####");
  const [periodDatePickerOpen, setPeriodDatePickerOpen] = useState(false);
  const [tempPeriodStartDate, setTempPeriodStartDate] = useState("");
  const [tempPeriodEndDate, setTempPeriodEndDate] = useState("");

  // schedule data untuk audit fieldwork (read-only dari schedule page)
  const [scheduleData, setScheduleData] = useState([]);

  // Load audit period data from API
  const loadAuditPeriodData = async () => {
    try {
      const res = await fetch("/api/SopReview/finance/audit-period");
      const data = await res.json();
      if (data.success && data.rows && data.rows.length > 0) {
        const period = data.rows[0];
        if (period.audit_period_start) {
          setAuditPeriodStart(period.audit_period_start);
        }
        if (period.audit_period_end) {
          setAuditPeriodEnd(period.audit_period_end);
        }
      }
    } catch (err) {
      console.error("Error loading audit period data:", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metaRes, stepsRes] = await Promise.all([
        fetch("/api/SopReview/finance/meta"),
        fetch("/api/SopReview/finance"),
      ]);
      const [metaJson, stepsJson] = await Promise.all([
        metaRes.json().catch(() => ({})),
        stepsRes.json().catch(() => ({})),
      ]);

      if (metaRes.ok && Array.isArray(metaJson.rows) && metaJson.rows.length > 0) {
        setMeta(metaJson.rows[0]); // Ambil data terbaru dari database
      } else {
        setMeta(null); // Pastikan null jika tidak ada data
      }

      if (stepsRes.ok && Array.isArray(stepsJson.rows) && stepsJson.rows.length > 0) {
        const normalized = stepsJson.rows.map((r, idx) => ({
          no: r.no ?? idx + 1,
          sop_related: r.sop_related || "",
          status: r.status || "DRAFT",
          comment: r.comment || "",
          reviewer: r.reviewer || "",
        }));
        setSteps(normalized); // Ambil data dari database
      } else {
        setSteps([]); // Pastikan empty array jika tidak ada data
      }

      if ((!metaRes.ok || !stepsRes.ok)) {
        const msg = metaJson?.error || stepsJson?.error || `HTTP ${metaRes.status}/${stepsRes.status}`;
        setError(msg);
      }
    } catch (err) {
      console.error("Load report error:", err);
      setError(String(err));
      setMeta(null);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  const loadScheduleData = async () => {
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      if (data.success && data.rows) {
        setScheduleData(data.rows);
      }
    } catch (err) {
      console.error("Error loading schedule data:", err);
    }
  };

  useEffect(() => {
    loadData();
    loadScheduleData();
    loadAuditPeriodData();
    // Refresh setiap 5 detik untuk update data terbaru
    const interval = setInterval(() => {
      loadData();
      loadScheduleData();
      loadAuditPeriodData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Map department name to schedule department_id
  const getScheduleDepartmentId = (deptName) => {
    const deptMap = {
      "FINANCE": "A1.1",
      "ACCOUNTING": "A1.2",
      "HRD": "A1.3",
      "HUMAN RESOURCES": "A1.3",
      "G&A": "A1.4",
      "GENERAL AFFAIR": "A1.4",
      "SDP": "A1.5",
      "STORE DESIGN & PLANNER": "A1.5",
      "TAX": "A1.6",
      "L&P": "A1.7",
      "SECURITY": "A1.7",
      "MIS": "A1.8",
      "MERCHANDISE": "A1.9",
      "OPERATIONAL": "A1.10",
      "WAREHOUSE": "A1.11",
    };
    return deptMap[deptName?.toUpperCase()] || null;
  };

  // Get schedule data for current department (untuk Audit Fieldwork)
  const getScheduleForDepartment = () => {
    if (!meta || !scheduleData.length) return null;
    const deptName = meta.department_name?.toUpperCase() || "FINANCE";
    const deptId = getScheduleDepartmentId(deptName);
    if (!deptId) return null;
    return scheduleData.find((s) => s.department_id === deptId);
  };

  const scheduleForDept = getScheduleForDepartment();

  // Format date from YYYY-MM-DD to display format
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  };

  // Handle Audit Period date picker (bisa di-edit)
  const handlePeriodDatePickerOpen = () => {
    // Convert display format (DD-MMM-YY) to input format (YYYY-MM-DD) if needed
    let startDate = auditPeriodStart !== "#####" ? auditPeriodStart : "";
    let endDate = auditPeriodEnd !== "#####" ? auditPeriodEnd : "";
    
    // If date is in display format, convert to input format
    if (startDate && startDate.includes("-") && startDate.length <= 11) {
      const parts = startDate.split("-");
      if (parts.length === 3) {
        const monthMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };
        const month = monthMap[parts[1]] || "01";
        const year = "20" + parts[2];
        startDate = `${year}-${month}-${parts[0].padStart(2, "0")}`;
      }
    }
    
    if (endDate && endDate.includes("-") && endDate.length <= 11) {
      const parts = endDate.split("-");
      if (parts.length === 3) {
        const monthMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };
        const month = monthMap[parts[1]] || "01";
        const year = "20" + parts[2];
        endDate = `${year}-${month}-${parts[0].padStart(2, "0")}`;
      }
    }
    
    setTempPeriodStartDate(startDate);
    setTempPeriodEndDate(endDate);
    setPeriodDatePickerOpen(true);
  };

  const handlePeriodDatePickerSave = async () => {
    if (!tempPeriodStartDate || !tempPeriodEndDate) {
      alert("Harap pilih Start dan End date!");
      return;
    }
    if (new Date(tempPeriodStartDate) > new Date(tempPeriodEndDate)) {
      alert("Start date tidak boleh lebih besar dari End date!");
      return;
    }

    try {
      const res = await fetch("/api/SopReview/finance/audit-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_period_start: tempPeriodStartDate,
          audit_period_end: tempPeriodEndDate,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAuditPeriodStart(tempPeriodStartDate);
        setAuditPeriodEnd(tempPeriodEndDate);
        setPeriodDatePickerOpen(false);
        alert("Audit Period dates berhasil disimpan!");
      } else {
        alert("Gagal menyimpan data: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error saving audit period:", err);
      alert("Error menyimpan data: " + err.message);
    }
  };

  // Build rows from sidebar data (meta) - HANYA 1 baris dari data sidebar
  // Tidak ada SOP Sheet, karena itu akan muncul di modal View
  const items = meta ? [{
    // Audit Period - bisa di-edit di report page
    audit_period_start: auditPeriodStart !== "#####" 
      ? formatDateForDisplay(auditPeriodStart) 
      : "#####",
    audit_period_end: auditPeriodEnd !== "#####" 
      ? formatDateForDisplay(auditPeriodEnd) 
      : "#####",
    // Audit Fieldwork - read-only dari schedule page
    audit_fieldwork_start: scheduleForDept 
      ? formatDateForDisplay(scheduleForDept.start_date) 
      : "#####",
    audit_fieldwork_end: scheduleForDept 
      ? formatDateForDisplay(scheduleForDept.end_date) 
      : "#####",
    department: meta.department_name?.toUpperCase() || "FINANCE",
    sop_available: meta.sop_status || "Available",
    preparer: meta.preparer_name || "-",
    preparer_completion_date: meta.preparer_date ? String(meta.preparer_date).slice(0, 10) : "0",
    sop_preparer_status: meta.preparer_status || "DRAFT",
    reviewer: meta.reviewer_name || "0",
    sop_reviewer_status: meta.reviewer_status || "DRAFT",
    reviewer_date: meta.reviewer_date ? String(meta.reviewer_date).slice(0, 10) : "0",
    reviewer_comments: meta.reviewer_comment || "",
  }] : []; // Return empty array jika tidak ada data sidebar

  const handleView = (row) => {
    if (!steps || steps.length === 0) {
      alert("Data belum ada. Silakan publish data terlebih dahulu di halaman Finance SOP Review.");
      return;
    }
    setSelectedRow(row);
    setViewOpen(true);
  };

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  };

  return (
    <div className="flex flex-col">
      <SmallHeader label="Report SOP" />
      <div className="p-4">
        {loading && <div className="text-sm text-gray-600 mb-4">Memuat data publish terakhir...</div>}
        {error && <div className="text-sm text-red-600 mb-4">Gagal memuat data: {error}</div>}


        <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm mt-4">
          <table className="min-w-full table-fixed border-collapse text-xs">
            {/* --- Column Widths --- */}
            <colgroup>
              <col style={{ width: "10%" }} />  
              <col style={{ width: "10%" }} />  
              <col style={{ width: "10%" }} />  
              <col style={{ width: "8%" }} /> 
              <col style={{ width: "10%" }} /> 
              <col style={{ width: "8%" }} /> 
              <col style={{ width: "9%" }} /> 
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} /> 
              <col style={{ width: "8%" }} /> 
              <col style={{ width: "15%" }} />
              <col style={{ width: "7%" }} />
            </colgroup>

            {/* --- HEADER --- */}
            <thead>
              <tr className="bg-gray-100">
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
            {items.map((row, idx) => (
              <tr
                key={idx}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
              >
                {/* Audit Period Start - Clickable untuk edit */}
                <td 
                  className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap cursor-pointer hover:bg-blue-50"
                  onClick={handlePeriodDatePickerOpen}
                  title="Klik untuk mengatur Audit Period dates"
                >
                  {row.audit_period_start !== "#####" ? row.audit_period_start : (
                    <span className="text-gray-400 italic">Klik untuk set</span>
                  )}
                </td>

                {/* Audit Period End - Clickable untuk edit */}
                <td 
                  className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap cursor-pointer hover:bg-blue-50"
                  onClick={handlePeriodDatePickerOpen}
                  title="Klik untuk mengatur Audit Period dates"
                >
                  {row.audit_period_end !== "#####" ? row.audit_period_end : (
                    <span className="text-gray-400 italic">Klik untuk set</span>
                  )}
                </td>

                {/* Audit Fieldwork Start - Read only, data dari schedule */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                  {row.audit_fieldwork_start !== "#####" ? row.audit_fieldwork_start : (
                    <span className="text-gray-400 italic">-</span>
                  )}
                </td>

                {/* Audit Fieldwork End - Read only, data dari schedule */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                  {row.audit_fieldwork_end !== "#####" ? row.audit_fieldwork_end : (
                    <span className="text-gray-400 italic">-</span>
                  )}
                </td>

                {/* Department */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                  {row.department || "-"}
                </td>

                {/* SOP Available */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                  {row.sop_available || "-"}
                </td>

                {/* Preparer */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                  {row.preparer || "-"}
                </td>

                {/* Preparer Completion Date */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                  {row.preparer_completion_date || "-"}
                </td>

                {/* SOP PREPARER STATUS (warna sesuai Excel) */}
                <td
                  className={`p-1 text-xs text-center border border-gray-200 font-semibold ${
                    row.sop_preparer_status === "COMPLETED"
                      ? "bg-green-100 text-green-800"
                      : row.sop_preparer_status === "IN PROGRESS"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {row.sop_preparer_status || "-"}
                </td>

                {/* Reviewer */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                  {row.reviewer || "-"}
                </td>

                {/* Reviewer Status (selalu DRAFT merah) */}
                <td className="p-1 text-xs text-center border border-gray-200 font-semibold bg-red-100 text-red-800">
                  {row.sop_reviewer_status || "DRAFT"}
                </td>

                {/* Reviewer Date */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                  {row.reviewer_date || "-"}
                </td>

                {/* Comments */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left whitespace-pre-wrap break-words align-top">
                  {row.reviewer_comments || ""}
                </td>

                {/* Action - View button (only show if steps published) */}
                <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                  {steps && steps.length > 0 ? (
                    <button
                      className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs hover:bg-blue-100"
                      onClick={() => handleView(row)}
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={14} className="p-4 text-center text-sm text-gray-600">
                  Belum ada data sidebar yang disimpan. Silakan save data di sidebar terlebih dahulu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal View Published Data */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[min(900px,95vw)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">Published Data Detail</h3>
              <button className="text-gray-600" onClick={() => { setViewOpen(false); setSelectedRow(null); }}>✕</button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-800">
              {!steps || steps.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-red-600 font-semibold mb-2">Data belum ada</div>
                  <div className="text-gray-600">Silakan publish data terlebih dahulu di halaman Finance SOP Review.</div>
                </div>
              ) : (
                <>
                  {/* Sidebar Data Summary */}
                  {meta && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-700 mb-2">Sidebar Data</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
                        <div><div className="font-semibold text-gray-700 text-xs">Department</div><div className="text-sm">{meta.department_name || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">SOP Status</div><div className="text-sm">{meta.sop_status || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Preparer</div><div className="text-sm">{meta.preparer_name || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Preparer Date</div><div className="text-sm">{meta.preparer_date ? String(meta.preparer_date).slice(0, 10) : "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Preparer Status</div><div className="text-sm">{meta.preparer_status || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Reviewer</div><div className="text-sm">{meta.reviewer_name || "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Reviewer Date</div><div className="text-sm">{meta.reviewer_date ? String(meta.reviewer_date).slice(0, 10) : "-"}</div></div>
                        <div><div className="font-semibold text-gray-700 text-xs">Reviewer Status</div><div className="text-sm">{meta.reviewer_status || "-"}</div></div>
                        <div className="md:col-span-2"><div className="font-semibold text-gray-700 text-xs">Reviewer Comment</div><div className="text-sm">{meta.reviewer_comment || "-"}</div></div>
                      </div>
                    </div>
                  )}

                  {/* SOP Steps Table */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">SOP Steps (Published Data)</h4>
                    <div className="overflow-auto border rounded">
                      <table className="min-w-full text-xs border-collapse">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 border text-left font-semibold">No</th>
                            <th className="p-2 border text-left font-semibold">SOP Related</th>
                            <th className="p-2 border text-left font-semibold">Status</th>
                            <th className="p-2 border text-left font-semibold">Reviewer</th>
                            <th className="p-2 border text-left font-semibold">Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {steps.map((step, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-2 border">{step.no || idx + 1}</td>
                              <td className="p-2 border">{step.sop_related || "-"}</td>
                              <td className="p-2 border">{step.status || "DRAFT"}</td>
                              <td className="p-2 border">{step.reviewer || "-"}</td>
                              <td className="p-2 border whitespace-pre-wrap break-words">{step.comment || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end px-4 py-3 border-t">
              <button className="px-3 py-1 rounded bg-gray-200 text-sm" onClick={() => { setViewOpen(false); setSelectedRow(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker Modal untuk Audit Period */}
      {periodDatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[min(500px,95vw)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Set Audit Period Dates</h3>
              <button className="text-gray-600" onClick={() => setPeriodDatePickerOpen(false)}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Audit Period Start</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={tempPeriodStartDate}
                  onChange={(e) => setTempPeriodStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Audit Period End</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={tempPeriodEndDate}
                  onChange={(e) => setTempPeriodEndDate(e.target.value)}
                  min={tempPeriodStartDate || undefined}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  className="px-4 py-2 rounded bg-gray-200 text-sm hover:bg-gray-300"
                  onClick={() => setPeriodDatePickerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                  onClick={handlePeriodDatePickerSave}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  </div>
  );
}
