"use client";

import { useEffect, useMemo, useState } from "react";

function normalizeRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((item, index) => ({
    no: index + 1,
    id: item.id,
    riskId: item.risk_id || "",
    riskDescription: item.risk_description || "",
    riskDetails: item.risk_details || "",
    apCode: item.ap_code || "",
    substantiveTest: item.substantive_test || "",
    objective: item.objective || "",
    procedures: item.procedures || "",
    description: item.description || "",
    application: item.application || "",
    owners: item.owners || "",
    risk: item.risk ?? "",
    checkYN: item.check_yn || "",
    method: item.method || "",
    preparer: item.preparer || "",
    findingResult: item.finding_result || "",
    findingDescription: item.finding_description || "",
    recommendation: item.recommendation || "",
    auditee: item.auditee || "",
    completionStatus: item.completion_status || "",
    completionDate: item.completion_date ? String(item.completion_date).slice(0, 10) : "",
  }));
}

export default function AuditFindingDeptClient({
  apiPath,
  titleCode,
  departmentLabel,
  description,
  initialData = [],
}) {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Header inputs (kept like the old pages; table remains read-only)
  const storageKey = `auditFindingHeaderState:${apiPath}`;
  const [preparerStatus, setPreparerStatus] = useState("");
  const [finalStatus, setFinalStatus] = useState("");
  const [findingResult, setFindingResult] = useState("");
  const [findingResultFileName, setFindingResultFileName] = useState("");
  const [reportAs, setReportAs] = useState("");
  const [prepare, setPrepare] = useState("");
  const [prepareDate, setPrepareDate] = useState("");
  const [review, setReview] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  const [tableData, setTableData] = useState(() => normalizeRows(initialData));
  const [isEditMode, setIsEditMode] = useState(false); // Global edit mode for all rows
  const [isScheduleConfigured, setIsScheduleConfigured] = useState(false); // Schedule configuration status

  const statusOptions = useMemo(
    () => [
      { value: "", label: "- Select -" },
      { value: "COMPLETED", label: "COMPLETED" },
      { value: "DRAFT", label: "DRAFT" },
      { value: "IN PROGRESS", label: "IN PROGRESS" },
      { value: "PENDING REVIEW", label: "PENDING REVIEW" },
      { value: "APPROVED", label: "APPROVED" },
    ],
    []
  );

  const yesNoOptions = useMemo(
    () => [
      { value: "", label: "-" },
      { value: "Yes", label: "Yes" },
      { value: "No", label: "No" },
    ],
    []
  );

  // Restore header inputs per-department
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPreparerStatus(parsed.preparerStatus ?? "");
      setFinalStatus(parsed.finalStatus ?? "");
      setFindingResult(parsed.findingResult ?? "");
      setFindingResultFileName(parsed.findingResultFileName ?? "");
      setReportAs(parsed.reportAs ?? "");
      setPrepare(parsed.prepare ?? "");
      setPrepareDate(parsed.prepareDate ?? "");
      setReview(parsed.review ?? "");
      setReviewDate(parsed.reviewDate ?? "");
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  // Persist header inputs per-department
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          preparerStatus,
          finalStatus,
          findingResult,
          findingResultFileName,
          reportAs,
          prepare,
          prepareDate,
          review,
          reviewDate,
        })
      );
    } catch {
      // ignore
    }
  }, [
    storageKey,
    preparerStatus,
    finalStatus,
    findingResult,
    findingResultFileName,
    reportAs,
    prepare,
    prepareDate,
    review,
    reviewDate,
  ]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to fetch data");
      setTableData(normalizeRows(json.data));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Check if schedule is configured for this department
  useEffect(() => {
    const checkSchedule = async () => {
      try {
        // Map apiPath to department_id for schedule
        const apiPathToDeptId = {
          'finance': 'A1.1',
          'accounting': 'A1.2',
          'hrd': 'A1.3',
          'g&a': 'A1.4',
          'ga': 'A1.4',
          'sdp': 'A1.5',
          'tax': 'A1.6',
          'l&p': 'A1.7',
          'lp': 'A1.7',
          'mis': 'A1.8',
          'merch': 'A1.9',
          'ops': 'A1.10',
          'whs': 'A1.11',
        };

        const deptId = apiPathToDeptId[apiPath];
        if (!deptId) {
          console.warn(`No department_id mapping for apiPath: ${apiPath}`);
          setIsScheduleConfigured(false);
          return;
        }

        const res = await fetch(`/api/schedule/module?module=audit-finding`, {
          next: { revalidate: 30 },
        });
        
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.rows)) {
            const scheduleRow = json.rows.find(row => 
              row.department_id === deptId && row.is_configured === true
            );
            setIsScheduleConfigured(!!scheduleRow);
          } else {
            setIsScheduleConfigured(false);
          }
        } else {
          setIsScheduleConfigured(false);
        }
      } catch (err) {
        console.warn("Error checking schedule:", err);
        setIsScheduleConfigured(false);
      }
    };

    checkSchedule();
  }, [apiPath]);

  useEffect(() => {
    // keep client in sync if server data changes / refresh
    setTableData(normalizeRows(initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  // Handle cell edit
  const handleCellEdit = (rowIndex, field, value) => {
    const updated = [...tableData];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setTableData(updated);
  };

  // Handle toggle edit mode
  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // Handle cancel edit mode
  const handleCancelEdit = async () => {
    setIsEditMode(false);
    await fetchData(); // Reload data to discard changes
  };

  // Handle publish (user will click manually, not auto publish)
  // When published, data will automatically appear in report
  const handlePublish = async () => {
    // Check if schedule is configured
    if (!isScheduleConfigured) {
      alert("Sorry, no schedule");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Double-check schedule before publishing
      const apiPathToDeptId = {
        'finance': 'A1.1',
        'accounting': 'A1.2',
        'hrd': 'A1.3',
        'g&a': 'A1.4',
        'ga': 'A1.4',
        'sdp': 'A1.5',
        'tax': 'A1.6',
        'l&p': 'A1.7',
        'lp': 'A1.7',
        'mis': 'A1.8',
        'merch': 'A1.9',
        'ops': 'A1.10',
        'whs': 'A1.11',
      };
      
      const deptId = apiPathToDeptId[apiPath];
      if (deptId) {
        const scheduleRes = await fetch(`/api/schedule/module?module=audit-finding`, {
          next: { revalidate: 0 },
        });
        
        if (scheduleRes.ok) {
          const scheduleJson = await scheduleRes.json();
          if (scheduleJson.success && Array.isArray(scheduleJson.rows)) {
            const scheduleRow = scheduleJson.rows.find(row => 
              row.department_id === deptId && row.is_configured === true
            );
            
            if (!scheduleRow) {
              alert("Sorry, no schedule");
              setLoading(false);
              return;
            }
          } else {
            alert("Sorry, no schedule");
            setLoading(false);
            return;
          }
        } else {
          alert("Sorry, no schedule");
          setLoading(false);
          return;
        }
      }
      
      // Publish all findings for this department
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to publish findings");
      
      // Show success message and redirect to report
      alert(`Successfully published! Data is now available in Report.`);
      
      // Redirect to report page
      window.location.href = "/Page/audit-finding/report";
    } catch (e) {
      setError(e?.message || String(e));
      alert(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Save cell changes to backend
  const handleCellSave = async (rowIndex) => {
    const row = tableData[rowIndex];
    if (!row) return;

    try {
      setLoading(true);
      setError(null);

      if (row.id) {
        // Update existing
        const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riskId: row.riskId,
            riskDescription: row.riskDescription,
            riskDetails: row.riskDetails,
            apCode: row.apCode,
            substantiveTest: row.substantiveTest,
            risk: row.risk,
            checkYN: row.checkYN,
            method: row.method,
            preparer: row.preparer,
            findingResult: row.findingResult,
            findingDescription: row.findingDescription,
            recommendation: row.recommendation,
            auditee: row.auditee,
            completionStatus: row.completionStatus,
            completionDate: row.completionDate,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to update data");
      } else {
        // Create new
        const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riskId: row.riskId,
            riskDescription: row.riskDescription,
            riskDetails: row.riskDetails,
            apCode: row.apCode,
            substantiveTest: row.substantiveTest,
            risk: row.risk,
            checkYN: row.checkYN,
            method: row.method,
            preparer: row.preparer,
            findingResult: row.findingResult,
            findingDescription: row.findingDescription,
            recommendation: row.recommendation,
            auditee: row.auditee,
            completionStatus: row.completionStatus,
            completionDate: row.completionDate,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to save data");
      }
      
      await fetchData();
      setEditingCell(null);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFindingResultFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFindingResultFileName(file.name);
  };

  const handleRemoveRow = async (index) => {
    const row = tableData[index];
    // If no ID, this is data from audit-program (not yet saved as finding), so can't delete
    if (!row?.id) {
      alert("This data is from Audit Program. To remove it, you need to save it as a finding first, then delete it.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete row");
      await fetchData();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Save all changes to backend
  const handleSaveAllChanges = async () => {
    try {
      setLoading(true);
      setError(null);

      // Save all rows that have been modified or are new
      for (const row of tableData) {
        if (row.id) {
          // Update existing
          const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              riskId: row.riskId,
              riskDescription: row.riskDescription,
              riskDetails: row.riskDetails,
              apCode: row.apCode,
              substantiveTest: row.substantiveTest,
              risk: row.risk,
              checkYN: row.checkYN,
              method: row.method,
              preparer: row.preparer,
              findingResult: row.findingResult,
              findingDescription: row.findingDescription,
              recommendation: row.recommendation,
              auditee: row.auditee,
              completionStatus: row.completionStatus,
              completionDate: row.completionDate,
            }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json?.error || "Failed to update data");
          }
        } else if (row.riskId || row.riskDescription || row.apCode || row.risk || row.checkYN || row.preparer || row.findingResult || row.findingDescription || row.recommendation || row.auditee || row.completionStatus || row.completionDate) {
          // Create new if has some data (including editable columns)
          const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              riskId: row.riskId,
              riskDescription: row.riskDescription,
              riskDetails: row.riskDetails,
              apCode: row.apCode,
              substantiveTest: row.substantiveTest,
              risk: row.risk,
              checkYN: row.checkYN,
              method: row.method,
              preparer: row.preparer,
              findingResult: row.findingResult,
              findingDescription: row.findingDescription,
              recommendation: row.recommendation,
              auditee: row.auditee,
              completionStatus: row.completionStatus,
              completionDate: row.completionDate,
            }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json?.error || "Failed to save data");
          }
        }
      }

      setIsEditMode(false);
      await fetchData();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      {/* Header collapse toggle */}
      <div className="fixed z-40 top-3 right-4">
        <button
          onClick={() => setIsHeaderCollapsed((v) => !v)}
          className="w-11 h-9 flex items-center justify-center rounded-full shadow-md hover:shadow-lg border border-slate-300 bg-white/95 text-sm font-semibold text-slate-700 transition-all duration-300 transform hover:scale-110 active:scale-95"
          title={isHeaderCollapsed ? "Show header" : "Hide header"}
        >
          {isHeaderCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Fixed Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 bg-gradient-to-br from-white via-slate-50/95 to-blue-50/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xl transition-all duration-700 ease-out ${
          isHeaderCollapsed ? "transform -translate-y-full opacity-0 scale-95" : "transform translate-y-0 opacity-100 scale-100"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div
            className={`px-6 py-4 transition-all duration-500 delay-200 ${
              isHeaderCollapsed ? "opacity-0 transform translate-y-2" : "opacity-100 transform translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
                      {titleCode} AUDIT FINDING
                    </h1>
                    <span className="px-2.5 py-0.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                      {departmentLabel}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">{description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Header inputs section (restored) */}
        <div className="max-w-7xl mx-auto">
          <div className="px-6 pb-5">
            <div className="space-y-4">
              {/* Status cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-800">PREPARER STATUS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={preparerStatus}
                      onChange={(e) => setPreparerStatus(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="px-3 py-2 text-xs font-bold rounded-lg shadow-sm bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-300">
                      {preparerStatus || "Not Set"}
                    </span>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-800">FINAL STATUS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={finalStatus}
                      onChange={(e) => setFinalStatus(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="px-3 py-2 text-xs font-bold rounded-lg shadow-sm bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-300">
                      {finalStatus || "Not Set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Finding details */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-slate-200/50 shadow-md">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Finding Details</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">FINDING RESULT</label>
                    {reportAs === "attachment file" ? (
                      <div className="space-y-2">
                        <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          Choose File
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleFindingResultFileSelect}
                            accept=".xlsx,.xls,.pdf,.doc,.docx"
                          />
                        </label>
                        {findingResultFileName && (
                          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="text-xs font-medium text-blue-700 truncate">{findingResultFileName}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={findingResult}
                        onChange={(e) => setFindingResult(e.target.value)}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Enter finding result"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">REPORT AS</label>
                    <select
                      value={reportAs}
                      onChange={(e) => setReportAs(e.target.value)}
                      className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    >
                      <option value="">- Select -</option>
                      <option value="on this sheet">On This Sheet</option>
                      <option value="attachment file">Attachment File</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">PREPARE</label>
                      <input
                        type="text"
                        value={prepare}
                        onChange={(e) => setPrepare(e.target.value)}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">DATE</label>
                      <input
                        type="date"
                        value={prepareDate}
                        onChange={(e) => setPrepareDate(e.target.value)}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">REVIEW</label>
                      <input
                        type="text"
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">DATE</label>
                      <input
                        type="date"
                        value={reviewDate}
                        onChange={(e) => setReviewDate(e.target.value)}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div
        className={`px-3 sm:px-4 pb-4 flex flex-col h-full transition-all duration-500 ease-in-out ${
          isHeaderCollapsed ? "pt-16" : "pt-32"
        }`}
      >
        {/* Header above table (requested) */}
        <div className="mb-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">{titleCode} AUDIT FINDING</div>
            <div className="text-lg font-bold text-slate-900">{departmentLabel}</div>
            <div className="text-sm text-slate-600">{description}</div>
          </div>
        </div>

        {/* Toolbar above table */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-900">{tableData.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                    loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                  title="Cancel Edit"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAllChanges}
                  disabled={loading}
                  className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                    loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                  title="Save All Changes"
                >
                  {loading ? "Saving..." : "Save All"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleToggleEditMode}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                  title="Edit Mode"
                >
                  Edit
                </button>
            <button
              onClick={handlePublish}
              disabled={loading || !isScheduleConfigured}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                loading || !isScheduleConfigured
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
              title={!isScheduleConfigured ? "Schedule not configured" : "Publish"}
            >
              {loading ? "Publishing..." : "Publish"}
            </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4">
          <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "40px" }}>NO</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "80px" }}>RISK ID</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "150px" }}>RISK DESCRIPTION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "180px" }}>RISK DETAILS</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "100px" }}>OWNER</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "90px" }}>AP CODE</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "130px" }}>SUBSTANTIVE TEST</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "180px" }}>OBJECTIVE</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "200px" }}>PROCEDURES</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "130px" }}>METHOD</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "180px" }}>DESCRIPTION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "120px" }}>APPLICATION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "60px" }}>RISK</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "80px" }}>CHECK (Y/N)</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "100px" }}>PREPARER</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "130px" }}>FINDING RESULT</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "200px" }}>FINDING DESCRIPTION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "200px" }}>RECOMMENDATION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "100px" }}>AUDITEE</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "120px" }}>COMPLETION STATUS</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "120px" }}>COMPLETION DATE</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="p-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-gray-600">No Data</p>
                        <p className="text-sm text-gray-400 mt-1">No findings available</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, index) => {
                    const isFromAuditProgram = !row.id && !isEditMode; // Data from audit-program doesn't have id, but can be edited if in edit mode
                    const isEditing = isEditMode; // All rows can be edited when edit mode is on
                    return (
                    <tr key={row.id || `new-${index}`} className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.no}</td>
                      {/* RISK ID - Always read-only */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.riskId || "-"}</td>
                      {/* RISK DESCRIPTION - Always read-only */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.riskDescription || undefined}>
                        {row.riskDescription || "-"}
                      </td>
                      {/* RISK DETAILS - Always read-only */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.riskDetails || undefined}>
                        {row.riskDetails || "-"}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} title={row.owners || undefined}>
                        {row.owners || "-"}
                      </td>
                      {/* AP CODE - Always read-only */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.apCode || "-"}</td>
                      {/* SUBSTANTIVE TEST - Always read-only */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.substantiveTest || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.objective || undefined}>
                        {row.objective || "-"}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.procedures || undefined}>
                        {row.procedures || "-"}
                      </td>
                      {/* METHOD - Always read-only */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.method || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.description || undefined}>
                        {row.description || "-"}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} title={row.application || undefined}>
                        {row.application || "-"}
                      </td>
                      {/* RISK - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <input
                            type="number"
                            value={row.risk !== "" ? String(row.risk) : ""}
                            onChange={(e) => handleCellEdit(index, "risk", e.target.value)}
                            className="w-full p-1 text-xs text-center border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="-"
                            min="0"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.risk !== "" ? String(row.risk) : "-"}</td>
                      )}
                      {/* CHECK (Y/N) - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <select
                            value={row.checkYN || ""}
                            onChange={(e) => handleCellEdit(index, "checkYN", e.target.value)}
                            className="w-full p-1 text-xs text-center border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {yesNoOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.checkYN || "-"}</td>
                      )}
                      {/* PREPARER - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <input
                            type="text"
                            value={row.preparer || ""}
                            onChange={(e) => handleCellEdit(index, "preparer", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="-"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.preparer || "-"}</td>
                      )}
                      {/* FINDING RESULT - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <input
                            type="text"
                            value={row.findingResult || ""}
                            onChange={(e) => handleCellEdit(index, "findingResult", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="-"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.findingResult || "-"}</td>
                      )}
                      {/* FINDING DESCRIPTION - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <textarea
                            value={row.findingDescription || ""}
                            onChange={(e) => handleCellEdit(index, "findingDescription", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            rows={2}
                            placeholder="-"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.findingDescription || undefined}>
                          {row.findingDescription || "-"}
                        </td>
                      )}
                      {/* RECOMMENDATION - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <textarea
                            value={row.recommendation || ""}
                            onChange={(e) => handleCellEdit(index, "recommendation", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            rows={2}
                            placeholder="-"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }} title={row.recommendation || undefined}>
                          {row.recommendation || "-"}
                        </td>
                      )}
                      {/* AUDITEE - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <input
                            type="text"
                            value={row.auditee || ""}
                            onChange={(e) => handleCellEdit(index, "auditee", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="-"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.auditee || "-"}</td>
                      )}
                      {/* COMPLETION STATUS - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <select
                            value={row.completionStatus || ""}
                            onChange={(e) => handleCellEdit(index, "completionStatus", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.completionStatus || "-"}</td>
                      )}
                      {/* COMPLETION DATE - Editable when in edit mode */}
                      {isEditing ? (
                        <td className="p-1 border border-gray-200 align-top">
                          <input
                            type="date"
                            value={row.completionDate || ""}
                            onChange={(e) => handleCellEdit(index, "completionDate", e.target.value)}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      ) : (
                        <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{row.completionDate || "-"}</td>
                      )}
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}


