"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Pagination from "@/app/components/ui/Pagination";
import { useToast } from "@/app/contexts/ToastContext";

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
  initialMeta = null,
}) {
  const { data: session } = useSession();
  const toast = useToast();
  const role = (session?.user?.role || "").toLowerCase();
  const isReviewer = role === "reviewer";
  const isAdmin = role === "admin";
  const isUser = role === "user";
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
  const [schedulePreparerName, setSchedulePreparerName] = useState(""); // From schedule
  const [schedulePreparerDate, setSchedulePreparerDate] = useState(""); // From schedule

  const [tableData, setTableData] = useState(() => normalizeRows(initialData));
  const [findingMeta, setFindingMeta] = useState(initialMeta);
  const [isEditMode, setIsEditMode] = useState(false); // Global edit mode for all rows
  const [isScheduleConfigured, setIsScheduleConfigured] = useState(false); // Schedule configuration status

  // Auto-save refs
  const saveMetaTimeoutRef = useRef(null);
  const isSavingMetaRef = useRef(false);
  const lastSavedMetaRef = useRef(null);
  
  // Auto-save table data refs
  const saveTableDataTimeoutRef = useRef(null);
  const isSavingTableDataRef = useRef(false);
  const lastSavedTableDataRef = useRef(null);

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

  // Fetch meta data from API on mount
  useEffect(() => {
    let mounted = true;
    async function fetchMetaData() {
      try {
        const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/meta`, {
          cache: "no-store",
        });
        if (!res.ok) {
          console.warn(`Failed to fetch meta data for ${apiPath}`);
          return;
        }
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (json?.success && json?.data) {
          const meta = json.data;
          // Always set all fields, regardless of role
          setPreparerStatus(meta.preparer_status || "");
          setFinalStatus(meta.final_status || "");
          setFindingResult(meta.finding_result || "");
          setFindingResultFileName(meta.finding_result_file_name || "");
          setReportAs(meta.report_as || "");
          // Use schedule data if available, otherwise use meta data
          setPrepare(meta.prepare || "");
          // Set prepareDate from meta (schedule date will override via separate useEffect)
          setPrepareDate(meta.prepare_date ? String(meta.prepare_date).slice(0, 10) : "");
          setReview(meta.review || "");
          setReviewDate(meta.review_date ? String(meta.review_date).slice(0, 10) : "");
          
          // Update lastSavedMetaRef to prevent immediate auto-save
          lastSavedMetaRef.current = {
            preparerStatus: meta.preparer_status || "",
            finalStatus: meta.final_status || "",
            findingResult: meta.finding_result || "",
            findingResultFileName: meta.finding_result_file_name || "",
            reportAs: meta.report_as || "",
            prepare: meta.prepare || "",
            prepareDate: meta.prepare_date ? String(meta.prepare_date).slice(0, 10) : "",
            review: meta.review || "",
            reviewDate: meta.review_date ? String(meta.review_date).slice(0, 10) : "",
          };
        } else {
          // Initialize lastSavedMetaRef even if no data, so auto-save will work for new entries
          lastSavedMetaRef.current = {
            preparerStatus: "",
            finalStatus: "",
            findingResult: "",
            findingResultFileName: "",
            reportAs: "",
            prepare: "",
            prepareDate: "",
            review: "",
            reviewDate: "",
          };
          // Fallback to localStorage if no API data
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              setPreparerStatus(parsed.preparerStatus ?? "");
              setFinalStatus(parsed.finalStatus ?? "");
              setFindingResult(parsed.findingResult ?? "");
              setFindingResultFileName(parsed.findingResultFileName ?? "");
              setReportAs(parsed.reportAs ?? "");
              setPrepare(parsed.prepare ?? "");
              // Set prepareDate from localStorage (schedule date will override via separate useEffect)
              setPrepareDate(parsed.prepareDate ?? "");
              setReview(parsed.review ?? "");
              setReviewDate(parsed.reviewDate ?? "");
              // Update lastSavedMetaRef with localStorage data
              lastSavedMetaRef.current = {
                preparerStatus: parsed.preparerStatus ?? "",
                finalStatus: parsed.finalStatus ?? "",
                findingResult: parsed.findingResult ?? "",
                findingResultFileName: parsed.findingResultFileName ?? "",
                reportAs: parsed.reportAs ?? "",
                prepare: parsed.prepare ?? "",
                prepareDate: parsed.prepareDate ?? "",
                review: parsed.review ?? "",
                reviewDate: parsed.reviewDate ?? "",
              };
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn(`Error fetching meta data for ${apiPath}:`, err);
        // Initialize lastSavedMetaRef even on error, so auto-save will work
        lastSavedMetaRef.current = {
          preparerStatus: "",
          finalStatus: "",
          findingResult: "",
          findingResultFileName: "",
          reportAs: "",
          prepare: "",
          prepareDate: "",
          review: "",
          reviewDate: "",
        };
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            setPreparerStatus(parsed.preparerStatus ?? "");
            setFinalStatus(parsed.finalStatus ?? "");
            setFindingResult(parsed.findingResult ?? "");
            setFindingResultFileName(parsed.findingResultFileName ?? "");
            setReportAs(parsed.reportAs ?? "");
            setPrepare(parsed.prepare ?? "");
            // Set prepareDate from localStorage (schedule date will override via separate useEffect)
            setPrepareDate(parsed.prepareDate ?? "");
            setReview(parsed.review ?? "");
            setReviewDate(parsed.reviewDate ?? "");
            // Update lastSavedMetaRef with localStorage data
            lastSavedMetaRef.current = {
              preparerStatus: parsed.preparerStatus ?? "",
              finalStatus: parsed.finalStatus ?? "",
              findingResult: parsed.findingResult ?? "",
              findingResultFileName: parsed.findingResultFileName ?? "",
              reportAs: parsed.reportAs ?? "",
              prepare: parsed.prepare ?? "",
              prepareDate: parsed.prepareDate ?? "",
              review: parsed.review ?? "",
              reviewDate: parsed.reviewDate ?? "",
            };
          }
        } catch {
          // ignore
        }
      }
    }
    fetchMetaData();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  // Auto-save meta data to API
  const saveMetaData = useCallback(async () => {
    if (isSavingMetaRef.current) return;

    const currentMeta = {
      preparerStatus,
      finalStatus,
      findingResult,
      findingResultFileName,
      reportAs,
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
          finding_result_file_name: findingResultFileName,
          report_as: reportAs,
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
            findingResultFileName: saved.finding_result_file_name || "",
            reportAs: saved.report_as || "",
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
    findingResultFileName,
    reportAs,
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
    findingResultFileName,
    reportAs,
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

  async function fetchData(page) {
    const pageNum = page ?? findingMeta?.page ?? 1;
    const pageSize = findingMeta?.pageSize ?? 50;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(pageSize) });
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}?${params.toString()}`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to fetch data");
      setTableData(normalizeRows(json.data ?? []));
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

        const res = await fetch(`/api/schedule/module?module=audit-finding`, { cache: "no-store" });
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
  }, [apiPath]);

  useEffect(() => {
    // keep client in sync if server data changes / refresh
    const normalized = normalizeRows(initialData);
    setTableData(normalized);
    if (initialMeta) setFindingMeta(initialMeta);
    // Initialize lastSavedTableDataRef to prevent immediate auto-save on initial load
    lastSavedTableDataRef.current = normalized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, initialData, initialMeta]);

  // Auto-save table data to API
  const saveTableData = useCallback(async () => {
    if (isSavingTableDataRef.current) return;

    // Skip if no changes
    if (lastSavedTableDataRef.current) {
      const currentDataStr = JSON.stringify(tableData);
      const lastSavedDataStr = JSON.stringify(lastSavedTableDataRef.current);
      if (currentDataStr === lastSavedDataStr) return;
    }

    isSavingTableDataRef.current = true;
    try {
      const updatedTableData = [...tableData];
      const savePromises = [];
      
      for (let i = 0; i < updatedTableData.length; i++) {
        const row = updatedTableData[i];
        if (row.id != null) {
          // Update existing row
          const promise = fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              riskId: row.riskId,
              riskDescription: row.riskDescription,
              riskDetails: row.riskDetails,
              apCode: row.apCode,
              substantiveTest: row.substantiveTest,
              risk: row.risk ? parseInt(row.risk, 10) : null,
              checkYN: row.checkYN,
              method: row.method,
              preparer: row.preparer,
              findingResult: row.findingResult,
              findingDescription: row.findingDescription,
              recommendation: row.recommendation,
              auditee: row.auditee,
              completionStatus: row.completionStatus,
              completionDate: row.completionDate || null,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errorText = await res.text().catch(() => "");
                console.warn(`Failed to save row ${row.id}:`, res.status, errorText);
                return null;
              }
              return await res.json().catch(() => null);
            })
            .catch((err) => {
              console.warn(`Error saving row ${row.id}:`, err);
              return null;
            });
          savePromises.push(promise);
        } else {
          // Create new row (only if row has some meaningful data)
          if (row.riskId || row.apCode || row.findingResult || row.preparer) {
            const promise = fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                riskId: row.riskId || "",
                riskDescription: row.riskDescription || "",
                riskDetails: row.riskDetails || "",
                apCode: row.apCode || "",
                substantiveTest: row.substantiveTest || "",
                risk: row.risk ? parseInt(row.risk, 10) : null,
                checkYN: row.checkYN || "",
                method: row.method || "",
                preparer: row.preparer || "",
                findingResult: row.findingResult || "",
                findingDescription: row.findingDescription || "",
                recommendation: row.recommendation || "",
                auditee: row.auditee || "",
                completionStatus: row.completionStatus || "",
                completionDate: row.completionDate || null,
              }),
            })
              .then(async (res) => {
                if (!res.ok) {
                  const errorText = await res.text().catch(() => "");
                  console.warn(`Failed to create row:`, res.status, errorText);
                  return null;
                }
                return await res.json().catch(() => null);
              })
              .then((created) => {
                if (created?.data) {
                  // Update row id after creation
                  updatedTableData[i].id = created.data.id;
                }
                return created;
              })
              .catch((err) => {
                console.warn(`Error creating row:`, err);
                return null;
              });
            savePromises.push(promise);
          }
        }
      }

      await Promise.all(savePromises);
      
      // Update state with updated data (especially for new rows that got IDs)
      setTableData(updatedTableData);
      
      // Update lastSavedTableDataRef after successful save
      lastSavedTableDataRef.current = JSON.parse(JSON.stringify(updatedTableData));
    } catch (err) {
      console.warn("Error saving table data:", err);
    } finally {
      isSavingTableDataRef.current = false;
    }
  }, [apiPath, tableData]);

  // Auto-save table data with debounce
  useEffect(() => {
    // Clear existing timeout
    if (saveTableDataTimeoutRef.current) {
      clearTimeout(saveTableDataTimeoutRef.current);
    }

    // Skip initial load (when lastSavedTableDataRef is null)
    if (lastSavedTableDataRef.current === null) {
      return;
    }

    // Debounce save by 1 second
    saveTableDataTimeoutRef.current = setTimeout(() => {
      saveTableData();
    }, 1000);

    return () => {
      if (saveTableDataTimeoutRef.current) {
        clearTimeout(saveTableDataTimeoutRef.current);
      }
    };
  }, [saveTableData, tableData]);

  // Handle cell edit
  const handleCellEdit = (rowIndex, field, value) => {
    const updated = [...tableData];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setTableData(updated);
  };

  // Handle toggle edit mode
  const handleToggleEditMode = () => {
    if (isReviewer) return; // Reviewer cannot toggle edit mode
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
      toast.show("Sorry, no schedule", "error");
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
      
      // Publish all findings for this department
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to publish findings");
      
      // Show success message and redirect to report
      toast.show("Successfully published! Data is now available in Report.", "success");
      
      // Redirect to report page
      window.location.href = "/Page/audit-finding/report";
    } catch (e) {
      setError(e?.message || String(e));
      toast.show("Error: " + (e?.message || String(e)), "error");
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

  const handleFindingResultFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/audit-finding/${encodeURIComponent(apiPath)}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.fileUrl) {
        setFindingResult(data.fileUrl);
        setFindingResultFileName(data.fileName || file.name);
        toast.show("File uploaded. It will be saved automatically.", "success");
      } else {
        toast.show("Failed to upload file: " + (data?.error || "Unknown error"), "error");
      }
    } catch (err) {
      toast.show("Error uploading file: " + (err?.message || err), "error");
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
                      disabled={isReviewer}
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
                    {reportAs === "attachment file" ? (
                      <div className="space-y-2">
                        <label className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg ${isReviewer ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
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
                            disabled={isReviewer}
                          />
                        </label>
                        {(findingResultFileName || findingResult) && (
                          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="text-xs font-medium text-blue-700 truncate">{findingResultFileName || "File"}</span>
                            </div>
                            {findingResult && (findingResult.startsWith("/") || findingResult.startsWith("http")) && (
                              <a
                                href={findingResult}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                View file
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={findingResult}
                        onChange={(e) => setFindingResult(e.target.value)}
                        disabled={isReviewer}
                        className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter finding result"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">REPORT AS</label>
                    <select
                      value={reportAs}
                      onChange={(e) => setReportAs(e.target.value)}
                      disabled={isReviewer}
                      className="w-full border border-slate-300 bg-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  title="Save All Changes"
                >
                  {loading ? "Saving..." : "Save All"}
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
              onClick={handlePublish}
              disabled={loading || !isScheduleConfigured || isReviewer}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-md ${
                loading || !isScheduleConfigured || isReviewer
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
              title={!isScheduleConfigured ? "Schedule not configured" : isReviewer ? "Reviewer cannot publish" : "Publish"}
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
          <Pagination meta={findingMeta} onPageChange={(p) => fetchData(p)} loading={loading} />
        </div>
      </div>
    </main>
  );
}


