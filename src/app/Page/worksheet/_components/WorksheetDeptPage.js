"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import {
  WORKSHEET_AUDIT_AREA_TREE,
  WORKSHEET_AUDIT_AREA_ALL_LABEL,
  displayWorksheetAuditArea,
  flattenAuditAreaTree,
} from "@/app/data/worksheetAuditAreaTree";

/** departmentValue dari masing-masing halaman worksheet → department_id di schedule */
const WORKSHEET_DEPT_TO_SCHEDULE_ID = {
  FINANCE: "A1.1",
  ACCOUNTING: "A1.2",
  HRD: "A1.3",
  "G&A": "A1.4",
  "DESIGN STORE PLANNER": "A1.5",
  TAX: "A1.6",
  "SECURITY L&P": "A1.7",
  MIS: "A1.8",
  MERCHANDISE: "A1.9",
  OPERATIONAL: "A1.10",
  WAREHOUSE: "A1.11",
};

function toDateInputValue(v) {
  if (!v) return "";
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/** Sama seperti Audit Finding: normalisasi start_date dari API schedule → YYYY-MM-DD untuk input date. */
function scheduleStartDateToInputValue(dateValue) {
  if (dateValue == null || dateValue === "") return "";
  if (typeof dateValue === "string") {
    const dateStr = String(dateValue).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (dateStr.includes("T")) return dateStr.split("T")[0].slice(0, 10);
    return "";
  }
  if (dateValue instanceof Date) {
    const y = dateValue.getUTCFullYear();
    const m = String(dateValue.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dateValue.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof dateValue === "number") {
    const dateObj = new Date(dateValue);
    if (Number.isNaN(dateObj.getTime())) return "";
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

/** Normalisasi satu baris worksheet dari API (snake_case / camelCase). */
function pickLatestRowFields(latest) {
  if (!latest) return null;
  const pr = latest.preparer_date ?? latest.preparerDate;
  const rr = latest.reviewer_date ?? latest.reviewerDate;
  return {
    reviewer:
      latest.reviewer != null && latest.reviewer !== undefined ? String(latest.reviewer) : "",
    preparerDate: toDateInputValue(pr),
    reviewerDate: toDateInputValue(rr),
    statusWP: latest.status_wp ?? latest.statusWP ?? "",
    filePath: latest.file_path ?? latest.filePath ?? "",
    auditAreaRaw: latest.audit_area ?? latest.auditArea ?? "",
  };
}

export default function WorksheetDeptPage({
  apiPath,
  headerLabel,
  departmentValue,
  uploadDepartment,
  enableRoleRestrictions = false,
}) {
  const { data: session } = useSession();
  const role = (session?.user?.role || "").toLowerCase();
  const isUserRole = role === "user";
  /** Hanya admin & reviewer yang boleh mengisi nama / tanggal reviewer. */
  const canEditReviewerFields = role === "admin" || role === "reviewer";
  /** Akun reviewer: hanya boleh mengisi sisi review (WP/status), bukan upload/preparer. */
  const isReviewerAccount = enableRoleRestrictions && role === "reviewer";
  const isAdminAccount = enableRoleRestrictions && role === "admin";
  const canSave = Boolean(session?.user);

  const [preparer, setPreparer] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [preparerDate, setPreparerDate] = useState("");
  /** Tanggal mulai dari Schedule → Worksheet (start_date); jika true, user tidak boleh ubah manual. */
  const [schedulePreparerDateLocked, setSchedulePreparerDateLocked] = useState(false);
  const [reviewerDate, setReviewerDate] = useState("");
  const [statusDocuments, setStatusDocuments] = useState("");
  const [statusWP, setStatusWP] = useState("");
  const [filePath, setFilePath] = useState("");
  const auditAreaRows = useMemo(
    () => flattenAuditAreaTree(WORKSHEET_AUDIT_AREA_TREE),
    [],
  );
  const pathToLabel = useMemo(() => {
    const m = new Map();
    auditAreaRows.forEach((r) => m.set(r.path, r.label));
    return m;
  }, [auditAreaRows]);
  const allAuditPaths = useMemo(() => auditAreaRows.map((r) => r.path), [auditAreaRows]);

  const [selectedAuditPaths, setSelectedAuditPaths] = useState(() => new Set());

  const toggleAuditPath = useCallback((path, checked) => {
    setSelectedAuditPaths((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const toggleSelectAllAuditAreas = useCallback(
    (checked) => {
      setSelectedAuditPaths(() => (checked ? new Set(allAuditPaths) : new Set()));
    },
    [allAuditPaths],
  );

  const allAuditSelected =
    allAuditPaths.length > 0 && allAuditPaths.every((p) => selectedAuditPaths.has(p));

  const auditAreaSerialized = useMemo(() => {
    if (allAuditPaths.length > 0 && selectedAuditPaths.size === allAuditPaths.length) {
      return WORKSHEET_AUDIT_AREA_ALL_LABEL;
    }
    const labels = Array.from(selectedAuditPaths)
      .map((p) => pathToLabel.get(p))
      .filter(Boolean);
    labels.sort((a, b) => a.localeCompare(b));
    return labels.join("; ");
  }, [selectedAuditPaths, pathToLabel, allAuditPaths.length, selectedAuditPaths.size]);

  const [auditAreaModalOpen, setAuditAreaModalOpen] = useState(false);

  useEffect(() => {
    if (!auditAreaModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setAuditAreaModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [auditAreaModalOpen]);

  useEffect(() => {
    if (!auditAreaModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [auditAreaModalOpen]);

  const auditAreaTriggerLabel = useMemo(() => {
    if (allAuditPaths.length > 0 && selectedAuditPaths.size === allAuditPaths.length) {
      return WORKSHEET_AUDIT_AREA_ALL_LABEL;
    }
    const n = selectedAuditPaths.size;
    if (n === 0) return "- Select audit area -";
    if (n === 1) {
      const only = Array.from(selectedAuditPaths)[0];
      return pathToLabel.get(only) || "- Select audit area -";
    }
    return `${n} areas selected`;
  }, [selectedAuditPaths, pathToLabel, allAuditPaths.length]);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [notification, setNotification] = useState(null);

  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const auditYear = useMemo(() => {
    if (yearParam != null && String(yearParam).trim() !== "") {
      const p = parseInt(String(yearParam), 10);
      if (Number.isFinite(p)) return p;
    }
    return new Date().getFullYear();
  }, [yearParam]);

  const fetchPreparerFromSchedule = useCallback(async () => {
    try {
      const scheduleDeptId = WORKSHEET_DEPT_TO_SCHEDULE_ID[departmentValue];
      if (!scheduleDeptId) {
        setPreparer("");
        setPreparerDate("");
        setSchedulePreparerDateLocked(false);
        return;
      }
      const res = await fetch(
        `/api/schedule/module?module=worksheet&year=${encodeURIComponent(String(auditYear))}`,
        { cache: "no-store" }
      );
      const result = await res.json().catch(() => ({}));
      if (result.success && Array.isArray(result.rows)) {
        const scheduleRow = result.rows.find(
          (row) => row.department_id === scheduleDeptId && row.is_configured === true,
        );
        if (scheduleRow) {
          const name = scheduleRow.user_name ? String(scheduleRow.user_name).trim() : "";
          const startIso = scheduleStartDateToInputValue(scheduleRow.start_date);
          setPreparer(name);
          setPreparerDate(startIso);
          setSchedulePreparerDateLocked(Boolean(startIso));
          return;
        }
      }
      setPreparer("");
      setPreparerDate("");
      setSchedulePreparerDateLocked(false);
    } catch {
      setPreparer("");
      setPreparerDate("");
      setSchedulePreparerDateLocked(false);
    }
  }, [departmentValue, auditYear]);

  useEffect(() => {
    fetchPreparerFromSchedule();
  }, [fetchPreparerFromSchedule]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchLatestWorksheetRow = useCallback(async () => {
    try {
      const url = new URL(apiPath, window.location.origin);
      url.searchParams.set("year", String(auditYear));
      url.searchParams.set("excludePublished", "1");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.rows?.[0] ?? null;
    } catch {
      return null;
    }
  }, [apiPath, auditYear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await fetchLatestWorksheetRow();
        if (cancelled) return;
        if (!latest) {
          setStatusWP("");
          setFilePath("");
          setReviewer("");
          setReviewerDate("");
          setSelectedAuditPaths(new Set());
          return;
        }
        const f = pickLatestRowFields(latest);
        if (!f) return;
        setStatusWP(f.statusWP);
        setFilePath(f.filePath ? String(f.filePath) : "");
        setReviewer(f.reviewer);
        setReviewerDate(f.reviewerDate);
        const ar = String(f.auditAreaRaw ?? "").trim();
        if (ar && displayWorksheetAuditArea(ar) === WORKSHEET_AUDIT_AREA_ALL_LABEL) {
          setSelectedAuditPaths(new Set(allAuditPaths));
        } else {
          setSelectedAuditPaths(new Set());
        }
      } catch (_) {
        // Ignore initial load failures and keep the form usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLatestWorksheetRow, allAuditPaths]);

  const saveStatusWP = async (value) => {
    try {
      const u = new URL(apiPath, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      u.searchParams.set("year", String(auditYear));
      const res = await fetch(u.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusWP: value }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", "Status WP saved successfully.");
      } else {
        showNotification("error", data?.error || "Failed to save Status WP.");
      }
    } catch (_) {
      showNotification("error", "Failed to save Status WP.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("department", uploadDepartment);
      formData.append("year", String(auditYear));

      const response = await fetch("/api/worksheet/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data?.fileUrl) {
        setFilePath(data.fileUrl);
        showNotification("success", "File uploaded successfully.");
      } else {
        showNotification("error", `Failed to upload file: ${data?.error || "Unknown error."}`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      showNotification("error", `Error while uploading file: ${error.message || "Unknown error."}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleFileDelete = async () => {
    if (!filePath) return;
    try {
      setIsDeletingFile(true);
      const response = await fetch("/api/worksheet/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: uploadDepartment,
          fileUrl: filePath,
          year: yearParam,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        showNotification("error", data?.error || `Failed to delete file (HTTP ${response.status}).`);
        return;
      }
      setFilePath("");
      showNotification("success", "File deleted successfully.");
    } catch (error) {
      console.error("Error deleting file:", error);
      showNotification("error", `Error while deleting file: ${error.message || "Unknown error."}`);
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let reviewerPayload = reviewer;
      let reviewerDatePayload = reviewerDate || null;
      if (!canEditReviewerFields) {
        const prev = await fetchLatestWorksheetRow();
        const pf = pickLatestRowFields(prev);
        if (pf) {
          reviewerPayload = pf.reviewer;
          reviewerDatePayload = pf.reviewerDate || null;
        }
      }

      const response = await fetch(apiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          department: departmentValue,
          preparer,
          reviewer: reviewerPayload,
          preparerDate: preparerDate || null,
          reviewerDate: reviewerDatePayload,
          statusDocuments,
          statusWorksheet: filePath ? "Available" : "Not Available",
          statusWP,
          filePath,
          auditArea: auditAreaSerialized,
          year: String(auditYear),
        }),
      });

      const data = await response.json();
      if (data.success) {
        showNotification("success", "Data has been saved. It appears in Report; the form is cleared for the next entry.");
        setAuditAreaModalOpen(false);
        setFilePath("");
        await fetchPreparerFromSchedule();
        if (canEditReviewerFields) {
          setReviewer("");
          setReviewerDate("");
        } else {
          const after = await fetchLatestWorksheetRow();
          const af = pickLatestRowFields(after);
          if (af) {
            setReviewer(af.reviewer);
            setReviewerDate(af.reviewerDate);
          }
        }
        setStatusDocuments("");
        setStatusWP("");
        setSelectedAuditPaths(new Set());
      } else {
        showNotification("error", `Failed to save data: ${data.error || "Unknown error."}`);
      }
    } catch (error) {
      console.error("Error saving data:", error);
      showNotification("error", `Error while saving data: ${error.message || "Unknown error."}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex flex-col w-full h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
        <SmallHeader
          label={headerLabel}
          showSearch={false}
          backHref={`/Page/worksheet?year=${encodeURIComponent(String(auditYear))}`}
        />
        <div className="flex-1 w-full h-full overflow-y-auto mt-20 md:mt-14 p-4 md:p-6">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-7xl mx-auto border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-6">
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    FILES
                  </label>
                  <div className="space-y-3">
                    <label className={`flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg ${isReviewerAccount ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      UPLOAD FILE
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls,.pdf"
                        disabled={isReviewerAccount}
                      />
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[120px] flex items-center justify-center">
                      {filePath ? (
                        <div className="w-full">
                          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={filePath}
                              className="text-blue-600 hover:text-blue-800 hover:underline break-all font-medium text-sm flex-1"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {filePath}
                            </a>
                            <button
                              type="button"
                              onClick={handleFileDelete}
                              disabled={isReviewerAccount || isDeletingFile}
                              className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isDeletingFile ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-gray-400 text-sm">No file selected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    STATUS WORKSHEET
                  </label>
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 font-medium">
                    {filePath ? "Available" : "Not Available"}
                  </div>
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    STATUS WP
                  </label>
                  <select
                    value={statusWP}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStatusWP(value);
                      saveStatusWP(value);
                    }}
                    disabled={enableRoleRestrictions && !isAdminAccount && !isReviewerAccount}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">- Select -</option>
                    <option value="Not Checked">Not Checked</option>
                    <option value="Checked">Checked</option>
                    <option value="Reject">Reject</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    PREPARER
                  </label>
                  {preparer ? (
                    <input
                      type="text"
                      value={preparer}
                      readOnly
                      className="w-full bg-slate-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 shadow-sm cursor-default"
                      title="From schedule (Worksheet module)"
                    />
                  ) : (
                    <div className="w-full border border-amber-200 bg-amber-50 rounded-lg px-4 py-2.5 text-sm text-amber-800">
                      Not set — configure the assigned user in{" "}
                      <span className="font-semibold">Schedule → Worksheet</span> for this department.
                    </div>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Nama preparer diambil dari penugasan di modul Schedule (Worksheet).</p>
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    REVIEWER
                  </label>
                  <input
                    type="text"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter reviewer name"
                    disabled={!canEditReviewerFields}
                    title={!canEditReviewerFields ? "Hanya admin atau reviewer yang dapat mengisi" : undefined}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                      <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      PREPARER DATE
                    </label>
                    <input
                      type="date"
                      value={preparerDate}
                      onChange={(e) => setPreparerDate(e.target.value)}
                      readOnly={isUserRole && schedulePreparerDateLocked}
                      disabled={isReviewerAccount}
                      title={
                        isUserRole && schedulePreparerDateLocked
                          ? "Dari Schedule → Worksheet (tanggal mulai)"
                          : undefined
                      }
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        isUserRole && schedulePreparerDateLocked ? "bg-slate-50 cursor-default" : "bg-white"
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Tanggal preparer mengikuti <span className="font-semibold">tanggal mulai</span> di Schedule →
                      Worksheet untuk department ini (sama seperti Audit Finding).
                    </p>
                  </div>

                  <div>
                    <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                      <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      REVIEWER DATE
                    </label>
                    <input
                      type="date"
                      value={reviewerDate}
                      onChange={(e) => setReviewerDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={!canEditReviewerFields}
                      title={!canEditReviewerFields ? "Hanya admin atau reviewer yang dapat mengisi" : undefined}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    AUDIT AREA
                  </label>
                  <button
                    type="button"
                    disabled={isReviewerAccount}
                    onClick={() => setAuditAreaModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#141D38] shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="truncate uppercase">{auditAreaTriggerLabel}</span>
                  </button>
                  {auditAreaSerialized ? (
                    <p className="mt-2 text-xs text-slate-500 line-clamp-3 sm:line-clamp-none" title={auditAreaSerialized}>
                      Selected: {auditAreaSerialized}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !canSave}
                className="px-6 py-2.5 bg-[#141D38] hover:bg-[#141D38]/90 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {auditAreaModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-area-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setAuditAreaModalOpen(false)}
            aria-label="Close audit area dialog"
          />
          <div className="relative z-10 flex w-full max-h-[min(92dvh,100%)] sm:max-h-[min(85vh,720px)] sm:max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:rounded-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <h2 id="audit-area-modal-title" className="text-base font-bold uppercase tracking-wide text-gray-900">
                Audit area
              </h2>
              <button
                type="button"
                onClick={() => setAuditAreaModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-slate-100 hover:text-gray-800"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              <label className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#141D38] focus:ring-[#141D38]"
                  checked={allAuditSelected}
                  onChange={(e) => toggleSelectAllAuditAreas(e.target.checked)}
                  disabled={isReviewerAccount}
                />
                <span className="uppercase tracking-wide">Select all</span>
              </label>
              <div className="border-t border-gray-100 pt-1">
                {auditAreaRows.map((row) => (
                  <label
                    key={row.path}
                    className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs sm:text-sm text-gray-800 hover:bg-slate-50"
                    style={{ paddingLeft: `${10 + row.depth * 14}px` }}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#141D38] focus:ring-[#141D38]"
                      checked={selectedAuditPaths.has(row.path)}
                      onChange={(e) => toggleAuditPath(row.path, e.target.checked)}
                      disabled={isReviewerAccount}
                    />
                    <span className="uppercase leading-snug">{row.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-gray-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setAuditAreaModalOpen(false)}
                className="flex-1 rounded-lg bg-[#141D38] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#141D38]/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-start gap-3 rounded-lg shadow-lg border px-4 py-3 bg-white max-w-sm ${
              notification.type === "success" ? "border-emerald-200" : "border-red-200"
            }`}
          >
            <div className="mt-0.5">
              {notification.type === "success" ? (
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {notification.type === "success" ? "Success" : "Error"}
              </p>
              <p className="text-sm text-gray-700 mt-0.5">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
