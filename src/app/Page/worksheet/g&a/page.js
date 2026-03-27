"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SmallHeader from "@/app/components/layout/SmallHeader";

const API = "/api/worksheet/g&a";

function GAWorksheetPageContent() {
  const [preparer, setPreparer] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [statusDocuments, setStatusDocuments] = useState("");
  const [statusWP, setStatusWP] = useState("");
  const [filePath, setFilePath] = useState("");
  const [auditArea, setAuditArea] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const latest = data?.rows?.[0];
        if (!latest || cancelled) return;
        setStatusWP(latest.status_wp ?? "");
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("department", "g&a");

        const response = await fetch("/api/worksheet/upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (response.ok && data?.fileUrl) {
          setFilePath(data.fileUrl);
          showNotification("success", "File uploaded successfully.");
        } else {
          showNotification("error", "Failed to upload file: " + (data?.error || "Unknown error."));
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        showNotification("error", "Error while uploading file: " + (error.message || "Unknown error."));
      }
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const saveStatusWP = async (value) => {
    try {
      const res = await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusWP: value }) });
      const data = await res.json();
      if (data.success) showNotification("success", "Status WP tersimpan.");
      else showNotification("error", data?.error || "Gagal menyimpan Status WP.");
    } catch (_) { showNotification("error", "Gagal menyimpan Status WP."); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/worksheet/g&a", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          department: "G&A",
          preparer,
          reviewer,
          preparerDate: date1 ? new Date(date1).toISOString().split("T")[0] : null,
          reviewerDate: date2 ? new Date(date2).toISOString().split("T")[0] : null,
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
        setDate1("");
        setDate2("");
        setStatusDocuments("");
        setStatusWP("");
        setFilePath("");
        setAuditArea("");
      } else {
        showNotification(
          "error",
          "Failed to save data: " + (data.error || "Unknown error.")
        );
      }
    } catch (error) {
      console.error("Error saving data:", error);
      showNotification(
        "error",
        "Error while saving data: " + (error.message || "Unknown error.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex flex-col w-full h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
        <SmallHeader label="B.1.4 WORKSHEET - G&A" showSearch={false} backHref={`/Page/worksheet${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ""}`} />
        <div className="flex-1 w-full h-full overflow-y-auto mt-20 md:mt-14 p-4 md:p-6">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-7xl mx-auto border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* Left Section */}
              <div className="space-y-6">
                {/* Files Section */}
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    FILES
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      UPLOAD FILE
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls,.pdf"
                      />
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[120px] flex items-center justify-center">
                      {filePath ? (
                        <div className="w-full">
                          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <svg
                              className="w-5 h-5 text-blue-600 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <a
                              href={filePath}
                              className="text-blue-600 hover:text-blue-800 hover:underline break-all font-medium text-sm flex-1"
                            >
                              {filePath}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <svg
                            className="w-12 h-12 text-gray-300 mx-auto mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <span className="text-gray-400 text-sm">No file selected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Documents */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    STATUS DOCUMENTS :
                  </label>
                  <input
                    type="text"
                    value={statusDocuments}
                    onChange={(e) => setStatusDocuments(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="Enter status"
                  />
                </div>

                {/* Status Worksheet - auto: Available when file uploaded, Not Available when no file */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    STATUS WORKSHEET
                  </label>
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 font-medium">
                    {filePath ? "Available" : "Not Available"}
                  </div>
                </div>

                {/* Status WP */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    STATUS WP
                  </label>
                  <select
                    value={statusWP}
                    onChange={(e) => { const v = e.target.value; setStatusWP(v); saveStatusWP(v); }}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
                  >
                    <option value="">- Select -</option>
                    <option value="Not Checked">Not Checked</option>
                    <option value="Checked">Checked</option>
                  </select>
                </div>
              </div>

              {/* Right Section */}
              <div className="space-y-6">
                {/* Preparer */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PREPARER :
                  </label>
                  <input
                    type="text"
                    value={preparer}
                    onChange={(e) => setPreparer(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="Enter preparer name"
                  />
                </div>

                {/* Reviewer */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    REVIEWER :
                  </label>
                  <input
                    type="text"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="Enter reviewer name"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      PREPARER DATE
                    </label>
                    <input
                      type="date"
                      value={date1}
                      onChange={(e) => setDate1(e.target.value)}
                      className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      REVIEWER DATE
                    </label>
                    <input
                      type="date"
                      value={date2}
                      onChange={(e) => setDate2(e.target.value)}
                      className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    />
                  </div>
                </div>

                {/* Audit Area */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Audit Area
                  </label>
                  <select
                    value={auditArea}
                    onChange={(e) => setAuditArea(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                  >
                    <option value="">Select Audit Area</option>
                    <option value="Bali">Bali</option>
                    <option value="Dom Air">Dom Air</option>
                    <option value="Jakarta">Jakarta</option>
                    <option value="Medan">Medan</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#141D38] hover:bg-[#141D38]/90 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
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
      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-start gap-3 rounded-lg shadow-lg border px-4 py-3 bg-white max-w-sm ${
              notification.type === "success"
                ? "border-emerald-200"
                : "border-red-200"
            }`}
          >
            <div className="mt-0.5">
              {notification.type === "success" ? (
                <svg
                  className="w-5 h-5 text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {notification.type === "success" ? "Success" : "Error"}
              </p>
              <p className="text-sm text-gray-700 mt-0.5">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GAWorksheet() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <GAWorksheetPageContent />
    </Suspense>
  );
}

