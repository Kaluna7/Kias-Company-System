"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Pagination from "@/app/components/ui/Pagination";

export default function EvidenceDeptPage({
  departmentLabel, // e.g. "ACCOUNTING"
  evidenceApiSlug, // e.g. "accounting"
  dashboardLabel, // e.g. "Accounting"
}) {
  const { data: session } = useSession();
  const role = (session?.user?.role || "").toLowerCase();
  const isReviewer = role === "reviewer";
  const isAdmin = role === "admin";
  const [preparer, setPreparer] = useState("");
  const [apData, setApData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState("DRAFT");
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [evidenceMeta, setEvidenceMeta] = useState(null);
  const hasFetchedRef = useRef(false);
  const searchParams = useSearchParams();
  const yearParam = searchParams?.get("year");
  const yearFilter = yearParam ? parseInt(yearParam, 10) : null;
  const backHref = `/Page/evidence${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ""}`;

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

  // Fetch preparer from schedule
  const fetchPreparerFromSchedule = async () => {
    try {
      const scheduleDeptId = getScheduleDeptId(departmentLabel);
      if (!scheduleDeptId) {
        setPreparer("");
        return null;
      }

      const res = await fetch(`/api/schedule/module?module=evidence`);
      const result = await res.json().catch(() => ({}));
      
      if (result.success && Array.isArray(result.rows)) {
        // Find schedule row for this department
        const scheduleRow = result.rows.find(
          row => row.department_id === scheduleDeptId && row.is_configured === true
        );
        
        if (scheduleRow?.user_name) {
          setPreparer(scheduleRow.user_name);
          return scheduleRow.user_name;
        }
      }
      
      // If no schedule found, set preparer to empty
      setPreparer("");
      return null;
    } catch (error) {
      console.warn("Failed to fetch preparer from schedule:", error);
      setPreparer("");
      return null;
    }
  };

  const fetchApData = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      if (page === 1) {
        await fetchPreparerFromSchedule();
      }

      const pageSize = evidenceMeta?.pageSize ?? 50;
      const params = new URLSearchParams({
        department: departmentLabel,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (yearFilter) {
        params.set("year", String(yearFilter));
      }
      // Sembunyikan data yang sudah dipublish (COMPLETE + ada file) dari halaman departemen;
      // data tersebut akan tampil di halaman Report.
      params.set("exclude_published", "1");
      const res = await fetch(`/api/evidence/${evidenceApiSlug}?${params.toString()}`);
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
        if (result.meta.overall_status) setOverallStatus(result.meta.overall_status);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPreparerFromSchedule stable, pageSize from meta
  }, [departmentLabel, evidenceApiSlug, evidenceMeta?.pageSize, yearFilter]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchApData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const row = apData[index];
    if (Array.isArray(row.attachments) && row.attachments.length >= 5) {
      setError("Maximum 5 documents allowed for each AP.");
      e.target.value = "";
      return;
    }

    setUploadingIndex(index);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("ap_id", row.ap_id);
      formData.append("ap_code", row.ap_code);
      formData.append("department", departmentLabel);

      const response = await fetch(`/api/evidence/${evidenceApiSlug}`, { method: "POST", body: formData });
      const result = await response.json();

      if (response.ok && result.success) {
        const newData = [...apData];
        const existingAttachments = Array.isArray(row.attachments) ? row.attachments : [];
        const updatedAttachments = [
          ...existingAttachments,
          {
            url: result.fileUrl,
            name: result.fileName || file.name,
            uploaded_at: new Date().toISOString(),
          },
        ].slice(0, 5);

        newData[index] = {
          ...row,
          attachment: updatedAttachments[0]?.url || "",
          file_name: updatedAttachments[0]?.name || "",
          attachments: updatedAttachments,
        };
        setApData(newData);
      } else {
        setError(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setError(error.message || "Upload failed");
    } finally {
      setUploadingIndex(null);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (rowIndex, fileUrl) => {
    const row = apData[rowIndex];
    if (!row || !fileUrl) return;
    setError("");

    try {
      setUploadingIndex(rowIndex);

      const response = await fetch(`/api/evidence/${evidenceApiSlug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: departmentLabel,
          ap_id: row.ap_id,
          ap_code: row.ap_code,
          fileUrl,
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

      const response = await fetch(`/api/evidence/${evidenceApiSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          department: departmentLabel, 
          preparer: (preparer && preparer !== "Not Set") ? preparer : "", 
          overallStatus: overallStatus || "INCOMPLETE", 
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
      hasFetchedRef.current = false;
      await fetchApData(1);
      hasFetchedRef.current = true;
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
            <div className="text-sm text-slate-600">Document uploads are linked to Audit Program AP codes</div>
          </div>
        </div>

        {/* Top controls */}
        <div className="mb-3 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
            <span className="font-semibold text-slate-700 sm:min-w-[80px]">Preparer:</span>
            <div className="relative flex-1 sm:max-w-xs">
              {preparer ? (
                <input
                  type="text"
                  value={preparer}
                  onChange={(e) => setPreparer(e.target.value)}
                  className="w-full border border-blue-300 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter preparer name"
                  disabled={isReviewer}
                />
              ) : (
                <div className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed flex items-center">
                  <span className="text-gray-400 italic">Not Set</span>
                </div>
              )}
            </div>
            {!preparer && (
              <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 font-medium">
                Set in schedule module
              </span>
            )}
          </div>
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              value={overallStatus}
              onChange={(e) => setOverallStatus(e.target.value)}
              disabled={!isAdmin && !isReviewer}
              className="w-full sm:w-auto bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="INCOMPLETE">INCOMPLETE</option>
              {(isAdmin || isReviewer) && <option value="COMPLETE">COMPLETE</option>}
            </select>
            <button
              onClick={handleSave}
              disabled={saving || loading || overallStatus !== "COMPLETE"}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
        {overallStatus !== "COMPLETE" && (
          <div className="mb-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 font-medium">
            {isReviewer ? "Status must be COMPLETE to publish" : "Hanya role Reviewer yang dapat mengubah status ke COMPLETE"}
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
                        <div className="space-y-3">
                          <p className="font-semibold text-lg">No Audit Program data found</p>
                          <p className="text-sm">
                            Please create Audit Program data for <strong>{dashboardLabel}</strong> first.
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
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs truncate max-w-[150px] sm:max-w-[220px]"
                                    title={file.name}
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
                          {row.file_name || "-"}
                        </td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-3">
                          <label
                            className={`flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap ${
                              isReviewer || (row.attachments && row.attachments.length >= 5)
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                          >
                            {uploadingIndex === index ? "Uploading..." : "UPLOAD"}
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload(index, e)}
                              accept=".pdf,.zip,.doc,.docx,.xlsx,.xls"
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
    </main>
  );
}


