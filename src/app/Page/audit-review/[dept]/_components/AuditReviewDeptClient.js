"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";

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

const REVIEW_STATUS_OPTIONS = [
  "No Action Required",
  "Pending Review",
  "Reviewed, revision needed",
  "Reviewed, revision completed",
];

const REVIEW_STATUS_DEFAULT = REVIEW_STATUS_OPTIONS[0];

function normalizeReviewStatus(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "-") return REVIEW_STATUS_DEFAULT;
  const exact = REVIEW_STATUS_OPTIONS.find((o) => o === s);
  if (exact) return exact;
  const lower = s.toLowerCase();
  const ci = REVIEW_STATUS_OPTIONS.find((o) => o.toLowerCase() === lower);
  if (ci) return ci;
  return REVIEW_STATUS_DEFAULT;
}

const FOLLOW_UP_STATUS_IN_PROGRESS = "In progress";
const FOLLOW_UP_STATUS_COMPLETE = "Complete";

function normalizeFollowUpStatus(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return FOLLOW_UP_STATUS_IN_PROGRESS;
  const lower = s.toLowerCase();
  if (lower === "complete" || lower === "completed" || s === "COMPLETED") {
    return FOLLOW_UP_STATUS_COMPLETE;
  }
  return FOLLOW_UP_STATUS_IN_PROGRESS;
}

function parseStoredArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeKeyFindingRow(finding, idx) {
  return {
    no: finding?.no ?? idx + 1,
    riskId: finding?.riskId || finding?.risk_id || "",
    riskDetails: finding?.riskDetails || finding?.risk_details || "",
    apNo: finding?.apNo || finding?.ap_code || finding?.apCode || "",
    substantiveTest: finding?.substantiveTest || finding?.substantive_test || "",
    checkYn: finding?.checkYn || finding?.check_yn || "",
    method: finding?.method || "",
    risk: finding?.risk || "",
    riskLevel: finding?.riskLevel || finding?.risk || "",
    preparer: finding?.preparer || "",
    findingResult: finding?.findingResult || finding?.finding_result || "",
    findingDescription: finding?.findingDescription || finding?.finding_description || "",
    recommendation: finding?.recommendation || "",
    status: finding?.status || "",
    reviewNote: finding?.reviewNote || "",
    reviewStatus: normalizeReviewStatus(finding?.reviewStatus ?? finding?.review_status ?? ""),
    preparerRespo: finding?.preparerRespo || "",
    referenceLink: finding?.referenceLink || "",
    followUpDueDate: finding?.followUpDueDate || finding?.follow_up_due_date || "",
    timeline: finding?.timeline || "",
    followUpStatus: normalizeFollowUpStatus(finding?.followUpStatus ?? finding?.follow_up_status ?? ""),
    auditee: finding?.auditee || "",
  };
}

function getFindingIdentity(finding) {
  const riskId = String(finding?.riskId || finding?.risk_id || "").trim();
  const apNo = String(finding?.apNo || finding?.ap_code || finding?.apCode || "").trim();
  return `${riskId}::${apNo}`;
}

function mergeReviewFindings(latestFindings = [], savedReviewFindings = []) {
  const normalizedLatest = Array.isArray(latestFindings)
    ? latestFindings.map((finding, idx) => normalizeKeyFindingRow(finding, idx))
    : [];
  const normalizedSaved = Array.isArray(savedReviewFindings)
    ? savedReviewFindings.map((finding, idx) => normalizeKeyFindingRow(finding, idx))
    : [];

  if (normalizedSaved.length === 0) return normalizedLatest;
  if (normalizedLatest.length === 0) return normalizedSaved;

  const savedMap = new Map(normalizedSaved.map((finding) => [getFindingIdentity(finding), finding]));
  // Seluruh baris yang disimpan di audit-review (JSON) harus menang atas snapshot audit-finding
  // untuk kolom yang sama — bukan hanya reviewNote/reviewStatus. Kalau tidak, setelah Save/Done
  // atau router.refresh() nilai PREPARER, FINDING RESULT, dll. kembali ke data finding mentah.
  const merged = normalizedLatest.map((finding, idx) => {
    const saved = savedMap.get(getFindingIdentity(finding));
    if (!saved) return finding;

    return normalizeKeyFindingRow({ ...finding, ...saved }, idx);
  });

  const latestKeys = new Set(normalizedLatest.map((finding) => getFindingIdentity(finding)));
  const savedOnlyRows = normalizedSaved.filter((finding) => !latestKeys.has(getFindingIdentity(finding)));

  return [...merged, ...savedOnlyRows].map((finding, idx) => ({
    ...finding,
    no: idx + 1,
  }));
}

