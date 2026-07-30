"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Pagination from "@/app/components/ui/Pagination";
import EvidenceUploadProgressOverlay from "./EvidenceUploadProgressOverlay";
import { getEvidenceApiUrl, uploadEvidenceFile } from "./uploadEvidenceWithProgress";
import { downloadEvidenceWithProgress } from "./downloadEvidenceWithProgress";
import { isAdminRole } from "@/lib/roles";
import { buildEvidenceDownloadHref } from "@/lib/evidenceFileUrl";

const ALLOWED_EVIDENCE_EXTENSIONS = new Set(["pdf", "zip", "doc", "docx", "xlsx", "xls"]);
const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB

function isAllowedEvidenceFile(file) {
  const name = file?.name || "";
  if (!name || name.startsWith(".") || name === "Thumbs.db" || name === ".DS_Store") return false;
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  return Boolean(ext && ALLOWED_EVIDENCE_EXTENSIONS.has(ext));
}

function collectUploadFiles(fileList) {
  const list = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
  return list
    .filter(isAllowedEvidenceFile)
    .sort((a, b) =>
      (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, {
        sensitivity: "base",
      }),
    );
}

export default function EvidenceDeptPage({
  departmentLabel, // e.g. "ACCOUNTING"
  evidenceApiSlug, // e.g. "accounting"
  dashboardLabel, // e.g. "Accounting"
}) {
  const { data: session } = useSession();
  const role = String(session?.user?.role || "").trim().toLowerCase();
  const isReviewer = role === "reviewer";
  const isAdmin = isAdminRole(role);
  const isUser = role === "user";
  /** Any role may publish; dashboard progress counts every successful publish. */
  const canPublish = isAdmin || isReviewer || isUser;
  const [preparer, setPreparer] = useState("");
  const [apData, setApData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState("DRAFT");
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [uploadOverlay, setUploadOverlay] = useState(null);
  const [downloadOverlay, setDownloadOverlay] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [evidenceMeta, setEvidenceMeta] = useState(null);
  const uploadAbortRef = useRef(null);
  const downloadAbortRef = useRef(null);
  const searchParams = useSearchParams();
  const yearParam = searchParams?.get("year");
  const effectiveYear = useMemo(() => {
    if (yearParam != null && String(yearParam).trim() !== "") {
      const p = parseInt(String(yearParam), 10);
      if (Number.isFinite(p)) return p;
    }
    return new Date().getFullYear();
  }, [yearParam]);
  const yearFilter = effectiveYear;
  const backHref = `/Page/evidence?year=${encodeURIComponent(String(effectiveYear))}`;

  // Map department label to schedule department_id
  const getScheduleDeptId = (deptLabel) => {
    const deptMap = {
      "FINANCE": "A1.1",
      "ACCOUNTING": "A1.2",
      "HRD": "A1.3",
      "G&A": "A1.4",
      "SDP": "A1.5",
      "TAX": "A1.6",
      "L&P": "A1.7",
      "MIS": "A1.8",
      "MERCHANDISE": "A1.9",
      "OPERATIONAL": "A1.10",
      "WAREHOUSE": "A1.11",
    };
    return deptMap[deptLabel] || null;
  };

  // Fetch preparer from schedule (only when department/year context changes — not on pagination)
  const fetchPreparerFromSchedule = useCallback(async () => {
    try {
      const scheduleDeptId = getScheduleDeptId(departmentLabel);
      if (!scheduleDeptId) {
        setPreparer("");
        return null;
      }

      const res = await fetch(
        `/api/schedule/module?module=evidence&year=${encodeURIComponent(String(effectiveYear))}`
      );
      const result = await res.json().catch(() => ({}));

      if (result.success && Array.isArray(result.rows)) {
        const scheduleRow = result.rows.find(
          (row) => row.department_id === scheduleDeptId && row.is_configured === true
        );

        if (scheduleRow?.user_name) {
          setPreparer(scheduleRow.user_name);
          return scheduleRow.user_name;
        }
      }

      setPreparer("");
      return null;
    } catch (error) {
      console.warn("Failed to fetch preparer from schedule:", error);
      setPreparer("");
      return null;
    }
  }, [departmentLabel, effectiveYear]);

  useEffect(() => {
    fetchPreparerFromSchedule();
  }, [fetchPreparerFromSchedule, yearFilter]);

  const fetchApData = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const pageSize = 50;
      const params = new URLSearchParams({
        department: departmentLabel,
        page: String(page),
        pageSize: String(pageSize),
      });
      params.set("year", String(yearFilter));
      // Sembunyikan data yang sudah dipublish (COMPLETE + ada file) dari halaman departemen;
      // data tersebut akan tampil di halaman Report.
      params.set("exclude_published", "1");
      const res = await fetch(getEvidenceApiUrl(evidenceApiSlug, params));
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || `API Error: ${res.status} ${res.statusText}`);

      const rows = Array.isArray(result?.data) ? result.data : [];
      setApData(
        rows.map((r) => {
          const attachments = Array.isArray(r.attachments)
            ? r.attachments.map((att, idx) => ({
                url: att.url,
                name: att.name || att.file_name || `Document ${idx + 1}`,
                uploaded_at: att.uploaded_at || null,
              }))
            : r.attachment
              ? [
                  {
                    url: r.attachment,
                    name: r.file_name || "",
                    uploaded_at: null,
                  },
                ]
              : [];
          return {
            ap_id: r.ap_id,
            ap_code: r.ap_code || "",
            substantive_test: r.substantive_test || "",
            attachment: r.attachment || "",
            file_name: r.file_name || "",
            status: r.status || "",
            attachments,
          };
        })
      );

      if (result?.meta) {
        // Jangan pakai overall_status dari baris acak (evidenceRows[0] di API): bisa COMPLETE
        // dari AP lain dan membuat UI terasa "sudah publish" padahal draft.
        const total = result.meta.total ?? rows.length;
        const pageSize = result.meta.pageSize ?? 50;
        setEvidenceMeta({ total, page: result.meta.page ?? page, pageSize });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message || "Failed to load data");
      setApData([]);
    } finally {
      setLoading(false);
    }
  }, [departmentLabel, evidenceApiSlug, yearFilter]);

  useEffect(() => {
    fetchApData(1);
  }, [departmentLabel, evidenceApiSlug, yearFilter, fetchApData]);

  const uploadFilesForRow = useCallback(
    async (index, fileList) => {
      const list = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
      if (list.length === 0) {
        setError("No files selected.");
        return;
      }

      const row = apData[index];
      if (!row) return;

      const existingCount = Array.isArray(row.attachments) ? row.attachments.length : 0;
      if (existingCount >= 5) {
        setError("Maximum 5 documents allowed for each AP.");
        return;
      }

      const remainingSlots = 5 - existingCount;
      const rawCount = list.length;
      const selectedFiles = collectUploadFiles(list);
      const oversizedFiles = selectedFiles.filter((f) => (f?.size || 0) > MAX_EVIDENCE_FILE_BYTES);
      const selectedWithinSize = selectedFiles.filter((f) => (f?.size || 0) <= MAX_EVIDENCE_FILE_BYTES);

      if (selectedFiles.length === 0) {
        setError(
          "No supported files. Allowed: PDF, ZIP, DOC, DOCX, XLS, XLSX.",
        );
        return;
      }
      if (selectedWithinSize.length === 0) {
        setError("All selected files exceed 8 GB limit.");
        return;
      }

      const filesToUpload = selectedWithinSize.slice(0, remainingSlots);
      const skippedUnsupported = rawCount - selectedFiles.length;

      setUploadingIndex(index);
      setError("");

      const totalBytes = filesToUpload.reduce((sum, f) => sum + (f.size || 0), 0);

      const overlayBase = {
        phase: "uploading",
        progress: 0,
        currentFile: filesToUpload[0]?.name || "",
        totalFiles: filesToUpload.length,
        completedFiles: 0,
        errorMessage: "",
      };
      setUploadOverlay(overlayBase);

      if (skippedUnsupported > 0) {
        setError(`${skippedUnsupported} file(s) skipped (unsupported type).`);
      }
      if (oversizedFiles.length > 0) {
        setError(`${oversizedFiles.length} file(s) skipped (size > 8 GB).`);
      }
      if (selectedFiles.length > remainingSlots) {
        setError(
          `Only ${remainingSlots} more document(s) can be added (maximum 5 per AP). Extra file(s) were skipped.`,
        );
      }

      let updatedAttachments = Array.isArray(row.attachments) ? [...row.attachments] : [];
      let bytesCompleted = 0;
      let lastFailedFile = "";

      const patchOverlay = (patch) => {
        setUploadOverlay((prev) => ({
          phase: "uploading",
          progress: 0,
          currentFile: "",
          totalFiles: filesToUpload.length,
          completedFiles: 0,
          errorMessage: "",
          ...prev,
          ...patch,
        }));
      };

      try {
        const abortController = new AbortController();
        uploadAbortRef.current = abortController;
        for (let fileIndex = 0; fileIndex < filesToUpload.length; fileIndex++) {
          const file = filesToUpload[fileIndex];
          const safeName = file.name || "upload.dat";
          lastFailedFile = safeName;

          patchOverlay({
            currentFile: safeName,
            completedFiles: fileIndex,
            progress:
              totalBytes > 0
                ? Math.round((bytesCompleted / totalBytes) * 100)
                : Math.round((fileIndex / filesToUpload.length) * 100),
          });

          const result = await uploadEvidenceFile(
            {
              evidenceApiSlug,
              departmentLabel,
              effectiveYear,
              row,
              file,
            },
            (loaded, total) => {
              const fileTotal = total > 0 ? total : file.size || 1;
              const overallLoaded = bytesCompleted + loaded;
              const overallTotal = totalBytes > 0 ? totalBytes : fileTotal * filesToUpload.length;
              const pct =
                overallTotal > 0
                  ? Math.round((overallLoaded / overallTotal) * 100)
                  : Math.round(((fileIndex + loaded / fileTotal) / filesToUpload.length) * 100);
              patchOverlay({
                progress: Math.min(99, pct),
                currentFile: safeName,
                completedFiles: fileIndex,
              });
            },
            { signal: abortController.signal },
          );

          bytesCompleted += file.size || 0;

          updatedAttachments = [
            ...updatedAttachments,
            {
              url: result.fileUrl,
              name: result.fileName || file.name,
              uploaded_at: new Date().toISOString(),
            },
          ].slice(0, 5);
        }

        if (updatedAttachments.length > existingCount) {
          const newData = [...apData];
          newData[index] = {
            ...row,
            attachment: updatedAttachments[0]?.url || "",
            file_name: updatedAttachments[0]?.name || "",
            attachments: updatedAttachments,
          };
          setApData(newData);
          setSuccessMessage(
            `${updatedAttachments.length - existingCount} file(s) uploaded successfully.`,
          );
          setTimeout(() => setSuccessMessage(""), 4000);
        }

        patchOverlay({ phase: "success", progress: 100, completedFiles: filesToUpload.length });
        await new Promise((r) => setTimeout(r, 1800));
        setUploadOverlay(null);
      } catch (error) {
        console.error("Error uploading file:", error);
        const msg = error?.message || "Upload gagal";
        setError(msg);
        setUploadOverlay({
          phase: "error",
          progress: Math.min(
            99,
            totalBytes > 0 ? Math.round((bytesCompleted / totalBytes) * 100) : 0,
          ),
          currentFile: lastFailedFile || filesToUpload[0]?.name || "",
          totalFiles: filesToUpload.length,
          completedFiles: 0,
          errorMessage: msg,
        });
      } finally {
        uploadAbortRef.current = null;
        setUploadingIndex(null);
      }
    },
    [apData, departmentLabel, effectiveYear, evidenceApiSlug],
  );

  const handleFileInputChange = async (index, e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setError("");
    setSuccessMessage("");
    await uploadFilesForRow(index, fileList);
    e.target.value = "";
  };

  const handleDownloadAttachment = useCallback(async (file) => {
    const url = file?.url;
    const name = file?.name || "download";
    if (!url || !buildEvidenceDownloadHref(url, name)) {
      setError("URL file tidak valid.");
      return;
    }
    if (downloadAbortRef.current) {
      downloadAbortRef.current.abort();
    }
    const abortController = new AbortController();
    downloadAbortRef.current = abortController;

    setError("");
    setDownloadOverlay({
      phase: "uploading",
      progress: 0,
      currentFile: name,
      errorMessage: "",
    });

    try {
      await downloadEvidenceWithProgress(
        url,
        name,
        (loaded, total) => {
          const t = total > 0 ? total : Math.max(loaded, 1);
          const pct = Math.min(99, Math.round((loaded / t) * 100));
          setDownloadOverlay((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "uploading",
                  progress: pct > 0 ? pct : Math.max(prev.progress || 0, 5),
                }
              : prev,
          );
        },
        { signal: abortController.signal },
      );
      setDownloadOverlay({
        phase: "success",
        progress: 100,
        currentFile: name,
        errorMessage: "",
      });
      await new Promise((r) => setTimeout(r, 1000));
      setDownloadOverlay(null);
    } catch (e) {
      if (abortController.signal.aborted || /dibatalkan/i.test(String(e?.message || ""))) {
        setDownloadOverlay(null);
        return;
      }
      setDownloadOverlay({
        phase: "error",
        progress: 0,
        currentFile: name,
        errorMessage: e?.message || "Download gagal",
      });
    } finally {
      if (downloadAbortRef.current === abortController) {
        downloadAbortRef.current = null;
      }
    }
  }, []);

  const handleDeleteAttachment = async (rowIndex, fileUrl) => {
    const row = apData[rowIndex];
    if (!row || !fileUrl) return;
    setError("");

    try {
      setUploadingIndex(rowIndex);

      const response = await fetch(getEvidenceApiUrl(evidenceApiSlug), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: departmentLabel,
          ap_id: row.ap_id,
          ap_code: row.ap_code,
          fileUrl,
          year: String(effectiveYear),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete attachment");
      }

      const remaining = Array.isArray(result.attachments)
        ? result.attachments.map((att, idx) => ({
            url: att.url,
            name: att.name || `Document ${idx + 1}`,
            uploaded_at: att.uploaded_at || null,
          }))
        : [];

      const newData = [...apData];
      newData[rowIndex] = {
        ...row,
        attachments: remaining,
        attachment: remaining[0]?.url || "",
        file_name: remaining[0]?.name || "",
      };
      setApData(newData);
    } catch (err) {
      console.error("Delete attachment error:", err);
      setError(err.message || "Failed to delete attachment");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccessMessage("");
      setSaving(true);

      // Validate data before sending
      if (!departmentLabel) {
        throw new Error("Department is required");
      }

      // Filter out rows that don't have ap_id (shouldn't happen, but just in case)
      const validEvidenceData = apData.filter(row => row.ap_id != null);

      if (validEvidenceData.length === 0) {
        throw new Error("No valid evidence data to save");
      }

      const response = await fetch(getEvidenceApiUrl(evidenceApiSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          department: departmentLabel, 
          preparer: (preparer && preparer !== "Not Set") ? String(preparer).trim() : "", 
          overallStatus: overallStatus || "INCOMPLETE", 
          year: String(effectiveYear),
          evidenceData: validEvidenceData 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || `Failed to save: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save");
      }

      setSuccessMessage("Evidence data published successfully! Data is now available in Report.");
      setTimeout(() => setSuccessMessage(""), 4000);
      setOverallStatus("DRAFT");
      await fetchApData(1);
    } catch (error) {
      console.error("Error saving data:", error);
      setError(error.message || "Failed to save evidence data");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-4 flex flex-col h-full">
        <div className="mb-3">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">B3.1 EVIDENCE</div>
            <div className="text-lg font-bold text-slate-900">{departmentLabel}</div>
            <div className="text-sm text-slate-600">
              Only APs with <span className="font-semibold">CHECK (Y/N) = Yes</span> in Audit Finding appear here; uploads are allowed for those rows only.
            </div>
          </div>
        </div>

        {/* Top controls */}
        <div className="mb-3 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
            <span className="font-semibold text-slate-700 sm:min-w-[80px]">Preparer:</span>
            <div className="relative flex-1 sm:max-w-md flex flex-col gap-1">
              {preparer ? (
                <input
                  type="text"
                  value={preparer}
                  readOnly
                  tabIndex={-1}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-slate-50 text-gray-800 cursor-default"
                  title="From Schedule → Evidence (not editable here)"
                />
              ) : (
                <div className="w-full border border-amber-200 bg-amber-50 rounded-lg px-4 py-2.5 text-sm text-amber-800">
                  Not set — assign the user in{" "}
                  <span className="font-semibold">Schedule → Evidence</span> for this department.
                </div>
              )}
              <p className="text-xs text-slate-500">
                Preparer name comes only from <span className="font-semibold">Schedule → Evidence</span> for this department.
              </p>
            </div>
          </div>
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              value={overallStatus}
              onChange={(e) => setOverallStatus(e.target.value)}
              className="w-full sm:w-auto bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38]"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="INCOMPLETE">INCOMPLETE</option>
              {(isAdmin || isReviewer || isUser) ? (
                <option value="COMPLETE">COMPLETE</option>
              ) : overallStatus === "COMPLETE" ? (
                <option value="COMPLETE">COMPLETE</option>
              ) : null}
            </select>
            <button
              onClick={handleSave}
              disabled={saving || loading || overallStatus !== "COMPLETE" || !canPublish}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canPublish ? "Sign in to publish" : "Publish"}
            >
              {saving ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
        {(overallStatus !== "COMPLETE" || !canPublish) && (
          <div className="mb-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 font-medium">
            {!canPublish
              ? "Sign in as user, reviewer, or admin to publish."
              : "Status must be COMPLETE to publish."}
          </div>
        )}

        {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {successMessage && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{successMessage}</div>}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4">
          <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-2 sm:px-4 py-3 text-left font-semibold text-xs sm:text-sm">AP Code</th>
                    <th className="border border-gray-200 px-2 sm:px-4 py-3 text-left font-semibold text-xs sm:text-sm">Substantive Test</th>
                    <th className="border border-gray-200 px-2 sm:px-4 py-3 text-left font-semibold text-xs sm:text-sm">Attachment</th>
                    <th className="border border-gray-200 px-2 sm:px-4 py-3 text-left font-semibold text-xs sm:text-sm">File Name</th>
                    <th className="border border-gray-200 px-2 sm:px-4 py-3 text-left font-semibold text-xs sm:text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="border border-gray-200 px-2 sm:px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : apData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="border border-gray-200 px-2 sm:px-4 py-8 text-center text-gray-500">
                        <div className="space-y-3 max-w-lg mx-auto">
                          <p className="font-semibold text-lg">No APs available for evidence yet</p>
                          <p className="text-sm">
                            In <strong>Audit Finding</strong> for <strong>{dashboardLabel}</strong>, set{" "}
                            <strong>CHECK (Y/N)</strong> to <strong>Yes</strong> for each row you need to attach
                            evidence to, save the table, then return here. APs without Yes stay hidden.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    apData.map((row, index) => (
                      <tr key={`${row.ap_id}-${index}`} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className="border border-gray-200 px-2 sm:px-4 py-3 text-gray-800 font-medium">{row.ap_code || "-"}</td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-3 text-gray-800">{row.substantive_test || "-"}</td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-3 text-gray-800 text-sm">
                          {row.attachments && row.attachments.length > 0 ? (
                            <div className="space-y-1">
                              {row.attachments.map((file, fileIdx) => (
                                <div
                                  key={file.url || `${row.ap_id}-${fileIdx}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <a
                                    href={buildEvidenceDownloadHref(file.url, file.name) || "#"}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs truncate max-w-[150px] sm:max-w-[220px]"
                                    title={file.name}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDownloadAttachment(file);
                                    }}
                                  >
                                    {file.name || `Document ${fileIdx + 1}`}
                                  </a>
                                  {!isReviewer && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAttachment(index, file.url)}
                                      className="inline-flex items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50 w-6 h-6 text-xs"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No document</span>
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-3 text-gray-800 text-sm">
                          {row.attachments && row.attachments.length > 0 ? (
                            <div className="space-y-1">
                              {row.attachments.map((file, fileIdx) => (
                                <div
                                  key={`filename-${file.url || `${row.ap_id}-${fileIdx}`}`}
                                  className="truncate max-w-[150px] sm:max-w-[220px]"
                                  title={file.name}
                                >
                                  {file.name || `Document ${fileIdx + 1}`}
                                </div>
                              ))}
                            </div>
                          ) : (
                            row.file_name || "-"
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-3">
                          <label
                            className={`flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap ${
                              uploadingIndex === index ||
                              isReviewer ||
                              (row.attachments && row.attachments.length >= 5)
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                            title="Pilih file ZIP atau dokumen (PDF, DOC, DOCX, XLS, XLSX). Bisa pilih banyak sekaligus."
                          >
                            {uploadingIndex === index ? "Uploading..." : "UPLOAD"}
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => handleFileInputChange(index, e)}
                              accept=".zip,.pdf,.doc,.docx,.xlsx,.xls"
                              disabled={
                                uploadingIndex === index ||
                                isReviewer ||
                                (row.attachments && row.attachments.length >= 5)
                              }
                            />
                          </label>
                          {row.attachments && row.attachments.length >= 5 && (
                            <div className="mt-1 text-[11px] text-amber-600">
                              Maksimal 5 dokumen per AP.
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          <Pagination meta={evidenceMeta} onPageChange={(p) => fetchApData(p)} loading={loading} />
        </div>
      </div>
      <EvidenceUploadProgressOverlay
        open={Boolean(uploadOverlay)}
        phase={uploadOverlay?.phase ?? "uploading"}
        progress={uploadOverlay?.progress ?? 0}
        currentFile={uploadOverlay?.currentFile ?? ""}
        totalFiles={uploadOverlay?.totalFiles ?? 0}
        completedFiles={uploadOverlay?.completedFiles ?? 0}
        errorMessage={uploadOverlay?.errorMessage ?? ""}
        mode="upload"
        onCancel={
          uploadOverlay?.phase === "uploading"
            ? () => {
                if (uploadAbortRef.current) {
                  uploadAbortRef.current.abort();
                }
              }
            : undefined
        }
        onClose={() => setUploadOverlay(null)}
      />
      <EvidenceUploadProgressOverlay
        open={Boolean(downloadOverlay)}
        phase={downloadOverlay?.phase ?? "uploading"}
        progress={downloadOverlay?.progress ?? 0}
        currentFile={downloadOverlay?.currentFile ?? ""}
        errorMessage={downloadOverlay?.errorMessage ?? ""}
        mode="download"
        onCancel={
          downloadOverlay?.phase === "uploading"
            ? () => {
                if (downloadAbortRef.current) {
                  downloadAbortRef.current.abort();
                }
              }
            : undefined
        }
        onClose={() => setDownloadOverlay(null)}
      />
    </main>
  );
}


