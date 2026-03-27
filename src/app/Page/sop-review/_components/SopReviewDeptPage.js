"use client";

import { useEffect, useState, useRef, useCallback, useMemo, memo, useDeferredValue } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import SOPHeader from "@/app/components/layout/Sop-Review/SOPHeader";


// Memoized row for better scroll performance (avoids re-renders when parent updates for unrelated state)
const SopTableRow = memo(function SopTableRow({ row, idx, onUpdate, onRemove, isReviewer, isAdmin, isUser, useContentVisibility }) {
  const rowStyle = useContentVisibility ? { contentVisibility: "auto", containIntrinsicSize: "0 80px" } : undefined;
  return (
    <tr
      style={rowStyle}
      className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-blue-50/30 transition-colors duration-150 border-b border-slate-100/60 group`}
    >
      <td className="p-3 text-center align-top sticky left-0 bg-inherit border-r border-slate-200/40">
        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-xs font-bold text-slate-600">{row.no}</span>
        </div>
      </td>
      <td className="p-3 align-top border-r border-slate-200/40">
        <div className="relative">
          <textarea
            value={row.sop_related}
            onChange={(e) => onUpdate(idx, { sop_related: e.target.value })}
            className="w-full bg-transparent border border-transparent hover:border-blue-200 focus:border-blue-400 focus:bg-white rounded-lg px-3 py-2 text-sm transition-colors duration-200 resize-y leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={3}
            placeholder="Enter SOP description..."
            disabled={isReviewer}
          />
        </div>
      </td>
      <td className="p-3 text-center align-top border-r border-slate-200/40">
        <select
          value={row.status || ""}
          onChange={(e) => onUpdate(idx, { status: e.target.value })}
          // Reviewer and Admin can change row status; regular user cannot
          disabled={!(isReviewer || isAdmin)}
          className={`w-full px-2 py-2 rounded-lg text-xs font-semibold border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            row.status === "APPROVED"
              ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
              : row.status === "REJECTED"
              ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
              : row.status === "IN REVIEW"
              ? "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
              : "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200"
          }`}
        >
          <option value="">Not set</option>
          <option value="DRAFT">Draft</option>
          <option value="IN REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </td>
      <td className="p-3 align-top border-r border-slate-200/40">
        <div className="relative">
          <textarea
            value={row.comment || ""}
            onChange={(e) => onUpdate(idx, { comment: e.target.value })}
            className="w-full bg-transparent border border-transparent hover:border-green-200 focus:border-green-400 focus:bg-white rounded-lg px-3 py-2 text-sm transition-colors duration-200 resize-y leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={2}
            placeholder="Enter review comment..."
            // All roles can edit review comment (requested)
            disabled={false}
          />
        </div>
      </td>
      <td className="p-3 align-top border-r border-slate-200/40">
        <div className="relative">
          <textarea
            value={row.reviewer_feedback || ""}
            onChange={(e) => onUpdate(idx, { reviewer_feedback: e.target.value })}
            className="w-full bg-transparent border border-transparent hover:border-emerald-200 focus:border-emerald-400 focus:bg-white rounded-lg px-3 py-2 text-sm transition-colors duration-200 resize-y leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={2}
            placeholder="Enter reviewer feedback..."
            disabled={!(isReviewer || isAdmin)}
          />
        </div>
      </td>
      <td className="p-3 text-center align-top border-r border-slate-200/40">
        <div className="relative">
          <input
            value={row.reviewer || ""}
            onChange={(e) => onUpdate(idx, { reviewer: e.target.value })}
            className="w-full bg-transparent border border-transparent hover:border-purple-200 focus:border-purple-400 focus:bg-white rounded-lg px-3 py-2 text-sm text-center transition-colors duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed"
            placeholder="Reviewer..."
            // Allow admin and reviewer to adjust reviewer name; regular user sees read-only
            disabled={isUser}
            readOnly={isUser}
          />
        </div>
      </td>
      <td className="p-3 text-center align-top">
        <button
          onClick={() => onRemove(idx)}
          disabled={false}
          className="inline-flex items-center justify-center w-8 h-8 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-medium transition-colors hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
          title="Delete this SOP item"
        >
          <span className="text-sm leading-none">🗑️</span>
          <span className="sr-only">Delete</span>
        </button>
      </td>
    </tr>
  );
});

// Map apiPath to schedule department_id
const API_PATH_TO_SCHEDULE_ID = {
  finance: "A1.1",
  accounting: "A1.2",
  hrd: "A1.3",
  "g&a": "A1.4",
  sdp: "A1.5",
  tax: "A1.6",
  "l&p": "A1.7",
  mis: "A1.8",
  merch: "A1.9",
  ops: "A1.10",
  whs: "A1.11",
};

export default function SopReviewDeptPage({ apiPath, departmentName }) {
  const { data: session } = useSession();
  const role = (session?.user?.role || "").toLowerCase();
  const isReviewer = role === "reviewer";
  const isAdmin = role === "admin";
  const isUser = role === "user";
  const [preparerStatus, setPreparerStatus] = useState("DRAFT");
  const [reviewerStatus, setReviewerStatus] = useState("DRAFT");
  const [sopData, setSopData] = useState([]);
  const deferredSopData = useDeferredValue(sopData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const [preparerName, setPreparerName] = useState("");
  const [preparerDate, setPreparerDate] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerDate, setReviewerDate] = useState("");
  const [reviewerComment, setReviewerComment] = useState("");
  const [schedulePreparerName, setSchedulePreparerName] = useState(""); // From schedule
  const [schedulePreparerDate, setSchedulePreparerDate] = useState(""); // From schedule

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);

  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const backHref = `/Page/sop-review${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ""}`;

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || ""));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-save draft refs (must be defined before useEffects)
  const saveDraftTimeoutRef = useRef(null);
  const isSavingDraftRef = useRef(false);
  const lastSavedDataRef = useRef(null);
  const isPublishingRef = useRef(false);

  const reindex = (list) => list.map((item, idx) => ({ ...item, no: idx + 1 }));

  const safeJson = async (res) => {
    const raw = await res.text().catch(() => "");
    try {
      return { data: raw ? JSON.parse(raw) : {}, raw };
    } catch (e) {
      return { data: null, raw };
    }
  };

  // Fetch schedule data for preparer (runs first)
  useEffect(() => {
    let mounted = true;
    async function fetchScheduleData() {
      try {
        const scheduleDeptId = API_PATH_TO_SCHEDULE_ID[apiPath];
        if (!scheduleDeptId) {
          console.warn(`No schedule department_id mapping for apiPath: ${apiPath}`);
          return;
        }

        const res = await fetch(`/api/schedule/module?module=sop-review`, { cache: "no-store" });
        const data = await res.json();
        
        if (data.success && Array.isArray(data.rows)) {
          const scheduleRow = data.rows.find(
            (row) => row.department_id === scheduleDeptId && row.is_configured
          );
          
          if (scheduleRow && mounted) {
            const userName = scheduleRow.user_name || "";
            // IMPORTANT: start_date from API is already in YYYY-MM-DD format (from PostgreSQL TO_CHAR)
            // Use it directly without any parsing or timezone conversion
            let startDate = "";
            if (scheduleRow.start_date) {
              const dateValue = scheduleRow.start_date;
              console.log(`[SOP Review] Schedule start_date for ${apiPath}:`, dateValue, "Type:", typeof dateValue);
              
              // API returns date as string in YYYY-MM-DD format (from TO_CHAR)
              if (typeof dateValue === 'string') {
                const dateStr = String(dateValue).trim();
                // Use directly if it's already in YYYY-MM-DD format
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  startDate = dateStr;
                  console.log(`[SOP Review] Using schedule start_date as-is (YYYY-MM-DD): ${startDate}`);
                } else {
                  // If it's ISO string with time, extract just the date part
                  if (dateStr.includes('T')) {
                    startDate = dateStr.split('T')[0];
                    console.log(`[SOP Review] Extracted date from ISO string: ${startDate}`);
                  } else {
                    console.warn(`[SOP Review] Unexpected date format: ${dateStr}`);
                    startDate = "";
                  }
                }
              }
              // If it's somehow a Date object (shouldn't happen with TO_CHAR, but handle it)
              else if (dateValue instanceof Date) {
                // Use local date components (not UTC) to preserve the date as stored
                const year = dateValue.getFullYear();
                const month = String(dateValue.getMonth() + 1).padStart(2, '0');
                const day = String(dateValue.getDate()).padStart(2, '0');
                startDate = `${year}-${month}-${day}`;
                console.log(`[SOP Review] Formatted schedule start_date using local date: ${startDate}`);
              }
              // If it's a number (timestamp) - shouldn't happen, but handle it
              else if (typeof dateValue === 'number') {
                const dateObj = new Date(dateValue);
                // Use local date components to preserve the date
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                startDate = `${year}-${month}-${day}`;
                console.log(`[SOP Review] Formatted schedule start_date from timestamp using local date: ${startDate}`);
              } else {
                console.warn(`[SOP Review] Unexpected date value type: ${typeof dateValue}`);
                startDate = "";
              }
              
              // Final validation
              if (startDate && !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                console.warn(`[SOP Review] Invalid date format after processing: ${startDate}`);
                startDate = "";
              }
            } else {
              console.warn(`[SOP Review] No start_date found in schedule for ${apiPath}`);
            }
            
            setSchedulePreparerName(userName);
            setSchedulePreparerDate(startDate);
            
            // Always set preparer from schedule (schedule takes priority)
            if (userName) {
              setPreparerName(userName);
            }
            if (startDate) {
              setPreparerDate(startDate);
              console.log(`[SOP Review] Set preparerDate to: ${startDate} from schedule per module`);
            }
          } else {
            console.warn(`[SOP Review] No schedule row found for ${apiPath} (deptId: ${API_PATH_TO_SCHEDULE_ID[apiPath]}) or not configured`);
          }
        }
      } catch (err) {
        console.error("Error fetching schedule data:", err);
      }
    }
    fetchScheduleData();
    return () => {
      mounted = false;
    };
  }, [apiPath]);

  useEffect(() => {
    let mounted = true;
    async function fetchRows() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const qs = yearParam ? `?year=${encodeURIComponent(yearParam)}` : "";
        const [res, metaRes] = await Promise.all([
          fetch(`/api/SopReview/${apiPath}${qs}`, { method: "GET" }),
          fetch(`/api/SopReview/${apiPath}/meta${qs}`, { method: "GET" }),
        ]);
        const [{ data: json, raw: rawSteps }, { data: metaJson, raw: rawMeta }] = await Promise.all([
          safeJson(res),
          safeJson(metaRes),
        ]);

        let loadedSopData = [];
        if (!res.ok) {
          const msg = (json && json.error) || `HTTP ${res.status} | ${rawSteps || "no body"}`;
          setLoadError(msg);
          setSopData([]);
        } else {
          const rows = Array.isArray(json?.rows) ? json.rows : [];
          const normalized = rows.map((r, idx) => ({
            id: r.id ?? null,
            no: r.no ?? idx + 1,
            sop_related: (r.sop_related || "").toString(),
            status: r.status || "DRAFT",
            comment: r.comment || "",
            reviewer_feedback: r.reviewer_feedback || "",
            reviewer: r.reviewer || "",
          }));
          if (mounted) {
            const reindexed = reindex(normalized);
            setSopData(reindexed);
            loadedSopData = reindexed;
          } else {
            loadedSopData = reindex(normalized);
          }
        }

        // Load and set meta data, then update lastSavedDataRef
        if (metaRes.ok && Array.isArray(metaJson?.rows) && metaJson.rows.length > 0) {
          const latest = metaJson.rows[0];
          if (mounted) {
            setPreparerStatus(latest.preparer_status || "DRAFT");
            setReviewerStatus(latest.reviewer_status || "DRAFT");
            
            // Schedule data takes priority for preparer (already set in schedule useEffect)
            // IMPORTANT: Only use meta data if schedule data is NOT available
            // If schedule per module has start_date, it should always be used
            if (!schedulePreparerName) {
              setPreparerName(latest.preparer_name || "");
            }
            // CRITICAL: Schedule per module start_date ALWAYS takes priority over meta data
            // Only use meta preparer_date if schedule per module doesn't have start_date
            if (schedulePreparerDate) {
              // Schedule per module has start_date, ALWAYS use it (override meta)
              console.log(`[SOP Review] Schedule per module start_date found: ${schedulePreparerDate}, ALWAYS using it instead of meta`);
              // Force update preparerDate from schedule per module
              setPreparerDate(schedulePreparerDate);
            } else {
              // No schedule per module start_date, use meta as fallback
              let preparerDateStr = "";
              if (latest.preparer_date) {
                const dateStr = String(latest.preparer_date);
                if (dateStr.includes('T')) {
                  preparerDateStr = dateStr.split('T')[0];
                } else {
                  preparerDateStr = dateStr.slice(0, 10);
                }
                // Ensure it's in YYYY-MM-DD format using UTC to avoid timezone shift
                if (!preparerDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const dateObj = new Date(latest.preparer_date);
                  if (!isNaN(dateObj.getTime())) {
                    const year = dateObj.getUTCFullYear();
                    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getUTCDate()).padStart(2, '0');
                    preparerDateStr = `${year}-${month}-${day}`;
                  } else {
                    preparerDateStr = "";
                  }
                }
              }
              setPreparerDate(preparerDateStr);
              console.log(`[SOP Review] No schedule per module start_date, using meta preparer_date as fallback: ${preparerDateStr}`);
            }
            setReviewerComment(latest.reviewer_comment || "");
            setReviewerName(latest.reviewer_name || "");
            setReviewerDate(latest.reviewer_date ? String(latest.reviewer_date).slice(0, 10) : "");
          }
          
          // Update last saved data reference after loading all data
          // This ensures auto-save doesn't trigger on initial load
          // IMPORTANT: Use schedule per module date if available (it takes priority)
          const finalPreparerDate = schedulePreparerDate || (latest.preparer_date ? String(latest.preparer_date).slice(0, 10) : "");
          const finalPreparerName = schedulePreparerName || latest.preparer_name || "";
          const loadedData = {
            sopData: loadedSopData,
            reviewerStatus: latest.reviewer_status || "DRAFT",
            reviewerName: latest.reviewer_name || "",
            reviewerDate: latest.reviewer_date ? String(latest.reviewer_date).slice(0, 10) : "",
            reviewerComment: latest.reviewer_comment || "",
            preparerStatus: latest.preparer_status || "DRAFT",
            preparerName: finalPreparerName,
            preparerDate: finalPreparerDate,
          };
          lastSavedDataRef.current = JSON.stringify(loadedData);
        } else if (!metaRes.ok) {
          console.error("Load meta failed:", rawMeta);
          // Even if meta load fails, update lastSavedDataRef with current state
          // Use schedule per module date if available
          const finalPreparerDate = schedulePreparerDate || "";
          const finalPreparerName = schedulePreparerName || "";
          const loadedData = {
            sopData: loadedSopData,
            reviewerStatus: "DRAFT",
            reviewerName: "",
            reviewerDate: "",
            reviewerComment: "",
            preparerStatus: "DRAFT",
            preparerName: finalPreparerName,
            preparerDate: finalPreparerDate,
          };
          lastSavedDataRef.current = JSON.stringify(loadedData);
        }
      } catch (err) {
        console.error("Fetch existing sops error:", err);
        setLoadError(String(err));
        setSopData([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    // Only fetch rows after schedule data is loaded (to ensure schedule takes priority)
    // Add a small delay to ensure schedule useEffect has completed
    const timeoutId = setTimeout(() => {
      fetchRows();
    }, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [apiPath, schedulePreparerName, schedulePreparerDate]);
  
  // Ensure schedule per module date is always used (even after meta data loads or user tries to change it)
  // This useEffect runs whenever schedulePreparerDate changes and ensures it overrides any meta data or user changes
  useEffect(() => {
    if (schedulePreparerDate) {
      console.log(`[SOP Review] Ensuring schedule per module start_date is used: ${schedulePreparerDate}`);
      // Always override preparerDate with schedule per module date
      setPreparerDate(schedulePreparerDate);
    }
  }, [schedulePreparerDate]);
  
  // Prevent user from changing preparerDate if schedule per module has start_date
  useEffect(() => {
    if (schedulePreparerDate && isUser && preparerDate !== schedulePreparerDate) {
      console.warn(`[SOP Review] User tried to change preparerDate from ${preparerDate} to different value, but schedule per module has: ${schedulePreparerDate}. Reverting...`);
      setPreparerDate(schedulePreparerDate);
    }
  }, [preparerDate, schedulePreparerDate, isUser]);

  const handleSopParsed = (parsedSops) => {
    if (!Array.isArray(parsedSops) || parsedSops.length === 0) return;
    setSopData((prev) => {
      // Keep append behavior additive across uploads.
      // Only de-duplicate items inside the current parsed batch.
      const batchTitles = new Set();
      const newItems = parsedSops
        .map((it) => ({
          id: it.id ?? null,
          sop_related: (it.sop_related || it.name || "").trim(),
          // Default status after append: IN REVIEW
          status: it.status || "IN REVIEW",
          comment: it.comment || it.reviewer_comment || "",
          reviewer_feedback: it.reviewer_feedback || "",
          reviewer: it.reviewer || "",
        }))
        .filter((it) => {
          const key = (it.sop_related || "").toLowerCase();
          if (!key) return false;
          if (batchTitles.has(key)) return false;
          batchTitles.add(key);
          return true;
        });
      return reindex([...prev, ...newItems]);
    });
  };

  const updateRow = useCallback((index, changes) => {
    setSopData((prev) => {
      const target = prev[index];
      if (!target) return prev;

      // Skip state update when nothing actually changes
      const nextRow = { ...target, ...changes };
      let changed = false;
      for (const key of Object.keys(changes || {})) {
        if (target[key] !== nextRow[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;

      // Keep other row references intact so memoized rows do not re-render.
      const next = [...prev];
      next[index] = nextRow;
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    setSopData((prev) =>
      reindex([
        ...prev,
        {
          id: null,
          sop_related: "",
          // Default status for new manual row: IN REVIEW
          status: "IN REVIEW",
          comment: "",
          reviewer_feedback: "",
          reviewer: "",
        },
      ])
    );
  }, []);

  const removeRow = useCallback((index) => {
    setSopData((prev) => reindex(prev.filter((_, i) => i !== index)));
  }, []);

  const preparePayload = useCallback((list) =>
    reindex(list).map((it) => ({
      no: it.no,
      sop_related: (it.sop_related || "").trim(),
      status: it.status || null,
      comment: it.comment || null,
      reviewer_feedback: it.reviewer_feedback || null,
      reviewer: it.reviewer || null,
    })), []);

  // Auto-save draft functionality
  const saveDraft = useCallback(async (dataToSave, metaToSave = null) => {
    // Prevent multiple simultaneous saves
    if (isSavingDraftRef.current) return;
    
    // Check if data has actually changed (include reviewer fields in comparison)
    const currentData = {
      sopData: dataToSave,
      reviewerStatus,
      reviewerName,
      reviewerDate,
      reviewerComment,
      preparerStatus,
      preparerName,
      preparerDate,
    };
    const dataString = JSON.stringify(currentData);
    if (dataString === lastSavedDataRef.current) return;

    isSavingDraftRef.current = true;
    try {
      const stepsPayload = preparePayload(dataToSave);
      const metaPayload = metaToSave || {
        preparer_status: preparerStatus,
        preparer_name: preparerName || null,
        preparer_date: preparerDate || null,
        reviewer_comment: reviewerComment || null,
        reviewer_status: reviewerStatus,
        reviewer_name: reviewerName || null,
        reviewer_date: reviewerDate || null,
      };

      // Save data with replace mode (delete old data first, then insert new)
      const [metaRes, res] = await Promise.all([
        fetch(`/api/SopReview/${apiPath}/meta`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(metaPayload) 
        }),
        fetch(`/api/SopReview/${apiPath}`, { 
          method: "POST", 
          headers: { 
            "Content-Type": "application/json",
            "X-Replace-Mode": "true"  // Enable replace mode
          }, 
          body: JSON.stringify(stepsPayload) 
        }),
      ]);

      if (metaRes.ok && res.ok) {
        lastSavedDataRef.current = dataString;
        console.log("Draft auto-saved successfully (including reviewer fields)");
      } else {
        console.warn("Draft auto-save failed, but continuing...");
      }
    } catch (err) {
      console.error("Error auto-saving draft:", err);
      // Don't show error to user for auto-save failures
    } finally {
      isSavingDraftRef.current = false;
    }
  }, [apiPath, preparerStatus, preparerName, preparerDate, reviewerComment, reviewerStatus, reviewerName, reviewerDate, preparePayload]);

  // Auto-save when data stabilizes (with debounce)
  useEffect(() => {
    // Clear existing timeout
    if (saveDraftTimeoutRef.current) {
      clearTimeout(saveDraftTimeoutRef.current);
    }

    // Don't auto-save on initial load
    if (isLoading) return;

    // Debounce auto-save by 1.2 seconds to reduce save churn while typing
    saveDraftTimeoutRef.current = setTimeout(() => {
      // Save even if sopData is empty (to save reviewer fields)
      saveDraft(deferredSopData);
    }, 1200);

    return () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, [deferredSopData, isLoading, saveDraft, reviewerStatus, reviewerName, reviewerDate, reviewerComment]);

  const handleSidebarSaveDraft = (sidebarData) => {
    try {
      if (sidebarData?.preparerStatus) setPreparerStatus(sidebarData.preparerStatus);
      if (sidebarData?.reviewerStatus) setReviewerStatus(sidebarData.reviewerStatus);
      if (sidebarData?.preparerName !== undefined) setPreparerName(sidebarData.preparerName || "");
      if (sidebarData?.preparerDate !== undefined) setPreparerDate(sidebarData.preparerDate || "");
      if (sidebarData?.reviewerName !== undefined) setReviewerName(sidebarData.reviewerName || "");
      if (sidebarData?.reviewerDate !== undefined) setReviewerDate(sidebarData.reviewerDate || "");
      if (sidebarData?.reviewerComment !== undefined) setReviewerComment(sidebarData.reviewerComment || "");

      setSaveMessage({ type: "success", text: "Sidebar draft saved locally. Click Publish to save it to the server." });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Save sidebar error:", err);
      setSaveMessage({ type: "error", text: "Failed to save sidebar draft." });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleToggleHeader = () => {
    setIsHeaderCollapsed(prev => !prev);
  };

  const isPublishAllowed =
    String(preparerStatus || "").toUpperCase() === "APPROVED" &&
    String(reviewerStatus || "").toUpperCase() === "APPROVED";

  async function postJson(url, body) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text().catch(() => "");
    try { return text ? JSON.parse(text) : {}; } catch (e) { return { success: false, error: "Invalid JSON response", rawText: text }; }
  }

  const publishToReport = async () => {
    if (isPublishingRef.current) return;
    if (sopData.length === 0) {
      setSaveMessage({ type: "error", text: "No SOP items to publish." });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    if (!isPublishAllowed) {
      setSaveMessage({
        type: "error",
        text: "Publish is only allowed when both Preparer and Reviewer statuses are APPROVED.",
      });
      setTimeout(() => setSaveMessage(null), 4000);
      return;
    }

    isPublishingRef.current = true;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Send steps + meta directly in publish body - single source of truth, avoids DB read race and duplicate rows
      const meta = {
        department_name: departmentName,
        preparer_status: preparerStatus,
        preparer_name: preparerName || null,
        preparer_date: preparerDate || null,
        reviewer_comment: reviewerComment || null,
        reviewer_status: reviewerStatus,
        reviewer_name: reviewerName || null,
        reviewer_date: reviewerDate || null,
      };
      const pubRes = await fetch(`/api/SopReview/${apiPath}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: sopData, meta }),
      });
      const pubJson = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok || !pubJson.success) {
        throw new Error(pubJson.error || `Publish failed (HTTP ${pubRes.status})`);
      }

      setSaveMessage({ type: "success", text: `✅ Published ${pubJson.published ?? sopData.length} SOP to Report. Department data has been cleared.` });

      // 3) Clear local state + refresh
      setSopData([]);
      setPreparerStatus("DRAFT");
      setReviewerStatus("DRAFT");
      setPreparerName("");
      setPreparerDate("");
      setReviewerName("");
      setReviewerDate("");
      setReviewerComment("");
    } catch (err) {
      console.error("Publish error:", err);
      setSaveMessage({ type: "error", text: err?.message || "Failed to publish." });
    } finally {
      isPublishingRef.current = false;
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const openPublishModal = () => {
    if (sopData.length === 0) {
      setSaveMessage({ type: "error", text: "No SOP items to publish." });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    setPublishModalOpen(true);
  };


  // Status badge function (kept for compatibility but now using inline styling)
  const getStatusBadge = (status) => {
    return ""; // No longer needed since we use inline styling in the select
  };

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-40">
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            if (window.history.length > 1) {
              window.history.back();
              return;
            }
            window.location.href = backHref;
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full shadow-md hover:shadow-lg border border-slate-300 bg-white/95 text-xs sm:text-sm font-semibold text-slate-700 transition-all duration-300"
          title="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      {/* Integrated Header with SOP Source & Status */}
      <SOPHeader
        department={departmentName}
        apiPath={apiPath}
        preparerStatus={preparerStatus}
        reviewerStatus={reviewerStatus}
        onPreparerStatusChange={setPreparerStatus}
        onReviewerStatusChange={setReviewerStatus}
        preparerName={preparerName}
        preparerDate={preparerDate}
        reviewerComment={reviewerComment}
        reviewerName={reviewerName}
        reviewerDate={reviewerDate}
        onPreparerNameChange={setPreparerName}
        onPreparerDateChange={(newDate) => {
          // Prevent user from changing date if schedule per module has start_date
          if (schedulePreparerDate && isUser) {
            console.warn(`[SOP Review] Cannot change preparer date - it's set from schedule per module: ${schedulePreparerDate}`);
            return; // Ignore the change
          }
          setPreparerDate(newDate);
        }}
        onReviewerCommentChange={setReviewerComment}
        onReviewerNameChange={setReviewerName}
        onReviewerDateChange={setReviewerDate}
        onSaveSidebar={handleSidebarSaveDraft}
        onSopParsed={handleSopParsed}
        isPublishing={isSaving}
        saveMessage={saveMessage}
        isReviewer={isReviewer}
        isAdmin={isAdmin}
        isUser={isUser}
        schedulePreparerName={schedulePreparerName}
        schedulePreparerDate={schedulePreparerDate}
        sopDataCount={sopData.length}
        isCollapsed={isHeaderCollapsed}
        onToggleCollapse={handleToggleHeader}
      />

      <div className={`px-3 sm:px-4 pb-4 flex flex-col h-full transition-all duration-500 ease-in-out ${
        isHeaderCollapsed ? 'pt-16' : 'pt-28'
      }`}>
        {/* SOP table */}
        <div className="flex-1 min-w-0 w-full h-full flex flex-col">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-600 bg-white rounded-lg border border-gray-200">
              Loading SOPs from server...
            </div>
          ) : loadError ? (
            <div className="p-4 text-center text-sm text-red-600 bg-white rounded-lg border border-gray-200">
              Failed to load data: {loadError}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-lg overflow-hidden flex-1 flex flex-col min-h-0">
              {/* Table Header with SOP title moved here */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-blue-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-blue-600 text-sm font-bold">📋</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">SOP Source &amp; Status</span>
                    <span className="text-xs text-slate-500">{departmentName}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs font-medium text-slate-700">📊</span>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                        sopData.length > 0
                          ? "bg-green-100 text-green-800 border-green-300"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {sopData.length > 0 ? "AVAILABLE" : "Not Available"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end text-xs text-slate-500">
                  <div className="hidden sm:flex items-center gap-1 text-slate-600">
                    <span className="text-[11px]">Total SOP:</span>
                    <span className="text-[11px] font-semibold text-blue-700">{sopData.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addRow}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md flex items-center gap-1"
                      title="Add new SOP item"
                    >
                      <span>➕</span>
                      <span className="hidden sm:inline">Add SOP Item</span>
                    </button>
                    {!isUser && (
                      <button
                        onClick={openPublishModal}
                        disabled={sopData.length === 0 || isSaving}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          sopData.length === 0 || isSaving
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
                        }`}
                      >
                        {isSaving ? "Publishing..." : "Publish"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Table Content - responsive: horizontal scroll when narrow; touch-friendly scroll + contain on Android */}
              <div
                className="overflow-x-auto overflow-y-auto flex-1 -mx-2 sm:mx-0 min-h-0"
                style={{ WebkitOverflowScrolling: "touch", contain: "layout" }}
              >
                <table className="min-w-[700px] w-full table-fixed border-collapse">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
                    <tr className="border-b border-slate-200/60">
                      <th className="p-3 text-center font-bold text-slate-700 border-r border-slate-200/40 w-12 sticky left-0 bg-gradient-to-r from-slate-100 to-slate-50">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs">No</span>
                        </div>
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700 border-r border-slate-200/40 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                            <span className="text-blue-600 text-xs">📝</span>
                          </span>
                          <span className="text-xs">SOP DESCRIPTION</span>
                        </div>
                      </th>
                      <th className="p-3 text-center font-bold text-slate-700 border-r border-slate-200/40 w-32">
                        <div className="flex items-center justify-center gap-1">
                          <span className="w-3 h-3 bg-yellow-100 rounded-full"></span>
                          <span className="text-xs">STATUS</span>
                        </div>
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700 border-r border-slate-200/40 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 bg-green-100 rounded flex items-center justify-center">
                            <span className="text-green-600 text-xs">💬</span>
                          </span>
                          <span className="text-xs">REVIEW COMMENT</span>
                        </div>
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700 border-r border-slate-200/40 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 bg-emerald-100 rounded flex items-center justify-center">
                            <span className="text-emerald-600 text-xs">🗣️</span>
                          </span>
                          <span className="text-xs">REVIEWER FEEDBACK</span>
                        </div>
                      </th>
                      <th className="p-3 text-center font-bold text-slate-700 border-r border-slate-200/40 w-28">
                        <div className="flex items-center gap-1">
                          <span className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center">
                            <span className="text-purple-600 text-xs">👤</span>
                          </span>
                          <span className="text-xs">REVIEWER</span>
                        </div>
                      </th>
                      <th className="p-3 text-center font-bold text-slate-700 w-20">
                        <span className="text-xs">ACTIONS</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sopData.map((row, idx) => (
                      <SopTableRow
                        key={row.id ?? idx}
                        row={row}
                        idx={idx}
                        onUpdate={updateRow}
                        // Open confirmation modal instead of deleting immediately
                        onRemove={setDeleteConfirmIndex}
                        isReviewer={isReviewer}
                        isAdmin={isAdmin}
                        isUser={isUser}
                        useContentVisibility={isMobileView && sopData.length > 12}
                      />
                    ))}
                    {sopData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="border-0">
                          <div className="flex flex-col items-center justify-center py-16 px-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4 shadow-lg">
                              <span className="text-3xl">📄</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">No SOP Items Yet</h3>
                            <p className="text-sm text-slate-500 text-center max-w-md mb-6">
                              Start by uploading a PDF document from the header above. The system will automatically extract SOP procedures and populate this table for review.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-full">
                              <span>Ready to process PDF documents</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Publish Modal (no alert/confirm) */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setPublishModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">Publish SOP Review</div>
                <div className="text-xs text-slate-600">
                  Department: <span className="font-semibold">{departmentName}</span> · Total SOP:{" "}
                  <span className="font-semibold">{sopData.length}</span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-2">Preparer</div>
                  <div className="text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Name</span>
                      <span className="font-semibold break-all">{preparerName || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Date</span>
                      <span className="font-semibold">{preparerDate || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`font-bold ${
                          String(preparerStatus || "").toUpperCase() === "APPROVED"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {preparerStatus || "DRAFT"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-2">Reviewer</div>
                  <div className="text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Name</span>
                      <span className="font-semibold break-all">{reviewerName || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Date</span>
                      <span className="font-semibold">{reviewerDate || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`font-bold ${
                          String(reviewerStatus || "").toUpperCase() === "APPROVED"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {reviewerStatus || "DRAFT"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-white bg-red-600 w-fit rounded-2xl px-2 py-0.5 ">Rule !</div>
                <div className="text-sm text-slate-600 mt-1">
                  Publish is only allowed when <span className="font-semibold">Preparer</span> and{" "}
                  <span className="font-semibold">Reviewer</span> statuses are{" "}
                  <span className="font-semibold">APPROVED</span>.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isPublishAllowed || isSaving}
                onClick={async () => {
                  setPublishModalOpen(false);
                  await publishToReport();
                }}
                className={`px-4 py-2 rounded-xl font-semibold text-white ${
                  !isPublishAllowed || isSaving
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md"
                }`}
              >
                {isSaving ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {deleteConfirmIndex !== null && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirmIndex(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">🗑️</span>
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">Delete SOP item</div>
                <div className="text-sm text-slate-600">Are you sure you want to delete this SOP item?</div>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                onClick={() => setDeleteConfirmIndex(null)}
              >
                No
              </button>
              <button
                type="button"
                className="px-5 py-2 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md transition-colors"
                onClick={() => {
                  if (deleteConfirmIndex !== null) {
                    removeRow(deleteConfirmIndex);
                  }
                  setDeleteConfirmIndex(null);
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

