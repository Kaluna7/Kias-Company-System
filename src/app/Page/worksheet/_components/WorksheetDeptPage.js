"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import SmallHeader from "@/app/components/layout/SmallHeader";

const DEFAULT_AUDIT_AREAS = ["Bali", "Dom Air", "Jakarta", "Medan"];

export default function WorksheetDeptPage({
  apiPath,
  headerLabel,
  departmentValue,
  uploadDepartment,
  enableRoleRestrictions = false,
  auditAreas = DEFAULT_AUDIT_AREAS,
}) {
  const { data: session } = useSession();
  const role = (session?.user?.role || "").toLowerCase();
  const isReviewer = enableRoleRestrictions && role === "reviewer";
  const isAdmin = enableRoleRestrictions && role === "admin";
  const canSave = role === "admin" || role === "reviewer";

  const [preparer, setPreparer] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [preparerDate, setPreparerDate] = useState("");
  const [reviewerDate, setReviewerDate] = useState("");
  const [statusDocuments, setStatusDocuments] = useState("");
  const [statusWP, setStatusWP] = useState("");
  const [filePath, setFilePath] = useState("");
  const [auditArea, setAuditArea] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [notification, setNotification] = useState(null);

  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(apiPath, window.location.origin);
        if (yearParam) {
          url.searchParams.set("year", yearParam);
        }
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const latest = data?.rows?.[0];
        if (!latest || cancelled) return;
        setStatusWP(latest.status_wp ?? "");
        setFilePath(latest.file_path ?? "");
      } catch (_) {
        // Ignore initial load failures and keep the form usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiPath, yearParam]);

  const saveStatusWP = async (value) => {
    try {
      const res = await fetch(apiPath, {
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
      if (yearParam) {
        formData.append("year", yearParam);
      }

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
      const response = await fetch(apiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          department: departmentValue,
          preparer,
          reviewer,
          preparerDate: preparerDate || null,
          reviewerDate: reviewerDate || null,
          statusDocuments,
          statusWorksheet: filePath ? "Available" : "Not Available",
          statusWP,
          filePath,
          auditArea,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showNotification("success", "Data has been saved successfully.");
        setPreparer("");
        setReviewer("");
        setPreparerDate("");
        setReviewerDate("");
        setStatusDocuments("");
        setStatusWP("");
        setAuditArea("");
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
          backHref={`/Page/worksheet${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ""}`}
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
                    <label className={`flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg ${isReviewer ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      UPLOAD FILE
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls,.pdf"
                        disabled={isReviewer}
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
                              disabled={isReviewer || isDeletingFile}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    STATUS DOCUMENTS
                  </label>
                  <input
                    type="text"
                    value={statusDocuments}
                    onChange={(e) => setStatusDocuments(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter status"
                    disabled={isReviewer}
                  />
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
                    disabled={isReviewer}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">- Select -</option>
                    <option value="Not Checked">Not Checked</option>
                    <option value="Checked">Checked</option>
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
                  <input
                    type="text"
                    value={preparer}
                    onChange={(e) => setPreparer(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter preparer name"
                    disabled={isReviewer}
                  />
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
                    disabled={isAdmin}
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
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={isReviewer}
                    />
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
                      disabled={isAdmin}
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
                  <select
                    value={auditArea}
                    onChange={(e) => setAuditArea(e.target.value)}
                    disabled={isReviewer}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Audit Area</option>
                    {auditAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
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
