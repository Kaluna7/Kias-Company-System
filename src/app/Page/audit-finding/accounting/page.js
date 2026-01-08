"use client";

import { useState, useEffect } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";

export default function AccountingAuditFinding() {
  const [filePath, setFilePath] = useState("");
  const [preparerStatus, setPreparerStatus] = useState("");
  const [finalStatus, setFinalStatus] = useState("");
  const [findingResultFile, setFindingResultFile] = useState("");
  const [reportAs, setReportAs] = useState("");
  const [prepare, setPrepare] = useState("");
  const [prepareDate, setPrepareDate] = useState("");
  const [review, setReview] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newRowData, setNewRowData] = useState({
    riskId: "",
    riskDescription: "",
    riskDetails: "",
    apCode: "",
    substantiveTest: "",
    risk: "",
    checkYN: "",
    method: "",
    preparer: "",
    findingResult: "",
    findingDescription: "",
    recommendation: "",
    auditee: "",
    completionStatus: "",
    completionDate: "",
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFilePath(file.name);
    }
  };

  const handleFindingResultUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFindingResultFile(file.name);
    }
  };

  // Sample table data - empty for now
  const [tableData, setTableData] = useState([]);

  const statusOptions = [
    { value: "", label: "- Select -" },
    { value: "COMPLETED", label: "COMPLETED" },
    { value: "DRAFT", label: "DRAFT" },
    { value: "IN PROGRESS", label: "IN PROGRESS" },
    { value: "PENDING REVIEW", label: "PENDING REVIEW" },
    { value: "APPROVED", label: "APPROVED" },
  ];

  const yesNoOptions = [
    { value: "", label: "-" },
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
  ];

  const handleStatusChange = (type, value) => {
    if (type === "preparer") {
      setPreparerStatus(value);
    } else if (type === "final") {
      setFinalStatus(value);
    }
  };

  const handleAddRow = () => {
    setTableData([
      ...tableData,
      {
        no: tableData.length + 1,
        riskId: "",
        riskDescription: "",
        riskDetails: "",
        apCode: "",
        substantiveTest: "",
        risk: "",
        checkYN: "",
        method: "",
        preparer: "",
        findingResult: "",
        findingDescription: "",
        recommendation: "",
        auditee: "",
        completionStatus: "",
        completionDate: "",
      },
    ]);
  };

  const handleRemoveRow = async (index) => {
    const row = tableData[index];
    
    // If row has an ID, delete from database
    if (row?.id) {
      try {
        setLoading(true);
        const response = await fetch(`/api/audit-finding/accounting/${row.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to delete row");
        }
      } catch (err) {
        console.error("Error deleting row:", err);
        setError(err.message);
        alert(`Error deleting row: ${err.message}`);
        return;
      } finally {
        setLoading(false);
      }
    }

    // Remove from local state
    if (tableData.length > 0) {
      const newData = tableData.filter((_, i) => i !== index);
      // Update row numbers
      const updatedData = newData.map((row, idx) => ({
        ...row,
        no: idx + 1,
      }));
      setTableData(updatedData);
    }
  };

  const handleOpenModal = () => {
    setNewRowData({
      riskId: "",
      riskDescription: "",
      riskDetails: "",
      apCode: "",
      substantiveTest: "",
      risk: "",
      checkYN: "",
      method: "",
      preparer: "",
      findingResult: "",
      findingDescription: "",
      recommendation: "",
      auditee: "",
      completionStatus: "",
      completionDate: "",
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Fetch data from API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/audit-finding/accounting");
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      const result = await response.json();
      const formattedData = result.data.map((item, index) => ({
        no: index + 1,
        id: item.id,
        riskId: item.risk_id || "",
        riskDescription: item.risk_description || "",
        riskDetails: item.risk_details || "",
        apCode: item.ap_code || "",
        substantiveTest: item.substantive_test || "",
        risk: item.risk || "",
        checkYN: item.check_yn || "",
        method: item.method || "",
        preparer: item.preparer || "",
        findingResult: item.finding_result || "",
        findingDescription: item.finding_description || "",
        recommendation: item.recommendation || "",
        auditee: item.auditee || "",
        completionStatus: item.completion_status || "",
        completionDate: item.completion_date ? item.completion_date.split("T")[0] : "",
      }));
      setTableData(formattedData);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveNewRow = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/audit-finding/accounting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRowData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save data");
      }

      await fetchData(); // Refresh data
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllChanges = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Update all rows that have an ID (already saved to database)
      const updatePromises = tableData
        .filter((row) => row.id) // Only update rows that have been saved
        .map(async (row) => {
          const response = await fetch(`/api/audit-finding/accounting/${row.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
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

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to update row ${row.id}`);
          }

          return response.json();
        });

      await Promise.all(updatePromises);
      await fetchData(); // Refresh data
      alert("All changes saved successfully!");
    } catch (err) {
      console.error("Error saving all changes:", err);
      setError(err.message);
      alert(`Error saving changes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-6 max-w-full">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                B.2.2 AUDIT FINDING - ACCOUNTING
              </h1>
              <p className="text-gray-600 mt-1">
                Document and track accounting audit findings and recommendations
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveAllChanges}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Save All Changes
              </button>
            </div>
          </div>

          {/* Status Section */}
          <div className="flex flex-wrap items-center gap-6 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                PREPARER STATUS:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={preparerStatus}
                  onChange={(e) => handleStatusChange("preparer", e.target.value)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent bg-white"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  preparerStatus === "COMPLETED" 
                    ? "bg-yellow-100 text-red-600 border border-yellow-200" 
                    : preparerStatus === "IN PROGRESS"
                    ? "bg-red-100 text-red-600 border border-red-200"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  {preparerStatus || "Not Set"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                FINAL STATUS:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={finalStatus}
                  onChange={(e) => handleStatusChange("final", e.target.value)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent bg-white"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  finalStatus === "IN PROGRESS"
                    ? "bg-red-100 text-red-600 border border-red-200"
                    : finalStatus === "COMPLETED"
                    ? "bg-green-100 text-green-600 border border-green-200"
                    : "bg-yellow-100 text-yellow-600 border border-yellow-200"
                }`}>
                  {finalStatus || "Not Set"}
                </span>
              </div>
            </div>
          </div>

          {/* File Path Display */}
          {filePath && (
            <div className="mb-6">
              <div className="relative p-4 rounded-xl border border-[#141D38]/30 bg-[#141D38]/10 shadow-sm">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Uploaded File:</p>
                    <a 
                      href="#" 
                      className="text-[#141D38] hover:text-[#141D38]/80 text-sm font-medium flex items-center gap-2"
                    >
                      <span className="truncate">{filePath}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
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
            </div>
          )}

          {/* Finding Details Section - Moved to Top */}
          <div className="mb-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Finding Details
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    FINDING RESULT
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141D38] hover:bg-[#141D38]/90 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload File
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFindingResultUpload}
                        accept=".xlsx,.xls,.pdf,.doc,.docx"
                      />
                    </label>
                    {findingResultFile && (
                      <div className="p-2 bg-[#141D38]/10 border border-[#141D38]/30 rounded-lg">
                        <p className="text-xs font-medium text-[#141D38] truncate">{findingResultFile}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-[#141D38]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    REPORT AS
                  </label>
                  <select
                    value={reportAs}
                    onChange={(e) => setReportAs(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent text-gray-800 shadow-sm transition-all"
                  >
                    <option value="">- Select -</option>
                    <option value="on this sheet">On This Sheet</option>
                    <option value="attachment file">Attachment File</option>
                  </select>
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    PREPARE
                  </label>
                  <input
                    type="text"
                    value={prepare}
                    onChange={(e) => setPrepare(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent text-gray-800 placeholder-gray-400 shadow-sm transition-all"
                    placeholder="Name"
                  />
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    PREPARE DATE
                  </label>
                  <input
                    type="date"
                    value={prepareDate}
                    onChange={(e) => setPrepareDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent text-gray-800 shadow-sm transition-all"
                  />
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    REVIEW
                  </label>
                  <input
                    type="text"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent text-gray-800 placeholder-gray-400 shadow-sm transition-all"
                    placeholder="Name"
                  />
                </div>

                <div>
                  <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    REVIEW DATE
                  </label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent text-gray-800 shadow-sm transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Section - Full Width */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-end">
              <button
                onClick={handleOpenModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#141D38] hover:bg-[#141D38]/90 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Data
              </button>
            </div>

            <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full table-fixed border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">NO</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">RISK ID</th>
                    <th className="p-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">RISK DESCRIPTION</th>
                    <th className="p-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">RISK DETAILS</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">AP CODE</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">SUBSTANTIVE TEST</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">RISK</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">CHECK (Y/N)</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">METHOD</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">PREPARER</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">FINDING RESULT</th>
                    <th className="p-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">FINDING DESCRIPTION</th>
                    <th className="p-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">RECOMMENDATION</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">AUDITEE</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">COMPLETION STATUS</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">COMPLETION DATE</th>
                    <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-lg font-semibold text-gray-600">No Data</p>
                          <p className="text-sm text-gray-400 mt-1">Click &quot;Add Data&quot; to add a new finding</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableData.map((row, index) => {
                      const isReadOnly = !!row.id; // Jika row.id ada, berarti sudah tersimpan dan read-only
                      return (
                        <tr 
                          key={row.id || index} 
                          className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                        >
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                            {row.no}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.riskId || "-") : (
                              <input
                                type="text"
                                value={row.riskId}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].riskId = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="A2.1.1"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top" title={row.riskDescription || undefined}>
                            {isReadOnly ? (row.riskDescription || "-") : (
                              <input
                                type="text"
                                value={row.riskDescription}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].riskDescription = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="Risk description"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top" title={row.riskDetails || undefined}>
                            {isReadOnly ? (row.riskDetails || "-") : (
                              <textarea
                                value={row.riskDetails}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].riskDetails = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded resize-none"
                                rows={2}
                                placeholder="Risk details"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.apCode || "-") : (
                              <input
                                type="text"
                                value={row.apCode}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].apCode = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="A2.1.1.1"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.substantiveTest || "-") : (
                              <input
                                type="text"
                                value={row.substantiveTest}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].substantiveTest = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="Test name"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.risk || "-") : (
                              <input
                                type="number"
                                value={row.risk}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].risk = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="6"
                                min="0"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.checkYN || "-") : (
                              <select
                                value={row.checkYN}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].checkYN = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                              >
                                {yesNoOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.method || "-") : (
                              <select
                                value={row.method}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].method = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                              >
                                <option value="">Select Method</option>
                                <option value="Random Sampling">Random Sampling</option>
                                <option value="Judgmental Sampling">Judgmental Sampling</option>
                                <option value="Statistical Sampling">Statistical Sampling</option>
                                <option value="Full Population">Full Population</option>
                                <option value="Analytical Procedures">Analytical Procedures</option>
                              </select>
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.preparer || "-") : (
                              <input
                                type="text"
                                value={row.preparer}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].preparer = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="Name"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.findingResult || "-") : (
                              <input
                                type="text"
                                value={row.findingResult}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].findingResult = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="Minor Findings"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top" title={row.findingDescription || undefined}>
                            {isReadOnly ? (row.findingDescription || "-") : (
                              <textarea
                                value={row.findingDescription}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].findingDescription = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded resize-none"
                                rows={2}
                                placeholder="Finding description"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top" title={row.recommendation || undefined}>
                            {isReadOnly ? (row.recommendation || "-") : (
                              <textarea
                                value={row.recommendation}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].recommendation = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded resize-none"
                                rows={2}
                                placeholder="Recommendation"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.auditee || "-") : (
                              <input
                                type="text"
                                value={row.auditee}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].auditee = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                                placeholder="Auditee name"
                              />
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.completionStatus || "-") : (
                              <select
                                value={row.completionStatus}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].completionStatus = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center whitespace-nowrap">
                            {isReadOnly ? (row.completionDate || "-") : (
                              <input
                                type="date"
                                value={row.completionDate}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].completionDate = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                              />
                            )}
                          </td>
                          <td className="p-1 text-center border border-gray-200">
                            {isReadOnly && (
                              <button
                                onClick={() => handleRemoveRow(index)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="Remove row"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      {/* Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={handleCloseModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-5xl max-h-[85vh] bg-[#0F1730] rounded-2xl shadow-xl overflow-hidden ring-1 ring-white/10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white text-xl md:text-2xl font-semibold">Add New Finding</h2>
              <button
                onClick={handleCloseModal}
                aria-label="Close"
                className="text-white/80 hover:text-white rounded-md p-2 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveNewRow(); }} className="px-6 py-6">
              <div className="bg-gray-50 p-3 rounded-lg h-[62vh] max-h-[62vh] overflow-y-auto">
                <div className="pr-2" style={{ scrollbarGutter: "stable" }}>
                  <div className="grid grid-cols-4 gap-4 p-4">
                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">RISK ID</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newRowData.riskId}
                        onChange={(e) => setNewRowData({...newRowData, riskId: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="A2.1.1"
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">AP CODE</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newRowData.apCode}
                        onChange={(e) => setNewRowData({...newRowData, apCode: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="A2.1.1.1"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700">RISK DESCRIPTION</label>
                      <input
                        type="text"
                        value={newRowData.riskDescription}
                        onChange={(e) => setNewRowData({...newRowData, riskDescription: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Risk description"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700">RISK DETAILS</label>
                      <textarea
                        value={newRowData.riskDetails}
                        onChange={(e) => setNewRowData({...newRowData, riskDetails: e.target.value})}
                        className="w-full p-3 rounded resize-y min-h-[6rem] max-h-[16rem] border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Risk details"
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">SUBSTANTIVE TEST</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newRowData.substantiveTest}
                        onChange={(e) => setNewRowData({...newRowData, substantiveTest: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Test name"
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">RISK</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        value={newRowData.risk}
                        onChange={(e) => setNewRowData({...newRowData, risk: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white appearance-none"
                        placeholder="6"
                        min="0"
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">CHECK (Y/N)</label>
                    </div>
                    <div className="col-span-3">
                      <select
                        value={newRowData.checkYN}
                        onChange={(e) => setNewRowData({...newRowData, checkYN: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      >
                        {yesNoOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">METHOD</label>
                    </div>
                    <div className="col-span-3">
                      <select
                        value={newRowData.method}
                        onChange={(e) => setNewRowData({...newRowData, method: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      >
                        <option value="">Pilih...</option>
                        <option value="Random Sampling">Random Sampling</option>
                        <option value="Judgmental Sampling">Judgmental Sampling</option>
                        <option value="Statistical Sampling">Statistical Sampling</option>
                        <option value="Full Population">Full Population</option>
                        <option value="Analytical Procedures">Analytical Procedures</option>
                      </select>
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">PREPARER</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newRowData.preparer}
                        onChange={(e) => setNewRowData({...newRowData, preparer: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Name"
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">FINDING RESULT</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newRowData.findingResult}
                        onChange={(e) => setNewRowData({...newRowData, findingResult: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Minor Findings"
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">AUDITEE</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newRowData.auditee}
                        onChange={(e) => setNewRowData({...newRowData, auditee: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Auditee name"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700">FINDING DESCRIPTION</label>
                      <textarea
                        value={newRowData.findingDescription}
                        onChange={(e) => setNewRowData({...newRowData, findingDescription: e.target.value})}
                        className="w-full p-3 rounded resize-y min-h-[6rem] max-h-[16rem] border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Finding description"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700">RECOMMENDATION</label>
                      <textarea
                        value={newRowData.recommendation}
                        onChange={(e) => setNewRowData({...newRowData, recommendation: e.target.value})}
                        className="w-full p-3 rounded resize-y min-h-[6rem] max-h-[16rem] border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        placeholder="Recommendation"
                      />
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">COMPLETION STATUS</label>
                    </div>
                    <div className="col-span-3">
                      <select
                        value={newRowData.completionStatus}
                        onChange={(e) => setNewRowData({...newRowData, completionStatus: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-1 flex items-center">
                      <label className="text-sm font-medium text-gray-700">COMPLETION DATE</label>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="date"
                        value={newRowData.completionDate}
                        onChange={(e) => setNewRowData({...newRowData, completionDate: e.target.value})}
                        className="w-full p-2 rounded h-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