export default function AuditReviewDeptClient({
  apiPath,
  deptName,
  titleCode,
  initialFindings = [],
  initialReviewedFindings = [],
  initialExecutiveSummary = null,
  initialSchedule = null,
  selectedYear = null,
}) {
  const toast = useToast();
  const router = useRouter();
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
  const [isLocked, setIsLocked] = useState(Boolean(initialExecutiveSummary?.is_locked));
  const [summaryHydrated, setSummaryHydrated] = useState(false);
  const isInteractionDisabled = isLocked || loading;

  // Key Findings state
  const [keyFindings, setKeyFindings] = useState([]);
  const [hasSavedReviewFindings, setHasSavedReviewFindings] = useState(
    Array.isArray(initialReviewedFindings) && initialReviewedFindings.length > 0,
  );
  const [isTableEditMode, setIsTableEditMode] = useState(false);

  const autoAuditPeriod = useMemo(() => {
    const sourceRows = Array.isArray(initialFindings) ? initialFindings : [];
    const dates = sourceRows
      .map((row) => row?.completion_date || row?.updated_at || null)
      .filter(Boolean)
      .map((value) => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      })
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
      return { start: "", end: "", label: "" };
    }

    const toIso = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const toLabel = (dateStr) => {
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

    const start = toIso(dates[0]);
    const end = toIso(dates[dates.length - 1]);
    return {
      start,
      end,
      label: `${toLabel(start)} - ${toLabel(end)}`,
    };
  }, [initialFindings]);

  // Modal state for SELECT fields
  const [selectModal, setSelectModal] = useState({
    open: false,
    type: null, // 'objective', 'scopeAreas', 'methodology', 'limitationsScope', 'limitationsTime', 'limitationsResource', 'team'
    options: [],
    currentSelection: [],
    onConfirm: null,
  });

  const [teamAddModalOpen, setTeamAddModalOpen] = useState(false);
  const [teamRemoveModalOpen, setTeamRemoveModalOpen] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamRegionInput, setTeamRegionInput] = useState("");

  // Hydrate executive summary. Prefer server data when available so saved/locked
  // records reopen with the latest persisted values instead of stale local cache.
  useEffect(() => {
    const storageKey = `auditReviewExecutiveSummary_${apiPath}_${selectedYear || "default"}`;
    try {
      if (initialExecutiveSummary) {
        setObjectiveOfAudit(parseStoredArray(initialExecutiveSummary.objective_of_audit));
        setScopeAreasCovered(parseStoredArray(initialExecutiveSummary.scope_areas_covered));
        setScopeMethodology(parseStoredArray(initialExecutiveSummary.scope_methodology));
        setScopeTimeframeAuditPeriod(initialExecutiveSummary.scope_timeframe_audit_period || "");
        setScopeTimeframeFieldworkDates(initialExecutiveSummary.scope_timeframe_fieldwork_dates || "");
        setLimitationsScope(parseStoredArray(initialExecutiveSummary.limitations_scope));
        setLimitationsTime(parseStoredArray(initialExecutiveSummary.limitations_time));
        setLimitationsResource(parseStoredArray(initialExecutiveSummary.limitations_resource));
        setInternalAuditTeam(parseStoredArray(initialExecutiveSummary.internal_audit_team));
        setIsLocked(Boolean(initialExecutiveSummary.is_locked));
      } else {
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
          setIsLocked(Boolean(parsed.isLocked));
        }
      }
    } catch (err) {
      console.warn("Error loading executive summary:", err);
    } finally {
      setSummaryHydrated(true);
    }
  }, [apiPath, initialExecutiveSummary, selectedYear]);

  // Initialize findings by merging the latest audit-finding rows with any saved
  // audit-review fields so older saved review data does not hide newer findings.
  useEffect(() => {
    if (Array.isArray(initialReviewedFindings) && initialReviewedFindings.length > 0) {
      setKeyFindings(mergeReviewFindings(initialFindings, initialReviewedFindings));
      setHasSavedReviewFindings(true);
      return;
    }

    if (initialFindings && initialFindings.length > 0) {
      setKeyFindings(initialFindings.map((finding, idx) => normalizeKeyFindingRow(finding, idx)));
    }
  }, [initialReviewedFindings, initialFindings]);

  // Save executive summary to localStorage
  useEffect(() => {
    if (!summaryHydrated) return;
    const storageKey = `auditReviewExecutiveSummary_${apiPath}_${selectedYear || "default"}`;
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
          isLocked,
        })
      );
    } catch (err) {
      console.warn("Error saving executive summary:", err);
    }
  }, [
    apiPath,
    selectedYear,
    summaryHydrated,
    objectiveOfAudit,
    scopeAreasCovered,
    scopeMethodology,
    scopeTimeframeAuditPeriod,
    scopeTimeframeFieldworkDates,
    limitationsScope,
    limitationsTime,
    limitationsResource,
    internalAuditTeam,
    isLocked,
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
    if (isInteractionDisabled) return;
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
    if (isInteractionDisabled) return;
    setSelectModal((prev) => {
      const newSelection = prev.currentSelection.includes(item)
        ? prev.currentSelection.filter((i) => i !== item)
        : [...prev.currentSelection, item];
      return { ...prev, currentSelection: newSelection };
    });
  };

  // Confirm modal selection
  const confirmModalSelection = () => {
    if (isInteractionDisabled) return;
    if (selectModal.onConfirm) {
      selectModal.onConfirm(selectModal.currentSelection);
    }
    closeSelectModal();
  };

  useEffect(() => {
    if (isLocked && selectModal.open) {
      closeSelectModal();
    }
  }, [isLocked, selectModal.open]);

  useEffect(() => {
    if (isLocked) {
      setTeamAddModalOpen(false);
      setTeamRemoveModalOpen(false);
    }
  }, [isLocked]);

  const openTeamAddModal = () => {
    if (isInteractionDisabled) return;
    setTeamNameInput("");
    setTeamRegionInput("");
    setTeamAddModalOpen(true);
  };

  const closeTeamAddModal = () => {
    setTeamAddModalOpen(false);
    setTeamNameInput("");
    setTeamRegionInput("");
  };

  const confirmTeamAdd = () => {
    if (isInteractionDisabled) return;
    const name = (teamNameInput || "").trim();
    const region = (teamRegionInput || "").trim();
    if (!name || !region) {
      toast.show("Please enter both name and region.", "error");
      return;
    }
    setInternalAuditTeam((prev) => [...prev, { name, region }]);
    closeTeamAddModal();
  };

  const openTeamRemoveModal = () => {
    if (isInteractionDisabled) return;
    if (internalAuditTeam.length === 0) {
      toast.show("No team members to remove.", "error");
      return;
    }
    setTeamRemoveModalOpen(true);
  };

  const closeTeamRemoveModal = () => setTeamRemoveModalOpen(false);

  const removeTeamMemberAt = (index) => {
    if (isInteractionDisabled) return;
    setInternalAuditTeam((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (teamRemoveModalOpen && internalAuditTeam.length === 0) {
      setTeamRemoveModalOpen(false);
    }
  }, [teamRemoveModalOpen, internalAuditTeam.length]);

  useEffect(() => {
    if (isLocked) {
      setIsTableEditMode(false);
    }
  }, [isLocked]);

  // Add new finding row
  const handleAddRow = () => {
    setKeyFindings([
      ...keyFindings,
      {
        no: keyFindings.length + 1,
        riskId: "",
        riskDetails: "",
        apNo: "",
        substantiveTest: "",
        checkYn: "",
        method: "",
        risk: "",
        riskLevel: "",
        preparer: "",
        findingResult: "",
        findingDescription: "",
        recommendation: "",
        status: "",
        reviewNote: "",
        reviewStatus: REVIEW_STATUS_DEFAULT,
        preparerRespo: "",
        referenceLink: "",
        followUpDueDate: "",
        timeline: "",
        followUpStatus: FOLLOW_UP_STATUS_IN_PROGRESS,
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

  const getAuditYear = () => {
    if (auditPeriodEnd && !Number.isNaN(new Date(auditPeriodEnd).getFullYear())) {
      return new Date(auditPeriodEnd).getFullYear();
    }
    if (auditPeriodStart && !Number.isNaN(new Date(auditPeriodStart).getFullYear())) {
      return new Date(auditPeriodStart).getFullYear();
    }
    return selectedYear || new Date().getFullYear();
  };

  /** Persists key findings only (e.g. when finishing table edit). */
  const handleSaveFindingsOnly = async () => {
    try {
      setLoading(true);
      setError(null);

      const auditYear = getAuditYear();
      const findingsRes = await fetch(`/api/audit-review/${encodeURIComponent(apiPath)}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditYear,
          findings: keyFindings.map((finding, idx) => normalizeKeyFindingRow(finding, idx)),
        }),
      });

      if (!findingsRes.ok) {
        const findingsText = await findingsRes.text().catch(() => "");
        let findingsJson = null;
        try {
          findingsJson = findingsText ? JSON.parse(findingsText) : null;
        } catch {
          findingsJson = null;
        }
        throw new Error(
          findingsJson?.error ||
            findingsJson?.details ||
            findingsText ||
            "Failed to save audit review findings",
        );
      }

      const findingsJson = await findingsRes.json().catch(() => ({}));
      if (Array.isArray(findingsJson.rows)) {
        setKeyFindings(findingsJson.rows.map((finding, idx) => normalizeKeyFindingRow(finding, idx)));
      }
      setHasSavedReviewFindings(true);
      toast.show("Key findings saved.", "success");
      router.refresh();
      return true;
    } catch (e) {
      setError(e?.message || String(e));
      toast.show("Error: " + (e?.message || String(e)), "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDoneTableEdit = async () => {
    const ok = await handleSaveFindingsOnly();
    if (ok) {
      setIsTableEditMode(false);
    }
  };

  // Save all data
  const handleSaveAll = async (nextLocked = isLocked) => {
    try {
      setLoading(true);
      setError(null);

      const auditYear = getAuditYear();

      // Save executive summary
      const summaryRes = await fetch(`/api/audit-review/${encodeURIComponent(apiPath)}/executive-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditYear,
          objectiveOfAudit: JSON.stringify(objectiveOfAudit),
          scopeAreasCovered: JSON.stringify(scopeAreasCovered),
          scopeMethodology: JSON.stringify(scopeMethodology),
          scopeTimeframeAuditPeriod: scopeTimeframeAuditPeriod,
          scopeTimeframeFieldworkDates: scopeTimeframeFieldworkDates,
          limitationsScope: JSON.stringify(limitationsScope),
          limitationsTime: JSON.stringify(limitationsTime),
          limitationsResource: JSON.stringify(limitationsResource),
          internalAuditTeam: JSON.stringify(internalAuditTeam),
          isLocked: nextLocked,
        }),
      });

      if (!summaryRes.ok) {
        const summaryText = await summaryRes.text().catch(() => "");
        let summaryJson = null;
        try {
          summaryJson = summaryText ? JSON.parse(summaryText) : null;
        } catch {
          summaryJson = null;
        }
        throw new Error(
          summaryJson?.error ||
          summaryJson?.details ||
          summaryText ||
          "Failed to save executive summary"
        );
      }

      const findingsRes = await fetch(`/api/audit-review/${encodeURIComponent(apiPath)}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditYear,
          findings: keyFindings.map((finding, idx) => normalizeKeyFindingRow(finding, idx)),
        }),
      });

      if (!findingsRes.ok) {
        const findingsText = await findingsRes.text().catch(() => "");
        let findingsJson = null;
        try {
          findingsJson = findingsText ? JSON.parse(findingsText) : null;
        } catch {
          findingsJson = null;
        }
        throw new Error(
          findingsJson?.error ||
          findingsJson?.details ||
          findingsText ||
          "Failed to save audit review findings"
        );
      }

      const findingsJson = await findingsRes.json().catch(() => ({}));
      if (Array.isArray(findingsJson.rows)) {
        setKeyFindings(findingsJson.rows.map((finding, idx) => normalizeKeyFindingRow(finding, idx)));
      }
      setHasSavedReviewFindings(true);
      setIsLocked(nextLocked);

      toast.show(nextLocked ? "Data saved and locked for report!" : "Data saved and unlocked from report!", "success");
      router.refresh();
    } catch (e) {
      setError(e?.message || String(e));
      toast.show("Error: " + (e?.message || String(e)), "error");
    } finally {
      setLoading(false);
    }
  };

  // Set audit period automatically from published/completed findings.
  useEffect(() => {
    setAuditPeriodStart(autoAuditPeriod.start || "");
    setAuditPeriodEnd(autoAuditPeriod.end || "");
    setScopeTimeframeAuditPeriod(autoAuditPeriod.label || "");
  }, [autoAuditPeriod]);

  const handleBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = `/Page/audit-review${selectedYear ? `?year=${encodeURIComponent(String(selectedYear))}` : ""}`;
  }, [selectedYear]);

  const tableFieldClass =
    "w-full min-w-0 text-[11px] leading-tight border border-slate-300 rounded px-1 py-0.5 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const tableAreaClass =
    "w-full min-w-0 text-[11px] leading-tight border border-slate-300 rounded px-1 py-0.5 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[2.5rem] disabled:opacity-50 disabled:cursor-not-allowed";

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
      <div className="fixed top-2 left-2 sm:top-4 sm:left-4 z-40">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full shadow-md hover:shadow-lg border border-slate-300 bg-white/95 text-xs sm:text-sm font-semibold text-slate-700 transition-all duration-300"
          title="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

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
                      type="button"
                      disabled={isInteractionDisabled}
                      onClick={() => openSelectModal(
                        'objective',
                        OBJECTIVE_OPTIONS,
                        objectiveOfAudit,
                        (selected) => setObjectiveOfAudit(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
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
                      type="button"
                      disabled={isInteractionDisabled}
                      onClick={() => openSelectModal(
                        'scopeAreas',
                        SCOPE_AREAS_COVERED_OPTIONS,
                        scopeAreasCovered,
                        (selected) => setScopeAreasCovered(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
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
                      type="button"
                      disabled={isInteractionDisabled}
                      onClick={() => openSelectModal(
                        'methodology',
                        METHODOLOGY_OPTIONS,
                        scopeMethodology,
                        (selected) => setScopeMethodology(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
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
                      type="button"
                      disabled={isInteractionDisabled}
                      onClick={() => openSelectModal(
                        'limitationsScope',
                        LIMITATIONS_SCOPE_OPTIONS,
                        limitationsScope,
                        (selected) => setLimitationsScope(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
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
                      type="button"
                      disabled={isInteractionDisabled}
                      onClick={() => openSelectModal(
                        'limitationsTime',
                        LIMITATIONS_TIME_OPTIONS,
                        limitationsTime,
                        (selected) => setLimitationsTime(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
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
                      type="button"
                      disabled={isInteractionDisabled}
                      onClick={() => openSelectModal(
                        'limitationsResource',
                        LIMITATIONS_RESOURCE_OPTIONS,
                        limitationsResource,
                        (selected) => setLimitationsResource(selected)
                      )}
                      className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
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
                        type="button"
                        disabled={isInteractionDisabled}
                        onClick={openTeamAddModal}
                        className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        disabled={isInteractionDisabled}
                        onClick={openTeamRemoveModal}
                        className="px-2 py-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-[10px] font-semibold rounded transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-600 disabled:hover:to-red-700"
                      >
                        Remove
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 tracking-wide">{titleCode} AUDIT REVIEW</div>
                <div className="text-lg font-bold text-slate-900">{deptName}</div>
                <div className="text-sm text-slate-600">Internal Audit Review Executive Summary</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  isLocked
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {isLocked ? "Locked for Report" : "Unlocked"}
                </span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSaveAll(!isLocked)}
                  className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isLocked
                      ? "bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {loading ? "Saving..." : isLocked ? "Unlock" : "Lock"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table - responsive: horizontal scroll when narrow */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-slate-50/80">
            <span className="text-xs font-semibold text-slate-600">Key findings</span>
            <button
              type="button"
              disabled={isInteractionDisabled}
              onClick={() => {
                if (isTableEditMode) {
                  void handleDoneTableEdit();
                } else {
                  setIsTableEditMode(true);
                }
              }}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && isTableEditMode ? "Saving..." : isTableEditMode ? "Done" : "Edit"}
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-visible rounded-lg border border-gray-200 shadow-sm -mx-2 sm:mx-0">
            <table className="w-full border-collapse text-xs min-w-[2200px]" style={{ tableLayout: "fixed" }}>
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
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.apNo ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "apNo", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.apNo || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {isTableEditMode ? (
                          <div className="space-y-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-slate-600">Substantive Test</span>
                              <input
                                type="text"
                                value={finding.substantiveTest ?? ""}
                                disabled={isInteractionDisabled}
                                onChange={(e) => handleUpdateFinding(idx, "substantiveTest", e.target.value)}
                                className={tableFieldClass}
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-slate-600">Check</span>
                              <select
                                value={finding.checkYn ?? ""}
                                disabled={isInteractionDisabled}
                                onChange={(e) => handleUpdateFinding(idx, "checkYn", e.target.value)}
                                className={tableFieldClass}
                              >
                                <option value="">—</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="-">-</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-slate-600">Method</span>
                              <input
                                type="text"
                                value={finding.method ?? ""}
                                disabled={isInteractionDisabled}
                                onChange={(e) => handleUpdateFinding(idx, "method", e.target.value)}
                                className={tableFieldClass}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div><strong>Substantive Test:</strong> {finding.substantiveTest || "-"}</div>
                            <div><strong>Check:</strong> {finding.checkYn || "-"}</div>
                            <div><strong>Method:</strong> {finding.method || "-"}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.risk ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "risk", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.risk || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.preparer ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "preparer", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.preparer || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.findingResult ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "findingResult", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.findingResult || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {isTableEditMode ? (
                          <textarea
                            value={finding.findingDescription ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "findingDescription", e.target.value)}
                            className={tableAreaClass}
                            rows={3}
                          />
                        ) : (
                          finding.findingDescription || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {isTableEditMode ? (
                          <textarea
                            value={finding.recommendation ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "recommendation", e.target.value)}
                            className={tableAreaClass}
                            rows={3}
                          />
                        ) : (
                          finding.recommendation || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.status ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "status", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.status || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {isTableEditMode ? (
                          <textarea
                            value={finding.reviewNote ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "reviewNote", e.target.value)}
                            className={tableAreaClass}
                            rows={3}
                          />
                        ) : (
                          finding.reviewNote || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center bg-blue-50 align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <select
                            value={normalizeReviewStatus(finding.reviewStatus)}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "reviewStatus", e.target.value)}
                            className={tableFieldClass}
                          >
                            {REVIEW_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          normalizeReviewStatus(finding.reviewStatus)
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.preparerRespo ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "preparerRespo", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.preparerRespo || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.referenceLink ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "referenceLink", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.referenceLink || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="date"
                            value={finding.followUpDueDate ? String(finding.followUpDueDate).slice(0, 10) : ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "followUpDueDate", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.followUpDueDate || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.timeline ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "timeline", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.timeline || "-"
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <select
                            value={normalizeFollowUpStatus(finding.followUpStatus)}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "followUpStatus", e.target.value)}
                            className={tableFieldClass}
                          >
                            <option value={FOLLOW_UP_STATUS_IN_PROGRESS}>{FOLLOW_UP_STATUS_IN_PROGRESS}</option>
                            <option value={FOLLOW_UP_STATUS_COMPLETE}>{FOLLOW_UP_STATUS_COMPLETE}</option>
                          </select>
                        ) : (
                          normalizeFollowUpStatus(finding.followUpStatus)
                        )}
                      </td>
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {isTableEditMode ? (
                          <input
                            type="text"
                            value={finding.auditee ?? ""}
                            disabled={isInteractionDisabled}
                            onChange={(e) => handleUpdateFinding(idx, "auditee", e.target.value)}
                            className={tableFieldClass}
                          />
                        ) : (
                          finding.auditee || "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Select Modal */}
        {selectModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/20 p-4" onClick={closeSelectModal}>
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
                        disabled={isInteractionDisabled}
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
                  type="button"
                  onClick={closeSelectModal}
                  className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all duration-200 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isInteractionDisabled}
                  onClick={confirmModalSelection}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Internal Audit Team member */}
        {teamAddModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/20 p-4"
            onClick={closeTeamAddModal}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-blue-600 p-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Add team member</h3>
                <button
                  type="button"
                  onClick={closeTeamAddModal}
                  className="text-white hover:text-gray-200 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label htmlFor="team-member-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    id="team-member-name"
                    type="text"
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    disabled={isInteractionDisabled}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label htmlFor="team-member-region" className="block text-sm font-medium text-slate-700 mb-1">
                    Region
                  </label>
                  <input
                    id="team-member-region"
                    type="text"
                    value={teamRegionInput}
                    onChange={(e) => setTeamRegionInput(e.target.value)}
                    disabled={isInteractionDisabled}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    placeholder="e.g. Jakarta"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTeamAddModal}
                  className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all duration-200 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isInteractionDisabled}
                  onClick={confirmTeamAdd}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add member
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Internal Audit Team member */}
        {teamRemoveModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/20 p-4"
            onClick={closeTeamRemoveModal}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-red-600 p-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Remove team member</h3>
                <button
                  type="button"
                  onClick={closeTeamRemoveModal}
                  className="text-white hover:text-gray-200 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-sm text-slate-600 mb-3">Select a member to remove from the list.</p>
                <ul className="space-y-2">
                  {internalAuditTeam.map((member, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 truncate">{member.name}</div>
                        <div className="text-xs text-slate-600 truncate">{member.region}</div>
                      </div>
                      <button
                        type="button"
                        disabled={isInteractionDisabled}
                        onClick={() => removeTeamMemberAt(idx)}
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={closeTeamRemoveModal}
                  className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-all duration-200 shadow-sm"
                >
                  Close
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

