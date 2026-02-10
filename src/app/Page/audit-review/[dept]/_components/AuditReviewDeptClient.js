"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";

// Default options for SELECT fields based on Executive Summary template
const OBJECTIVE_OPTIONS = [
  "Risk Management",
  "Control Evaluation",
  "Compliance",
  "Operational Efficiency",
  "Financial Accuracy",
  "Governance Support",
  "Fraud Prevention",
  "Strategic Alignment",
  "Follow-Up",
  "Reporting",
  "Continuous Improvement",
  "Training",
];

const SCOPE_AREAS_COVERED_OPTIONS = [
  "Financial Processes",
  "Operational Processes",
  "IT Systems",
  "Compliance",
];

const METHODOLOGY_OPTIONS = [
  "Document Review",
  "Interviews",
  "Observations",
  "Testing",
];

const LIMITATIONS_SCOPE_OPTIONS = [
  "Lack of Access to Documents",
  "Restricted Areas",
];

const LIMITATIONS_TIME_OPTIONS = [
  "Short Timeline",
  "Deadline Pressures",
];

const LIMITATIONS_RESOURCE_OPTIONS = [
  "Budget Limitations",
  "Staffing Constraints",
];

export default function AuditReviewDeptClient({
  apiPath,
  deptName,
  titleCode,
  initialFindings = [],
  initialExecutiveSummary = null,
  initialSchedule = null,
}) {
  const [findings, setFindings] = useState(initialFindings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);

  // Executive Summary state
  const [objectiveOfAudit, setObjectiveOfAudit] = useState([]);
  const [scopeAreasCovered, setScopeAreasCovered] = useState([]);
  const [scopeMethodology, setScopeMethodology] = useState([]);
  const [scopeTimeframeAuditPeriod, setScopeTimeframeAuditPeriod] = useState("");
  const [scopeTimeframeFieldworkDates, setScopeTimeframeFieldworkDates] = useState("");
  const [auditPeriodStart, setAuditPeriodStart] = useState("");
  const [auditPeriodEnd, setAuditPeriodEnd] = useState("");
  const [limitationsScope, setLimitationsScope] = useState([]);
  const [limitationsTime, setLimitationsTime] = useState([]);
  const [limitationsResource, setLimitationsResource] = useState([]);
  const [internalAuditTeam, setInternalAuditTeam] = useState([]);

  // Key Findings state
  const [keyFindings, setKeyFindings] = useState([]);

  // Modal state for SELECT fields
  const [selectModal, setSelectModal] = useState({
    open: false,
    type: null, // 'objective', 'scopeAreas', 'methodology', 'limitationsScope', 'limitationsTime', 'limitationsResource', 'team'
    options: [],
    currentSelection: [],
    onConfirm: null,
  });

  // Load executive summary from localStorage or initial data
  useEffect(() => {
    const storageKey = `auditReviewExecutiveSummary_${apiPath}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setObjectiveOfAudit(parsed.objectiveOfAudit || []);
        setScopeAreasCovered(parsed.scopeAreasCovered || []);
        setScopeMethodology(parsed.scopeMethodology || []);
        setScopeTimeframeAuditPeriod(parsed.scopeTimeframeAuditPeriod || "");
        setScopeTimeframeFieldworkDates(parsed.scopeTimeframeFieldworkDates || "");
        setLimitationsScope(parsed.limitationsScope || []);
        setLimitationsTime(parsed.limitationsTime || []);
        setLimitationsResource(parsed.limitationsResource || []);
        setInternalAuditTeam(parsed.internalAuditTeam || []);
      } else if (initialExecutiveSummary) {
        // Load from initial data
        setObjectiveOfAudit(initialExecutiveSummary.objective_of_audit ? JSON.parse(initialExecutiveSummary.objective_of_audit) : []);
        setScopeAreasCovered(initialExecutiveSummary.scope_areas_covered ? JSON.parse(initialExecutiveSummary.scope_areas_covered) : []);
        setScopeMethodology(initialExecutiveSummary.scope_methodology ? JSON.parse(initialExecutiveSummary.scope_methodology) : []);
        setScopeTimeframeAuditPeriod(initialExecutiveSummary.scope_timeframe_audit_period || "");
        setScopeTimeframeFieldworkDates(initialExecutiveSummary.scope_timeframe_fieldwork_dates || "");
        setLimitationsScope(initialExecutiveSummary.limitations_scope ? JSON.parse(initialExecutiveSummary.limitations_scope) : []);
        setLimitationsTime(initialExecutiveSummary.limitations_time ? JSON.parse(initialExecutiveSummary.limitations_time) : []);
        setLimitationsResource(initialExecutiveSummary.limitations_resource ? JSON.parse(initialExecutiveSummary.limitations_resource) : []);
        setInternalAuditTeam(initialExecutiveSummary.internal_audit_team ? JSON.parse(initialExecutiveSummary.internal_audit_team) : []);
      }
    } catch (err) {
      console.warn("Error loading executive summary:", err);
    }
  }, [apiPath, initialExecutiveSummary]);

  // Initialize findings from audit-finding report (only if no date range is selected)
  useEffect(() => {
    if (!auditPeriodStart || !auditPeriodEnd) {
      if (initialFindings && initialFindings.length > 0) {
        const mappedFindings = initialFindings.map((finding, idx) => ({
          no: idx + 1,
          apNo: finding.ap_code || "",
          substantiveTest: finding.substantive_test || "",
          checkYn: finding.check_yn || "",
          method: finding.method || "",
          risk: finding.risk || "",
          preparer: finding.preparer || "",
          findingResult: finding.finding_result || "",
          findingDescription: finding.finding_description || "",
          recommendation: finding.recommendation || "",
          status: "",
          reviewNote: "",
          reviewStatus: "",
          preparerRespo: "",
          referenceLink: "",
          followUpDueDate: finding.completion_date ? new Date(finding.completion_date).toISOString().split('T')[0] : "",
          timeline: "",
          followUpStatus: finding.completion_status || "",
          auditee: finding.auditee || "",
        }));
        setKeyFindings(mappedFindings);
      }
    }
  }, [initialFindings, auditPeriodStart, auditPeriodEnd]);

  // Save executive summary to localStorage
  useEffect(() => {
    const storageKey = `auditReviewExecutiveSummary_${apiPath}`;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          objectiveOfAudit,
          scopeAreasCovered,
          scopeMethodology,
          scopeTimeframeAuditPeriod,
          scopeTimeframeFieldworkDates,
          limitationsScope,
          limitationsTime,
          limitationsResource,
          internalAuditTeam,
        })
      );
    } catch (err) {
      console.warn("Error saving executive summary:", err);
    }
  }, [
    apiPath,
    objectiveOfAudit,
    scopeAreasCovered,
    scopeMethodology,
    scopeTimeframeAuditPeriod,
    scopeTimeframeFieldworkDates,
    limitationsScope,
    limitationsTime,
    limitationsResource,
    internalAuditTeam,
  ]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Open select modal
  const openSelectModal = (type, options, currentSelection, onConfirm) => {
    setSelectModal({
      open: true,
      type,
      options,
      currentSelection: [...currentSelection],
      onConfirm,
    });
  };

  // Close select modal
  const closeSelectModal = () => {
    setSelectModal({
      open: false,
      type: null,
      options: [],
      currentSelection: [],
      onConfirm: null,
    });
  };

  // Toggle item in modal selection
  const toggleModalSelection = (item) => {
    setSelectModal((prev) => {
      const newSelection = prev.currentSelection.includes(item)
        ? prev.currentSelection.filter((i) => i !== item)
        : [...prev.currentSelection, item];
      return { ...prev, currentSelection: newSelection };
    });
  };

  // Confirm modal selection
  const confirmModalSelection = () => {
    if (selectModal.onConfirm) {
      selectModal.onConfirm(selectModal.currentSelection);
    }
    closeSelectModal();
  };

  // Add new finding row
  const handleAddRow = () => {
    setKeyFindings([
      ...keyFindings,
      {
        no: keyFindings.length + 1,
        apNo: "",
        substantiveTest: "",
        testingStatus: "",
        samplingMethod: "",
        risk: "",
        preparer: "",
        findingResult: "",
        findingDescription: "",
        recommendation: "",
        status: "",
        reviewNote: "",
        reviewStatus: "",
        preparerRespo: "",
        referenceLink: "",
        followUpDueDate: "",
        timeline: "",
        followUpStatus: "",
        auditee: "",
      },
    ]);
  };

  // Update finding row
  const handleUpdateFinding = (index, field, value) => {
    const updated = [...keyFindings];
    updated[index] = { ...updated[index], [field]: value };
    setKeyFindings(updated);
  };

  // Delete finding row
  const handleDeleteRow = (index) => {
    if (keyFindings.length <= 1) return;
    const updated = keyFindings.filter((_, i) => i !== index);
    setKeyFindings(updated.map((f, i) => ({ ...f, no: i + 1 })));
  };

  // Save all data
  const handleSaveAll = async () => {
    try {
      setLoading(true);
      setError(null);

      // Save executive summary
      const summaryRes = await fetch(`/api/audit-review/${encodeURIComponent(apiPath)}/executive-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveOfAudit: JSON.stringify(objectiveOfAudit),
          scopeAreasCovered: JSON.stringify(scopeAreasCovered),
          scopeMethodology: JSON.stringify(scopeMethodology),
          scopeTimeframeAuditPeriod: scopeTimeframeAuditPeriod,
          scopeTimeframeFieldworkDates: scopeTimeframeFieldworkDates,
          limitationsScope: JSON.stringify(limitationsScope),
          limitationsTime: JSON.stringify(limitationsTime),
          limitationsResource: JSON.stringify(limitationsResource),
          internalAuditTeam: JSON.stringify(internalAuditTeam),
        }),
      });

      if (!summaryRes.ok) {
        throw new Error("Failed to save executive summary");
      }

      alert("Data saved successfully!");
    } catch (e) {
      setError(e?.message || String(e));
      alert(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Set audit period from schedule
  useEffect(() => {
    if (initialSchedule) {
      if (initialSchedule.start_date && initialSchedule.end_date) {
        const startDate = new Date(initialSchedule.start_date).toISOString().split('T')[0];
        const endDate = new Date(initialSchedule.end_date).toISOString().split('T')[0];
        setAuditPeriodStart(startDate);
        setAuditPeriodEnd(endDate);
        setScopeTimeframeAuditPeriod(`${formatDate(initialSchedule.start_date)} - ${formatDate(initialSchedule.end_date)}`);
      }
    }
  }, [initialSchedule]);

  // Fetch findings based on audit period (date range)
  const fetchFindingsByDateRange = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      // Jika tidak ada audit period yang dipilih, kosongkan tabel
      setKeyFindings([]);
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`/api/audit-finding/${apiPath}`);
      if (res.ok) {
        const json = await res.json();
        const dataArray = json.success && Array.isArray(json.data) 
          ? json.data 
          : (Array.isArray(json.data) ? json.data : []);
        
        // Filter STRICT berdasarkan audit period (date range)
        // Hanya data yang berada dalam rentang audit period yang akan ditampilkan
        const periodStart = new Date(startDate);
        periodStart.setHours(0, 0, 0, 0); // Start of day
        const periodEnd = new Date(endDate);
        periodEnd.setHours(23, 59, 59, 999); // End of day
        
        const filteredFindings = dataArray.filter(row => {
          // Must be COMPLETED
          const status = row.completion_status?.toUpperCase();
          if (status !== "COMPLETED") return false;
          
          // Filter STRICT berdasarkan audit period:
          // Gunakan completion_date jika ada, jika tidak gunakan updated_at (tanggal publish)
          // Data HARUS berada dalam rentang audit period yang dipilih, jika tidak maka tidak akan muncul
          const rowDate = row.completion_date 
            ? new Date(row.completion_date)
            : (row.updated_at ? new Date(row.updated_at) : null);
          
          if (!rowDate || isNaN(rowDate.getTime())) {
            // Jika tidak ada tanggal yang valid, data tidak akan muncul
            return false;
          }
          
          // Normalize row date to start of day for comparison
          const rowDateNormalized = new Date(rowDate);
          rowDateNormalized.setHours(0, 0, 0, 0);
          
          // Check if row date is STRICTLY within the selected audit period
          // Hanya data yang berada dalam rentang ini yang akan muncul
          const isWithinPeriod = rowDateNormalized >= periodStart && rowDateNormalized <= periodEnd;
          
          if (!isWithinPeriod) {
            // Data di luar rentang audit period tidak akan muncul
            return false;
          }
          
          return true;
        });
        
        // Map findings
        const mappedFindings = filteredFindings.map((finding, idx) => ({
          no: idx + 1,
          apNo: finding.ap_code || "",
          substantiveTest: finding.substantive_test || "",
          checkYn: finding.check_yn || "",
          method: finding.method || "",
          risk: finding.risk || "",
          preparer: finding.preparer || "",
          findingResult: finding.finding_result || "",
          findingDescription: finding.finding_description || "",
          recommendation: finding.recommendation || "",
          status: "",
          reviewNote: "",
          reviewStatus: "",
          preparerRespo: "",
          referenceLink: "",
          followUpDueDate: finding.completion_date ? new Date(finding.completion_date).toISOString().split('T')[0] : "",
          timeline: "",
          followUpStatus: finding.completion_status || "",
          auditee: finding.auditee || "",
        }));
        
        setKeyFindings(mappedFindings);
      }
    } catch (err) {
      console.error("Error fetching findings by date range:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle date range change - Hanya tampilkan data jika audit period dipilih
  useEffect(() => {
    if (auditPeriodStart && auditPeriodEnd) {
      fetchFindingsByDateRange(auditPeriodStart, auditPeriodEnd);
      // Update scopeTimeframeAuditPeriod display
      const startFormatted = formatDate(auditPeriodStart);
      const endFormatted = formatDate(auditPeriodEnd);
      setScopeTimeframeAuditPeriod(`${startFormatted} - ${endFormatted}`);
    } else {
      // Jika audit period tidak dipilih, kosongkan tabel
      setKeyFindings([]);
      setScopeTimeframeAuditPeriod("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditPeriodStart, auditPeriodEnd, apiPath]);

  return (
    <>
      <style jsx>{`
        header::-webkit-scrollbar {
          width: 8px;
        }
        header::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        header::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        header::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50/95 to-blue-50/80">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 bg-gradient-to-br from-white via-slate-50/95 to-blue-50/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xl transition-all duration-700 ease-out max-h-[90vh] overflow-y-auto overscroll-contain ${
          isHeaderCollapsed ? "transform -translate-y-full opacity-0 scale-95" : "transform translate-y-0 opacity-100 scale-100"
        }`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div
            className={`px-3 sm:px-6 py-3 sm:py-4 transition-all duration-500 delay-200 ${
              isHeaderCollapsed ? "opacity-0 transform translate-y-2" : "opacity-100 transform translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                    <h1 className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
                      {titleCode} AUDIT REVIEW
                    </h1>
                    <span className="px-2 py-0.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-[10px] sm:text-xs font-bold rounded-full border border-blue-200">
                      {deptName}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">Internal Audit Review Executive Summary</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary Section in Header */}
        <div className="max-w-7xl mx-auto">
          <div className="px-4 sm:px-6 pb-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-slate-200/50 shadow-md">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/50">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800">Executive Summary</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {/* Objective of the Audit */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">Objective of the Audit</label>
                    <button
                      onClick={() => openSelectModal(
                        'objective',
                        OBJECTIVE_OPTIONS,
                        objectiveOfAudit,
                        (selected) => setObjectiveOfAudit(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      SELECT
                    </button>
                  </div>
                  <div className="min-h-[60px] max-h-[100px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {objectiveOfAudit.length > 0 ? (
                      <ul className="list-disc list-inside text-[10px] sm:text-xs text-slate-700 space-y-0.5">
                        {objectiveOfAudit.map((obj, idx) => (
                          <li key={idx} className="leading-tight">{obj}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400">No objectives selected</p>
                    )}
                  </div>
                </div>

                {/* 1.1 Scope of the Audit - Areas Covered */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">1.1 Scope - Areas Covered</label>
                    <button
                      onClick={() => openSelectModal(
                        'scopeAreas',
                        SCOPE_AREAS_COVERED_OPTIONS,
                        scopeAreasCovered,
                        (selected) => setScopeAreasCovered(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      SELECT
                    </button>
                  </div>
                  <div className="min-h-[60px] max-h-[100px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {scopeAreasCovered.length > 0 ? (
                      <ul className="list-disc list-inside text-[10px] sm:text-xs text-slate-700 space-y-0.5">
                        {scopeAreasCovered.map((area, idx) => (
                          <li key={idx} className="leading-tight">{area}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400">No areas selected</p>
                    )}
                  </div>
                </div>

                {/* 1.2 Methodology */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">1.2 Methodology</label>
                    <button
                      onClick={() => openSelectModal(
                        'methodology',
                        METHODOLOGY_OPTIONS,
                        scopeMethodology,
                        (selected) => setScopeMethodology(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      SELECT
                    </button>
                  </div>
                  <div className="min-h-[60px] max-h-[100px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {scopeMethodology.length > 0 ? (
                      <ul className="list-disc list-inside text-[10px] sm:text-xs text-slate-700 space-y-0.5">
                        {scopeMethodology.map((method, idx) => (
                          <li key={idx} className="leading-tight">{method}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400">No methodologies selected</p>
                    )}
                  </div>
                </div>

                {/* 1.4 Limitations - Scope */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">1.4 Limitations - Scope</label>
                    <button
                      onClick={() => openSelectModal(
                        'limitationsScope',
                        LIMITATIONS_SCOPE_OPTIONS,
                        limitationsScope,
                        (selected) => setLimitationsScope(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      SELECT
                    </button>
                  </div>
                  <div className="min-h-[50px] max-h-[80px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {limitationsScope.length > 0 ? (
                      <ul className="list-disc list-inside text-[10px] sm:text-xs text-slate-700 space-y-0.5">
                        {limitationsScope.map((lim, idx) => (
                          <li key={idx} className="leading-tight">{lim}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400">No limitations selected</p>
                    )}
                  </div>
                </div>

                {/* Limitations - Time */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">Limitations - Time</label>
                    <button
                      onClick={() => openSelectModal(
                        'limitationsTime',
                        LIMITATIONS_TIME_OPTIONS,
                        limitationsTime,
                        (selected) => setLimitationsTime(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      SELECT
                    </button>
                  </div>
                  <div className="min-h-[50px] max-h-[80px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {limitationsTime.length > 0 ? (
                      <ul className="list-disc list-inside text-[10px] sm:text-xs text-slate-700 space-y-0.5">
                        {limitationsTime.map((lim, idx) => (
                          <li key={idx} className="leading-tight">{lim}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400">No limitations selected</p>
                    )}
                  </div>
                </div>

                {/* Limitations - Resource */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">Limitations - Resource</label>
                    <button
                      onClick={() => openSelectModal(
                        'limitationsResource',
                        LIMITATIONS_RESOURCE_OPTIONS,
                        limitationsResource,
                        (selected) => setLimitationsResource(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      SELECT
                    </button>
                  </div>
                  <div className="min-h-[50px] max-h-[80px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {limitationsResource.length > 0 ? (
                      <ul className="list-disc list-inside text-[10px] sm:text-xs text-slate-700 space-y-0.5">
                        {limitationsResource.map((lim, idx) => (
                          <li key={idx} className="leading-tight">{lim}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-slate-400">No limitations selected</p>
                    )}
                  </div>
                </div>

                {/* Internal Audit Team */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-700 leading-tight">Internal Audit Team</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const name = prompt("Enter team member name:");
                          const region = prompt("Enter region:");
                          if (name && region) {
                            setInternalAuditTeam([...internalAuditTeam, { name, region }]);
                          }
                        }}
                        className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                      >
                        SELECT
                      </button>
                      <button
                        onClick={() => {
                          if (internalAuditTeam.length > 0) {
                            const index = prompt(`Enter index to remove (1-${internalAuditTeam.length}):`);
                            const idx = parseInt(index) - 1;
                            if (idx >= 0 && idx < internalAuditTeam.length) {
                              setInternalAuditTeam(internalAuditTeam.filter((_, i) => i !== idx));
                            }
                          }
                        }}
                        className="px-2 py-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                  <div className="min-h-[60px] max-h-[100px] overflow-y-auto p-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded border border-slate-200 shadow-sm">
                    {internalAuditTeam.length > 0 ? (
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold text-slate-600 border-b border-slate-300 pb-1">
                          <div>Name</div>
                          <div>Region</div>
                        </div>
                        {internalAuditTeam.map((member, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-1 text-[10px] sm:text-xs text-slate-700">
                            <div className="font-medium truncate">{member.name}</div>
                            <div className="truncate">{member.region}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">No team members added</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Toggle Header Button */}
      <button
        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
        className="fixed top-2 right-2 sm:top-4 sm:right-4 z-40 w-9 h-8 sm:w-11 sm:h-9 flex items-center justify-center rounded-full shadow-md hover:shadow-lg border border-slate-300 bg-white/95 text-xs sm:text-sm font-semibold text-slate-700 transition-all duration-300 transform hover:scale-110 active:scale-95"
        title={isHeaderCollapsed ? "Show header" : "Hide header"}
      >
        {isHeaderCollapsed ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div
        className={`w-full px-3 sm:px-4 pb-4 flex flex-col h-full transition-all duration-500 ease-in-out ${
          isHeaderCollapsed ? "pt-14 sm:pt-16" : "pt-24 sm:pt-28 md:pt-32"
        }`}
      >
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Header Card */}
        <div className="mb-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">{titleCode} AUDIT REVIEW</div>
            <div className="text-lg font-bold text-slate-900">{deptName}</div>
            <div className="text-sm text-slate-600">Internal Audit Review Executive Summary</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">1.3 Audit Period:</label>
              <input
                type="date"
                value={auditPeriodStart}
                onChange={(e) => setAuditPeriodStart(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 bg-white rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <span className="text-xs text-slate-600">to</span>
              <input
                type="date"
                value={auditPeriodEnd}
                onChange={(e) => setAuditPeriodEnd(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 bg-white rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {scopeTimeframeAuditPeriod && (
                <span className="text-xs text-slate-500 ml-2">({scopeTimeframeAuditPeriod})</span>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4">
          <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "60px" }}>No.</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "140px" }}>AP No.</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "220px" }}>Substantive Test & Testing Status</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "100px" }}>RISK</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>PREPARER</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>FINDING RESULT</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "280px" }}>FINDING DESCRIPTION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "280px" }}>RECOMMENDATION</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>STATUS</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "220px" }}>REVIEW NOTE</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 bg-blue-50 align-top" style={{ width: "160px" }}>REVIEW STATUS</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>PREPARER RESPO</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>REFERENCE LIN</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>FOLLOW UP DUE DATE</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "140px" }}>TIMELINE</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>FOLLOW UP STATUS</th>
                  <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 align-top" style={{ width: "160px" }}>AUDITEE</th>
                </tr>
              </thead>
              <tbody>
                {keyFindings.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="p-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-gray-600">No Data</p>
                        <p className="text-sm text-gray-400 mt-1">No findings available</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  keyFindings.map((finding, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.no}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.apNo || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        <div className="space-y-1">
                          <div><strong>Substantive Test:</strong> {finding.substantiveTest || "-"}</div>
                          <div><strong>Check:</strong> {finding.checkYn || "-"}</div>
                          <div><strong>Method:</strong> {finding.method || "-"}</div>
                        </div>
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.risk || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.preparer || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.findingResult || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{finding.findingDescription || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{finding.recommendation || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.status || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{finding.reviewNote || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center bg-blue-50 align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.reviewStatus || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.preparerRespo || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.referenceLink || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.followUpDueDate || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.timeline || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.followUpStatus || "-"}</td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{finding.auditee || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Select Modal */}
        {selectModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={closeSelectModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="bg-blue-600 p-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Select Options</h3>
                <button
                  onClick={closeSelectModal}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {selectModal.options.map((option, idx) => (
                    <label
                      key={idx}
                      className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectModal.currentSelection.includes(option)}
                        onChange={() => toggleModalSelection(option)}
                        className="mr-3 w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={closeSelectModal}
                  className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all duration-200 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModalSelection}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
}

