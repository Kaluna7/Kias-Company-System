"use client";

import { useEffect, useMemo, useState, useRef, useCallback, useDeferredValue } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Pagination from "@/app/components/ui/Pagination";
import { useToast } from "@/app/contexts/ToastContext";
import { isAuditFindingCheckYes } from "@/lib/auditFindingCheckYn";

/** Preparer Status / Final Status must be COMPLETE (or Complete) before publish — same as dropdown value COMPLETED. */
function isAuditFindingHeaderStatusComplete(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  return s === "COMPLETED" || s === "COMPLETE";
}

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

function isValidFindingRowPayload(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function riskToApiValue(row) {
  if (row.risk === "" || row.risk === null || row.risk === undefined) return null;
  const n = typeof row.risk === "number" ? row.risk : parseInt(String(row.risk), 10);
  return Number.isFinite(n) ? n : null;
}

/** Baris tanpa id: simpan sebagai finding baru jika ada isian yang relevan (selaras dengan Save & Done). */
function shouldPersistNewFindingRow(row) {
  return !!(
    row.riskId ||
    row.riskDescription ||
    row.riskDetails ||
    row.apCode ||
    row.substantiveTest ||
    row.findingResult ||
    row.preparer ||
    (row.risk !== "" && row.risk != null && row.risk !== undefined) ||
    row.checkYN ||
    row.method ||
    row.findingDescription ||
    row.recommendation ||
    row.auditee ||
    row.completionDate
  );
}

function buildFindingRowPutBody(row) {
  return {
    riskId: row.riskId,
    riskDescription: row.riskDescription,
    riskDetails: row.riskDetails,
    apCode: row.apCode,
    substantiveTest: row.substantiveTest,
    risk: riskToApiValue(row),
    checkYN: row.checkYN,
    method: row.method,
    preparer: row.preparer,
    findingResult: row.findingResult,
    findingDescription: row.findingDescription,
    recommendation: row.recommendation,
    auditee: row.auditee,
    completionStatus: row.completionStatus,
    completionDate: row.completionDate || null,
  };
}

function buildFindingRowPostBody(row) {
  return {
    riskId: row.riskId || "",
    riskDescription: row.riskDescription || "",
    riskDetails: row.riskDetails || "",
    apCode: row.apCode || "",
    substantiveTest: row.substantiveTest || "",
    risk: riskToApiValue(row),
    checkYN: row.checkYN || "",
    method: row.method || "",
    preparer: row.preparer || "",
    findingResult: row.findingResult || "",
    findingDescription: row.findingDescription || "",
    recommendation: row.recommendation || "",
    auditee: row.auditee || "",
    completionStatus: row.completionStatus || "",
    completionDate: row.completionDate || null,
  };
}

async function parseSaveErrorResponse(res) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    if (j?.error) return j.error;
  } catch {
    /* ignore */
  }
  return text || `HTTP ${res.status}`;
}

