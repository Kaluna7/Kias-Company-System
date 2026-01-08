"use client";

import { useState } from "react";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";

export default function GAWorksheet() {
  const [preparer, setPreparer] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [statusDocuments, setStatusDocuments] = useState("");
  const [statusWorksheet, setStatusWorksheet] = useState("Draft");
  const [statusWP, setStatusWP] = useState("Not Checked");
  const [filePath, setFilePath] = useState("");
  const [auditArea, setAuditArea] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFilePath(file.name);
    }
  };

  return (
    <main className="flex flex-row w-full h-full min-h-screen bg-[#E6F0FA]">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="B.1.4 WORKSHEET - G&A" showSearch={false} />
        <div className="mt-12 ml-14 flex-1 p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 gap-8">
              {/* Left Section */}
              <div className="space-y-6">
                {/* Worksheet Title */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">B.1.4 WORKSHEET</h2>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    DEPARTMENT
                  </label>
                  <div className="text-lg font-medium text-gray-800">G&A</div>
                </div>

                {/* Files Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    FILES
                  </label>
                  <div className="flex gap-3 items-start">
                    <label className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">
                      UPLOAD
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls,.pdf"
                      />
                    </label>
                    <div className="flex-1 border-2 border-black rounded-md p-3 bg-white min-h-[100px] flex items-center">
                      {filePath ? (
                        <a
                          href={filePath}
                          className="text-blue-600 hover:underline break-all"
                        >
                          {filePath}
                        </a>
                      ) : (
                        <span className="text-gray-400">No file selected</span>
                      )}
                    </div>
                  </div>
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
                      DATE
                    </label>
                    <input
                      type="text"
                      value={date1}
                      onChange={(e) => setDate1(e.target.value)}
                      className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                      placeholder="DD-MMM-YY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      DATE
                    </label>
                    <input
                      type="text"
                      value={date2}
                      onChange={(e) => setDate2(e.target.value)}
                      className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                      placeholder="DD-MMM-YY"
                    />
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

                {/* Status Worksheet */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    STATUS WORKSHEET :
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-4 py-2 rounded-md font-medium ${
                        statusWorksheet === "IN PROGRESS"
                          ? "bg-yellow-400 text-yellow-900"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {statusWorksheet}
                    </span>
                  </div>
                </div>

                {/* Status WP */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    STATUS WP :
                  </label>
                  <div className="text-gray-800">{statusWP}</div>
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
          </div>
        </div>
      </div>
    </main>
  );
}

