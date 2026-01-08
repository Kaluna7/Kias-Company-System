"use client";

import { useState } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";

export default function MISAuditFinding() {
  const [filePath, setFilePath] = useState("");
  const [preparerStatus, setPreparerStatus] = useState("");
  const [finalStatus, setFinalStatus] = useState("");
  const [findingResult, setFindingResult] = useState("");
  const [reportAs, setReportAs] = useState("");
  const [prepare, setPrepare] = useState("");
  const [prepareDate, setPrepareDate] = useState("");
  const [review, setReview] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFilePath(file.name);
    }
  };

  // Sample table data - empty for now
  const [tableData, setTableData] = useState([
    {
      no: 1,
      riskId: "",
      riskDescription: "",
      riskDetails: "",
      apCode: "",
      substantiveTest: "",
      riskCheck: "",
      riskCheckYN: "",
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
        riskCheck: "",
        riskCheckYN: "",
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

  const handleRemoveRow = (index) => {
    if (tableData.length > 1) {
      const newData = tableData.filter((_, i) => i !== index);
      // Update row numbers
      const updatedData = newData.map((row, idx) => ({
        ...row,
        no: idx + 1,
      }));
      setTableData(updatedData);
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
                B.2.8 AUDIT FINDING - MIS
              </h1>
              <p className="text-gray-600 mt-1">
                Document and track MIS audit findings and recommendations
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <label className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  UPLOAD FILE
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".xlsx,.xls,.pdf,.doc,.docx"
                  />
                </label>
              </div>
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
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
              <div className="relative p-4 rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Uploaded File:</p>
                    <a 
                      href="#" 
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2"
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

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Panel - Information */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                  Finding Details
                </h2>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      FINDING RESULT
                    </label>
                    <input
                      type="text"
                      value={findingResult}
                      onChange={(e) => setFindingResult(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                      placeholder="Enter finding result"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      REPORT AS
                    </label>
                    <input
                      type="text"
                      value={reportAs}
                      onChange={(e) => setReportAs(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                      placeholder="Enter report designation"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">PREPARE</label>
                      <input
                        type="text"
                        value={prepare}
                        onChange={(e) => setPrepare(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">DATE</label>
                      <input
                        type="date"
                        value={prepareDate}
                        onChange={(e) => setPrepareDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">REVIEW</label>
                      <input
                        type="text"
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">DATE</label>
                      <input
                        type="date"
                        value={reviewDate}
                        onChange={(e) => setReviewDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Total Findings:</span>
                      <span className="font-semibold text-gray-900">{tableData.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Table */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Audit Findings Table</h2>
                    <button
                      onClick={handleAddRow}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Finding
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[1400px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-12">NO</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-20">RISK ID</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-left border-r border-gray-200 w-48">RISK DESCRIPTION</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-left border-r border-gray-200 w-48">RISK DETAILS</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-20">AP CODE</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-40">SUBSTANTIVE TEST</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-32">RISK CHECK (Y/N)</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-32">METHOD</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-32">PREPARER</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-32">FINDING RESULT</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-left border-r border-gray-200 w-48">FINDING DESCRIPTION</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-left border-r border-gray-200 w-48">RECOMMENDATION</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-32">AUDITEE</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center border-r border-gray-200 w-40">COMPLETION STATUS</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center w-32">COMPLETION DATE</th>
                          <th className="p-3 text-xs font-semibold text-gray-700 text-center w-20">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, index) => (
                          <tr 
                            key={index} 
                            className={`border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }`}
                          >
                            <td className="p-3 text-xs text-gray-800 text-center border-r border-gray-200">
                              {row.no}
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.riskId}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].riskId = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                placeholder="A2.1.1"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.riskDescription}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].riskDescription = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Risk description"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <textarea
                                value={row.riskDetails}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].riskDetails = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                rows={2}
                                placeholder="Risk details"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.apCode}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].apCode = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                placeholder="A2.1.1.1"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.substantiveTest}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].substantiveTest = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                placeholder="Test name"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={row.riskCheck}
                                  onChange={(e) => {
                                    const newData = [...tableData];
                                    newData[index].riskCheck = e.target.value;
                                    setTableData(newData);
                                  }}
                                  className="w-16 px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                  placeholder="6"
                                  min="0"
                                />
                                <select
                                  value={row.riskCheckYN}
                                  onChange={(e) => {
                                    const newData = [...tableData];
                                    newData[index].riskCheckYN = e.target.value;
                                    setTableData(newData);
                                  }}
                                  className="flex-1 px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                >
                                  {yesNoOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <select
                                value={row.method}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].method = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                              >
                                <option value="">Select Method</option>
                                <option value="Random Sampling">Random Sampling</option>
                                <option value="Judgmental Sampling">Judgmental Sampling</option>
                                <option value="Statistical Sampling">Statistical Sampling</option>
                                <option value="Full Population">Full Population</option>
                                <option value="Analytical Procedures">Analytical Procedures</option>
                              </select>
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.preparer}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].preparer = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                placeholder="Name"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.findingResult}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].findingResult = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                placeholder="Minor Findings"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <textarea
                                value={row.findingDescription}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].findingDescription = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                rows={2}
                                placeholder="Finding description"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <textarea
                                value={row.recommendation}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].recommendation = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                rows={2}
                                placeholder="Recommendation"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="text"
                                value={row.auditee}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].auditee = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                placeholder="Auditee name"
                              />
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <select
                                value={row.completionStatus}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].completionStatus = e.target.value;
                                  setTableData(newData);
                                }}
                                className={`w-full px-2 py-1.5 text-xs bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center ${
                                  row.completionStatus === "COMPLETED"
                                    ? "border-green-300 bg-green-50"
                                    : row.completionStatus === "IN PROGRESS"
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-gray-300"
                                }`}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              <input
                                type="date"
                                value={row.completionDate}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[index].completionDate = e.target.value;
                                  setTableData(newData);
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-transparent border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleRemoveRow(index)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors duration-150"
                                title="Remove row"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-semibold">{tableData.length}</span> findings
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleAddRow}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Row
                      </button>
                      <button
                        onClick={() => console.log("Save all data:", tableData)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md"
                      >
                        Save All Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