export default function AuditFindingDeptClient({
  apiPath,
  titleCode,
  departmentLabel,
  description,
  initialData = [],
  initialMeta = null,
}) {
  const { data: session } = useSession();
  const toast = useToast();
  const role = (session?.user?.role || "").toLowerCase();
  const isReviewer = role === "reviewer";
  const isAdmin = role === "admin";
  const isUser = role === "user";
  const canPublish = isAdmin || isReviewer;
  const canEditFinalStatus = isAdmin || isReviewer;
  const searchParams = useSearchParams();
  const yearParam = searchParams?.get("year");
  const auditYear = useMemo(() => {
    if (yearParam != null && String(yearParam).trim() !== "") {
      const p = parseInt(String(yearParam), 10);
      if (Number.isFinite(p)) return p;
    }
    return new Date().getFullYear();
  }, [yearParam]);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Header inputs (kept like the old pages; table remains read-only)
  const storageKey = `auditFindingHeaderState:${apiPath}`;
  const [preparerStatus, setPreparerStatus] = useState("");
  const [finalStatus, setFinalStatus] = useState("");
  const [findingResult, setFindingResult] = useState("");
  const [prepare, setPrepare] = useState("");
  const [prepareDate, setPrepareDate] = useState("");
  const [review, setReview] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [schedulePreparerName, setSchedulePreparerName] = useState(""); // From schedule
  const [schedulePreparerDate, setSchedulePreparerDate] = useState(""); // From schedule

  const [tableData, setTableData] = useState(() => normalizeRows(initialData));
  const deferredTableData = useDeferredValue(tableData);
  const [findingMeta, setFindingMeta] = useState(initialMeta);
  const [isEditMode, setIsEditMode] = useState(false); // Global edit mode for all rows
  const [isScheduleConfigured, setIsScheduleConfigured] = useState(false); // Schedule configuration status
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Auto-save refs
  const saveMetaTimeoutRef = useRef(null);
  const isSavingMetaRef = useRef(false);
  const lastSavedMetaRef = useRef(null);
  
  // Auto-save table data refs
  const saveTableDataTimeoutRef = useRef(null);
  const isSavingTableDataRef = useRef(false);
  const lastSavedTableDataRef = useRef(null);
  const isTableDirtyRef = useRef(false);
  /** Selalu mirror isi tabel terkini (termasuk dalam updater setState) supaya Save & Done tidak baca state yang ketinggalan satu render. */
  const tableDataRef = useRef(normalizeRows(initialData));

  const statusOptions = useMemo(
    () => [
      { value: "", label: "- Select -" },
      { value: "Draft", label: "Draft" },
      { value: "Ready to Publish", label: "Ready to Publish" },
      { value: "COMPLETED", label: "COMPLETED" },
      { value: "IN PROGRESS", label: "IN PROGRESS" },
      { value: "PENDING REVIEW", label: "PENDING REVIEW" },
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

  const isMetaReadyForPublish = useMemo(
    () =>
      isAuditFindingHeaderStatusComplete(preparerStatus) &&
      isAuditFindingHeaderStatusComplete(finalStatus),
    [preparerStatus, finalStatus],
  );

  const canOpenPublishModal = useMemo(
    () => canPublish && (isScheduleConfigured || isAdmin),
    [canPublish, isScheduleConfigured, isAdmin],
  );

  /** Apply one row from GET /meta (or null = empty header). Keeps lastSavedMetaRef in sync for auto-save. */
  const applyHeaderMetaFromApiRow = useCallback((meta) => {
    if (meta && typeof meta === "object") {
      const pd = meta.prepare_date ? String(meta.prepare_date).slice(0, 10) : "";
      const rd = meta.review_date ? String(meta.review_date).slice(0, 10) : "";
      setPreparerStatus(meta.preparer_status || "");
      setFinalStatus(meta.final_status || "");
      setFindingResult(meta.finding_result || "");
      setPrepare(meta.prepare || "");
      setPrepareDate(pd);
      setReview(meta.review || "");
      setReviewDate(rd);
      lastSavedMetaRef.current = {
        preparerStatus: meta.preparer_status || "",
        finalStatus: meta.final_status || "",
        findingResult: meta.finding_result || "",
        prepare: meta.prepare || "",
        prepareDate: pd,
        review: meta.review || "",
        reviewDate: rd,
      };
    } else {
      setPreparerStatus("");
      setFinalStatus("");
      setFindingResult("");
      setPrepare("");
      setPrepareDate("");
      setReview("");
      setReviewDate("");
      lastSavedMetaRef.current = {
        preparerStatus: "",
        finalStatus: "",
        findingResult: "",
        prepare: "",
        prepareDate: "",
        review: "",
        reviewDate: "",
      };
    }
  }, []);

  const refreshHeaderMetaFromApi = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("year", String(auditYear));
      const res = await fetch(
        `/api/audit-finding/${encodeURIComponent(apiPath)}/meta?${params.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => null);
      if (json?.success) {
        applyHeaderMetaFromApiRow(json.data ?? null);
      } else {
        applyHeaderMetaFromApiRow(null);
      }
    } catch (err) {
      console.warn(`refreshHeaderMetaFromApi ${apiPath}:`, err);
      applyHeaderMetaFromApiRow(null);
    }
  }, [apiPath, auditYear, applyHeaderMetaFromApiRow]);

  // Ensure prepareDate is set from schedule if available
  useEffect(() => {
    if (schedulePreparerDate) {
      setPrepareDate(schedulePreparerDate);
    }
  }, [schedulePreparerDate]);

  // Prevent manual changes to prepareDate if schedule date is set
  useEffect(() => {
    if (schedulePreparerDate && isUser && prepareDate !== schedulePreparerDate) {
      setPrepareDate(schedulePreparerDate);
    }
  }, [schedulePreparerDate, isUser, prepareDate]);

  // Fetch meta from API (scoped by audit year). Do not use localStorage when the server returns an empty row — that caused stale header after Publish.
  useEffect(() => {
    let mounted = true;
    async function fetchMetaData() {
      try {
        const params = new URLSearchParams();
        params.set("year", String(auditYear));
        const res = await fetch(
          `/api/audit-finding/${encodeURIComponent(apiPath)}/meta?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          console.warn(`Failed to fetch meta data for ${apiPath}`);
          if (!mounted) return;
          applyHeaderMetaFromApiRow(null);
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              setPreparerStatus(parsed.preparerStatus ?? "");
              setFinalStatus(parsed.finalStatus ?? "");
              setFindingResult(parsed.findingResult ?? "");
              setPrepare(parsed.prepare ?? "");
              setPrepareDate(parsed.prepareDate ?? "");
              setReview(parsed.review ?? "");
              setReviewDate(parsed.reviewDate ?? "");
              lastSavedMetaRef.current = {
                preparerStatus: parsed.preparerStatus ?? "",
                finalStatus: parsed.finalStatus ?? "",
                findingResult: parsed.findingResult ?? "",
                prepare: parsed.prepare ?? "",
                prepareDate: parsed.prepareDate ?? "",
                review: parsed.review ?? "",
                reviewDate: parsed.reviewDate ?? "",
              };
            }
          } catch {
            /* ignore */
          }
          return;
        }
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (json?.success) {
          applyHeaderMetaFromApiRow(json.data ?? null);
          return;
        }
        applyHeaderMetaFromApiRow(null);
      } catch (err) {
        console.warn(`Error fetching meta data for ${apiPath}:`, err);
        if (!mounted) return;
        applyHeaderMetaFromApiRow(null);
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            setPreparerStatus(parsed.preparerStatus ?? "");
            setFinalStatus(parsed.finalStatus ?? "");
            setFindingResult(parsed.findingResult ?? "");
            setPrepare(parsed.prepare ?? "");
            setPrepareDate(parsed.prepareDate ?? "");
            setReview(parsed.review ?? "");
            setReviewDate(parsed.reviewDate ?? "");
            lastSavedMetaRef.current = {
              preparerStatus: parsed.preparerStatus ?? "",
              finalStatus: parsed.finalStatus ?? "",
              findingResult: parsed.findingResult ?? "",
              prepare: parsed.prepare ?? "",
              prepareDate: parsed.prepareDate ?? "",
              review: parsed.review ?? "",
              reviewDate: parsed.reviewDate ?? "",
            };
          }
        } catch {
          /* ignore */
        }
      }
    }
    fetchMetaData();
    return () => {
      mounted = false;
    };
  }, [apiPath, auditYear, applyHeaderMetaFromApiRow, storageKey]);

  // Auto-save meta data to API
  const saveMetaData = useCallback(async () => {
    if (isSavingMetaRef.current) return;

    const currentMeta = {
      preparerStatus,
      finalStatus,
      findingResult,
      prepare,
      prepareDate,
      review,
      reviewDate,
    };

    // Skip if no changes
    if (lastSavedMetaRef.current) {
      const hasChanges = Object.keys(currentMeta).some(
        (key) => currentMeta[key] !== lastSavedMetaRef.current[key]
      );
      if (!hasChanges) return;
    }

    isSavingMetaRef.current = true;
    try {
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/meta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Replace-Mode": "true",
        },
        body: JSON.stringify({
          preparer_status: preparerStatus,
          final_status: finalStatus,
          finding_result: findingResult,
          prepare: prepare,
          prepare_date: prepareDate,
          review: review,
          review_date: reviewDate,
        }),
      });

      if (res.ok) {
        const responseData = await res.json().catch(() => null);
        if (responseData?.success && responseData?.data) {
          // Update lastSavedMetaRef with the saved data from server
          const saved = responseData.data;
          lastSavedMetaRef.current = {
            preparerStatus: saved.preparer_status || "",
            finalStatus: saved.final_status || "",
            findingResult: saved.finding_result || "",
            prepare: saved.prepare || "",
            prepareDate: saved.prepare_date ? String(saved.prepare_date).slice(0, 10) : "",
            review: saved.review || "",
            reviewDate: saved.review_date ? String(saved.review_date).slice(0, 10) : "",
          };
        } else {
          // Fallback to current meta if response doesn't have data
          lastSavedMetaRef.current = { ...currentMeta };
        }
      } else {
        const errorText = await res.text().catch(() => "");
        console.warn("Failed to save meta data:", res.status, errorText);
      }
    } catch (err) {
      console.warn("Error saving meta data:", err);
    } finally {
      isSavingMetaRef.current = false;
    }
  }, [
    apiPath,
    preparerStatus,
    finalStatus,
    findingResult,
    prepare,
    prepareDate,
    review,
    reviewDate,
  ]);

  // Auto-save with debounce
  useEffect(() => {
    // Clear existing timeout
    if (saveMetaTimeoutRef.current) {
      clearTimeout(saveMetaTimeoutRef.current);
    }

    // Skip initial load (when lastSavedMetaRef is null or not yet initialized)
    // But allow save if lastSavedMetaRef has been initialized (even if empty)
    if (lastSavedMetaRef.current === null) {
      return;
    }

    // Debounce save by 1 second
    saveMetaTimeoutRef.current = setTimeout(() => {
      saveMetaData();
    }, 1000);

    return () => {
      if (saveMetaTimeoutRef.current) {
        clearTimeout(saveMetaTimeoutRef.current);
      }
    };
  }, [
    saveMetaData,
    preparerStatus,
    finalStatus,
    findingResult,
    prepare,
    prepareDate,
    review,
    reviewDate,
  ]);

  // Also persist to localStorage as backup
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          preparerStatus,
          finalStatus,
          findingResult,
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
    prepare,
    prepareDate,
    review,
    reviewDate,
  ]);

  async function fetchData(page) {
    const pageNum = page ?? findingMeta?.page ?? 1;
    const pageSize = findingMeta?.pageSize ?? 50;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(pageSize) });
      params.set("year", String(auditYear));
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}?${params.toString()}`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to fetch data");
      const rawRows = Array.isArray(json?.data) ? json.data : [];
      const sanitizedRows = rawRows.filter(isValidFindingRowPayload);
      if (rawRows.length !== sanitizedRows.length) {
        console.warn(
          `[Audit Finding] Ignored ${rawRows.length - sanitizedRows.length} invalid row(s) from API ${apiPath}.`,
        );
      }
      const normalized = normalizeRows(sanitizedRows);
      setTableData(normalized);
      tableDataRef.current = normalized;
      // Sinkronkan snapshot terakhir yang tersimpan supaya:
      // - tombol Cancel mengembalikan ke state ini
      // - auto-save tidak menimpa perubahan yang baru saja di-load
      lastSavedTableDataRef.current = JSON.parse(JSON.stringify(normalized));
      isTableDirtyRef.current = false;
      if (json.meta) setFindingMeta(json.meta);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Map apiPath to schedule department_id
  const API_PATH_TO_SCHEDULE_ID = {
    finance: "A1.1",
    accounting: "A1.2",
    hrd: "A1.3",
    "g&a": "A1.4",
    ga: "A1.4",
    sdp: "A1.5",
    tax: "A1.6",
    "l&p": "A1.7",
    lp: "A1.7",
    mis: "A1.8",
    merch: "A1.9",
    ops: "A1.10",
    whs: "A1.11",
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

        const res = await fetch(
          `/api/schedule/module?module=audit-finding&year=${encodeURIComponent(String(auditYear))}`,
          { cache: "no-store" }
        );
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
              console.log(`[Audit Finding] Schedule start_date for ${apiPath}:`, dateValue, "Type:", typeof dateValue);
              
              // API returns date as string in YYYY-MM-DD format (from TO_CHAR)
              if (typeof dateValue === 'string') {
                const dateStr = String(dateValue).trim();
                // Use directly if it's already in YYYY-MM-DD format
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  startDate = dateStr;
                  console.log(`[Audit Finding] Using schedule start_date as-is (YYYY-MM-DD): ${startDate}`);
                } else {
                  // If it's ISO string with time, extract just the date part
                  if (dateStr.includes('T')) {
                    startDate = dateStr.split('T')[0];
                    console.log(`[Audit Finding] Extracted date from ISO string: ${startDate}`);
                  } else {
                    console.warn(`[Audit Finding] Unexpected date format: ${dateStr}`);
                    startDate = "";
                  }
                }
              }
              // If it's somehow a Date object (shouldn't happen with TO_CHAR, but handle it)
              else if (dateValue instanceof Date) {
                // Use UTC date components to preserve the date as stored
                const year = dateValue.getUTCFullYear();
                const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
                const day = String(dateValue.getUTCDate()).padStart(2, '0');
                startDate = `${year}-${month}-${day}`;
                console.log(`[Audit Finding] Formatted schedule start_date using UTC date: ${startDate}`);
              }
              // If it's a number (timestamp) - shouldn't happen, but handle it
              else if (typeof dateValue === 'number') {
                const dateObj = new Date(dateValue);
                // Use UTC date components to preserve the date
                const year = dateObj.getUTCFullYear();
                const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getUTCDate()).padStart(2, '0');
                startDate = `${year}-${month}-${day}`;
                console.log(`[Audit Finding] Formatted schedule start_date from timestamp using UTC date: ${startDate}`);
              } else {
                console.warn(`[Audit Finding] Unexpected date value type: ${typeof dateValue}`);
                startDate = "";
              }
              
              // Final validation
              if (startDate && !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                console.warn(`[Audit Finding] Invalid date format after processing: ${startDate}`);
                startDate = "";
              }
            } else {
              console.warn(`[Audit Finding] No start_date found in schedule for ${apiPath}`);
            }
            
            setSchedulePreparerName(userName);
            setSchedulePreparerDate(startDate);
            setIsScheduleConfigured(true);
            
            // Always set preparer from schedule (schedule takes priority)
            if (userName) {
              setPrepare(userName);
            }
            if (startDate) {
              setPrepareDate(startDate);
              console.log(`[Audit Finding] Set prepareDate to: ${startDate} from schedule per module`);
            }
          } else if (mounted) {
            setIsScheduleConfigured(false);
            setSchedulePreparerName("");
            setSchedulePreparerDate("");
          }
        }
      } catch (err) {
        console.warn(`[Audit Finding] Error fetching schedule data for ${apiPath}:`, err);
        if (mounted) {
          setIsScheduleConfigured(false);
          setSchedulePreparerName("");
          setSchedulePreparerDate("");
        }
      }
    }
    fetchScheduleData();
    return () => {
      mounted = false;
    };
  }, [apiPath, auditYear]);

  useEffect(() => {
    // Jangan timpa tabel dari props jika user punya edit lokal — ref dirty bisa false jika ada race; cek dirty saja.
    if (isTableDirtyRef.current) {
      return;
    }
    const normalized = normalizeRows(initialData);
    setTableData(normalized);
    tableDataRef.current = normalized;
    if (initialMeta) setFindingMeta(initialMeta);
    lastSavedTableDataRef.current = JSON.parse(JSON.stringify(normalized));
    isTableDirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, initialData, initialMeta]);

  useEffect(() => {
    tableDataRef.current = tableData;
  }, [tableData]);

  // Simpan semua baris ke API (dipakai auto-save setelah keluar edit mode, Save & Done, dan sebelum publish).
  // `force`: abaikan flag dirty (wajib untuk Save & Done / publish — dirty bisa tidak ter-set atau ke-reset).
  // Melempar Error jika ada request yang gagal agar caller bisa menampilkan pesan — bukan diam-diam gagal.
  const saveTableData = useCallback(async (options = {}) => {
    const force = options.force === true;
    if (isSavingTableDataRef.current) return;
    if (!force && !isTableDirtyRef.current) return;

    isSavingTableDataRef.current = true;
    try {
      const updatedTableData = JSON.parse(JSON.stringify(tableDataRef.current));

      for (let i = 0; i < updatedTableData.length; i++) {
        const row = updatedTableData[i];
        const numericId = row.id != null ? Number(row.id) : null;
        const hasValidId = Number.isFinite(numericId) && numericId > 0;

        if (hasValidId) {
          const saveUrl = `/api/audit-finding/${encodeURIComponent(apiPath)}/${numericId}?year=${encodeURIComponent(String(auditYear))}`;
          const res = await fetch(saveUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildFindingRowPutBody(row)),
          });
          if (!res.ok) {
            const msg = await parseSaveErrorResponse(res);
            throw new Error(msg || `Failed to save row ${numericId}`);
          }
        } else if (shouldPersistNewFindingRow(row)) {
          const createUrl = `/api/audit-finding/${encodeURIComponent(apiPath)}?year=${encodeURIComponent(String(auditYear))}`;
          const res = await fetch(createUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildFindingRowPostBody(row)),
          });
          if (!res.ok) {
            const msg = await parseSaveErrorResponse(res);
            throw new Error(msg || "Failed to create finding row");
          }
          const created = await res.json().catch(() => null);
          if (created?.data?.id != null) {
            updatedTableData[i].id = created.data.id;
          }
        }
      }

      setTableData(updatedTableData);
      tableDataRef.current = updatedTableData;
      lastSavedTableDataRef.current = JSON.parse(JSON.stringify(updatedTableData));
      isTableDirtyRef.current = false;
    } finally {
      isSavingTableDataRef.current = false;
    }
  }, [apiPath, auditYear]);

  // Auto-save table data with debounce.
  // Penting: JANGAN auto-save ketika user sedang edit (isEditMode=true),
  // supaya tidak terasa seperti halaman "auto refresh" saat mengetik.
  useEffect(() => {
    // Kalau masih initial load atau user sedang edit, jangan auto-save.
    if (lastSavedTableDataRef.current === null || isEditMode) {
      return;
    }

    // Clear existing timeout
    if (saveTableDataTimeoutRef.current) {
      clearTimeout(saveTableDataTimeoutRef.current);
    }

    // Debounce save by 1 detik
    saveTableDataTimeoutRef.current = setTimeout(() => {
      saveTableData().catch((err) => {
        console.warn("Auto-save failed:", err);
        toast.show(err?.message || "Auto-save failed", "error");
      });
    }, 1000);

    return () => {
      if (saveTableDataTimeoutRef.current) {
        clearTimeout(saveTableDataTimeoutRef.current);
      }
    };
  }, [saveTableData, tableData, isEditMode]);

  // Handle cell edit
  const handleCellEdit = useCallback((rowIndex, field, value) => {
    setTableData((prev) => {
      const row = prev[rowIndex];
      if (!row || row[field] === value) return prev;
      const updated = [...prev];
      const next = { ...row, [field]: value };
      const completed = String(row.completionStatus || "").toUpperCase() === "COMPLETED";
      if (field === "checkYN" && !completed) {
        next.completionStatus = isAuditFindingCheckYes(value) ? "Ready to Publish" : "Draft";
      }
      updated[rowIndex] = next;
      isTableDirtyRef.current = true;
      tableDataRef.current = updated;
      return updated;
    });
  }, []);

  // Handle toggle edit mode
  const handleToggleEditMode = () => {
    if (isReviewer) return; // Reviewer cannot toggle edit mode
    setIsEditMode(!isEditMode);
  };

  // Handle cancel edit mode
  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Kembalikan data tabel ke snapshot terakhir yang tersimpan (bukan hitung ulang dari server),
    // supaya completion_status yang sudah benar (mis. Ready to Publish) tidak ikut di-reset ke Draft.
    if (lastSavedTableDataRef.current) {
      // Clone deep supaya tidak share reference
      const cloned = JSON.parse(JSON.stringify(lastSavedTableDataRef.current));
      isTableDirtyRef.current = false;
      tableDataRef.current = cloned;
      setTableData(cloned);
    } else {
      // Fallback: kalau belum ada snapshot, reload dari server
      fetchData();
    }
  };

  // Handle publish (user will click manually, not auto publish)
  // Publish uses rows with CHECK (Y/N) = Yes (COMPLETION STATUS shows Ready to Publish).
  // Save all current edits first so data is persisted before publish.
  const handlePublish = async () => {
    if (!isScheduleConfigured && !isAdmin) {
      toast.show("Sorry, no schedule", "error");
      return;
    }
    if (!isMetaReadyForPublish) {
      toast.show(
        "Publish requires both Preparer Status and Final Status to be COMPLETE. Set them in the header and wait for auto-save (or refresh the page after saving).",
        "error",
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await saveTableData({ force: true });

      // Double-check schedule before publishing (non-admin only)
      if (!isAdmin) {
        const apiPathToDeptId = {
          finance: "A1.1",
          accounting: "A1.2",
          hrd: "A1.3",
          "g&a": "A1.4",
          ga: "A1.4",
          sdp: "A1.5",
          tax: "A1.6",
          "l&p": "A1.7",
          lp: "A1.7",
          mis: "A1.8",
          merch: "A1.9",
          ops: "A1.10",
          whs: "A1.11",
        };

        const deptId = apiPathToDeptId[apiPath];
        if (deptId) {
          const scheduleRes = await fetch(
            `/api/schedule/module?module=audit-finding&year=${encodeURIComponent(String(auditYear))}`,
            {
            next: { revalidate: 0 },
            }
          );

          if (scheduleRes.ok) {
            const scheduleJson = await scheduleRes.json();
            if (scheduleJson.success && Array.isArray(scheduleJson.rows)) {
              const scheduleRow = scheduleJson.rows.find(
                (row) => row.department_id === deptId && row.is_configured === true,
              );

              if (!scheduleRow) {
                toast.show("Sorry, no schedule", "error");
                setLoading(false);
                return;
              }
            } else {
              toast.show("Sorry, no schedule", "error");
              setLoading(false);
              return;
            }
          } else {
            toast.show("Sorry, no schedule", "error");
            setLoading(false);
            return;
          }
        }
      }
      
      // Publish findings where CHECK (Y/N) = Yes (saved as Ready to Publish on the server)
      const publishUrl = `/api/audit-finding/${encodeURIComponent(apiPath)}/publish?year=${encodeURIComponent(String(auditYear))}`;
      const res = await fetch(publishUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to publish findings");
      
      const count = json?.count ?? 0;
      if (count === 0) {
        toast.show(
          json?.message ||
            "No findings to publish. Set CHECK (Y/N) to Yes in Audit Finding (COMPLETION STATUS becomes Ready to Publish), then publish.",
          "info",
        );
        setPublishModalOpen(false);
        return;
      }
      
      toast.show("Successfully published! Data is now available in Audit Review and Report.", "success");
      setPublishModalOpen(false);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setIsEditMode(false);
      await fetchData();
      await refreshHeaderMetaFromApi();
    } catch (e) {
      setError(e?.message || String(e));
      toast.show("Error: " + (e?.message || String(e)), "error");
    } finally {
      setLoading(false);
    }
  };

  const openPublishModal = () => {
    if (!canOpenPublishModal) return;
    setPublishModalOpen(true);
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
        const updateUrl = `/api/audit-finding/${encodeURIComponent(apiPath)}/${row.id}?year=${encodeURIComponent(String(auditYear))}`;
        const res = await fetch(updateUrl, {
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
        const createUrl = `/api/audit-finding/${encodeURIComponent(apiPath)}?year=${encodeURIComponent(String(auditYear))}`;
        const res = await fetch(createUrl, {
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
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRow = async (index) => {
    const row = tableData[index];
    // If no ID, this is data from audit-program (not yet saved as finding), so can't delete
    if (!row?.id) {
      toast.show("This data is from Audit Program. To remove it, you need to save it as a finding first, then delete it.", "info");
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

  // Save & keluar edit mode — satu jalur dengan saveTableData (sama dengan auto-save / pre-publish).
  const handleSaveAllChanges = async () => {
    try {
      setLoading(true);
      setError(null);
      await saveTableData({ force: true });
      setIsEditMode(false);
      await fetchData();
      toast.show("Changes saved.", "success");
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
      toast.show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/Page/audit-finding";
  }, []);

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      <div className="fixed z-40 top-3 left-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full shadow-md border border-slate-300 bg-white/95 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          title="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      {/* Header collapse toggle */}
      <div className="fixed z-40 top-3 right-4">
        <button
          onClick={() => setIsHeaderCollapsed((v) => !v)}
          className="w-11 h-9 flex items-center justify-center rounded-full shadow-md border border-slate-300 bg-white/95 text-sm font-semibold text-slate-700"
          title={isHeaderCollapsed ? "Show header" : "Hide header"}
        >
          {isHeaderCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Fixed Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 bg-gradient-to-br from-white via-slate-50/95 to-blue-50/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xl ${
          isHeaderCollapsed ? "hidden" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="px-6 py-4">
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
                      disabled={isReviewer}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      disabled={!canEditFinalStatus}
                      title={
                        !canEditFinalStatus
                          ? "Only admin or reviewer can change Final Status"
                          : undefined
                      }
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    <input
                      type="text"
                      value={findingResult}
                      onChange={(e) => setFindingResult(e.target.value)}
                      disabled={isReviewer}
                      className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Enter finding result"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">PREPARE</label>
                      <input
                        type="text"
                        value={prepare}
                        onChange={(e) => setPrepare(e.target.value)}
                        disabled={isReviewer || (isUser && schedulePreparerName)}
                        readOnly={isUser && schedulePreparerName}
                        suppressHydrationWarning
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">DATE</label>
                      <input
                        type="date"
                        value={prepareDate}
                        onChange={(e) => {
                          // Prevent changes if schedule date is set and user is regular user
                          if (schedulePreparerDate && isUser) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                          }
                          setPrepareDate(e.target.value);
                        }}
                        disabled={isReviewer || (isUser && schedulePreparerDate)}
                        readOnly={isUser && schedulePreparerDate}
                        suppressHydrationWarning
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={isAdmin || isUser}
                        readOnly={isAdmin || isUser}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">DATE</label>
                      <input
                        type="date"
                        value={reviewDate}
                        onChange={(e) => setReviewDate(e.target.value)}
                        disabled={isAdmin || isUser}
                        readOnly={isAdmin || isUser}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  title="Save all changes and exit edit mode"
                >
                  {loading ? "Saving..." : "Save & Done"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleToggleEditMode}
                  disabled={isReviewer}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Edit Mode"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={openPublishModal}
                  disabled={loading || !canOpenPublishModal}
                  className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                    loading || !canOpenPublishModal
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  }`}
                  title={
                    !isScheduleConfigured && !isAdmin
                      ? "Schedule not configured"
                      : !canPublish
                        ? "Only admins and reviewers can publish"
                        : "Review and publish findings"
                  }
                >
                  Publish
                </button>
              </>
            )}
          </div>
        </div>

        {canOpenPublishModal && !isMetaReadyForPublish && (
          <div className="mb-3 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 font-medium">
            To publish, set both <span className="font-semibold">Preparer Status</span> and{" "}
            <span className="font-semibold">Final Status</span> to <span className="font-semibold">COMPLETED</span> in
            the header above (they save automatically). Admin and reviewer only.
          </div>
        )}

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table - responsive: horizontal scroll when narrow */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4">
          <div className="overflow-x-auto overflow-y-visible rounded-lg border border-gray-200 shadow-sm -mx-2 sm:mx-0">
            <table className="w-full border-collapse text-xs min-w-[1600px]" style={{ tableLayout: "fixed" }}>
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
                {deferredTableData.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="p-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-gray-600">No Data</p>
                        <p className="text-sm text-gray-400 mt-1">No findings available</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  deferredTableData.map((row, index) => {
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
                      {/* RISK — from Risk Assessment / snapshot; not editable by anyone */}
                      <td
                        className="p-1 text-xs text-gray-800 border border-gray-200 text-center align-top bg-gray-50"
                        style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
                        title="Risk level comes from Risk Assessment; cannot be edited here."
                      >
                        {row.risk !== "" && row.risk != null ? String(row.risk) : "-"}
                      </td>
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
                            disabled={isReviewer}
                            className="w-full p-1 text-xs text-left border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      {/* COMPLETION STATUS — from CHECK (Y/N): Yes => Ready to Publish; system-managed, not directly editable */}
                      <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left align-top bg-gray-50" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                        {row.completionStatus || "-"}
                      </td>
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
          <Pagination meta={findingMeta} onPageChange={(p) => fetchData(p)} loading={loading} />
        </div>
      </div>

      {publishModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && setPublishModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="text-lg font-bold text-slate-900">Publish Audit Finding</div>
              <div className="text-xs text-slate-600 mt-1">
                Department: <span className="font-semibold">{departmentLabel}</span> · Year:{" "}
                <span className="font-semibold">{auditYear}</span> · Rows:{" "}
                <span className="font-semibold">{tableData.length}</span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-2">Preparer Status</div>
                  <div className="text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Current</span>
                      <span
                        className={`font-bold ${
                          isAuditFindingHeaderStatusComplete(preparerStatus) ? "text-green-700" : "text-amber-700"
                        }`}
                      >
                        {preparerStatus || "Not set"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-2">Final Status</div>
                  <div className="text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Current</span>
                      <span
                        className={`font-bold ${
                          isAuditFindingHeaderStatusComplete(finalStatus) ? "text-green-700" : "text-amber-700"
                        }`}
                      >
                        {finalStatus || "Not set"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-white bg-red-600 w-fit rounded-2xl px-2 py-0.5">Rule</div>
                <p className="text-sm text-slate-600 mt-2">
                  Publish is only allowed when both <span className="font-semibold">Preparer Status</span> and{" "}
                  <span className="font-semibold">Final Status</span> are{" "}
                  <span className="font-semibold">COMPLETED</span> (saved in the header). Only{" "}
                  <span className="font-semibold">admin</span> or <span className="font-semibold">reviewer</span> can
                  publish. Findings with <span className="font-semibold">CHECK (Y/N) = Yes</span> are published to Audit
                  Review.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !isMetaReadyForPublish}
                onClick={() => void handlePublish()}
                className={`px-4 py-2 rounded-xl font-semibold text-white ${
                  loading || !isMetaReadyForPublish
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 shadow-md"
                }`}
              >
                {loading ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


