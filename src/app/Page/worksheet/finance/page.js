"use client";

import { useState } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";

export default function FinanceWorksheet() {
  const [preparer, setPreparer] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [preparerDate, setPreparerDate] = useState("");
  const [reviewerDate, setReviewerDate] = useState("");
  const [statusDocuments, setStatusDocuments] = useState("");
  const [statusWorksheet, setStatusWorksheet] = useState("IN PROGRESS");
  const [statusWP, setStatusWP] = useState("Not Checked");
  const [filePath, setFilePath] = useState("");
  const [auditArea, setAuditArea] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFilePath(file.name);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/worksheet/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          department: "FINANCE",
          preparer,
          reviewer,
          preparerDate,
          reviewerDate,
          statusDocuments,
          statusWorksheet,
          statusWP,
          filePath,
          auditArea,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Data berhasil disimpan!");
      } else {
        alert("Gagal menyimpan data: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Error menyimpan data: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex flex-row w-full h-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col flex-1">
        <SmallHeader label="B.1.1 WORKSHEET - FINANCE" showSearch={false} />
        <div className="mt-12 ml-14 flex-1 p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-7xl mx-auto border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Section */}
              <div className="space-y-6">
                {/* Files Section */}
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    FILES
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={filePath}
                              className="text-blue-600 hover:text-blue-800 hover:underline break-all font-medium text-sm flex-1"
                            >
                              {filePath}
                            </a>
                            <button
                              onClick={() => setFilePath("")}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
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
              </div>

              {/* Right Section */}
              <div className="space-y-6">
                {/* Preparer */}
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
                    placeholder="Enter preparer name"
                  />
                </div>

                {/* Reviewer */}
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
                    placeholder="Enter reviewer name"
                  />
                </div>

                {/* Preparer Date */}
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
                  />
                </div>

                {/* Reviewer Date */}
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
                  />
                </div>

                {/* Status Documents */}
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
                    placeholder="Enter status"
                  />
                </div>

                {/* Status Worksheet */}
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    STATUS WORKSHEET
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                        statusWorksheet === "IN PROGRESS"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : "bg-gray-100 text-gray-800 border border-gray-200"
                      }`}
                    >
                      {statusWorksheet}
                    </span>
                  </div>
                </div>

                {/* Status WP */}
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    STATUS WP
                  </label>
                  <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium">
                    {statusWP}
                  </div>
                </div>

                {/* Audit Area */}
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-sm transition-all"
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
            <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#141D38] hover:bg-[#141D38]/90 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
    </main>
  );
}

