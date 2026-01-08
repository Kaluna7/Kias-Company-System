"use client";

import { useState } from "react";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";

export default function OpsAuditFinding() {
  const [filePath, setFilePath] = useState("");
  const [preparerStatus, setPreparerStatus] = useState("");
  const [finalStatus, setFinalStatus] = useState("");
  const [findingResult, setFindingResult] = useState("ON THIS SHEET");
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

  return (
    <main className="flex flex-row w-full h-full min-h-screen bg-[#E6F0FA]">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="B.2.10 AUDIT FINDING - OPERATIONAL" showSearch={false} />
        <div className="mt-12 ml-14 flex-1 p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-[95%] mx-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">B.2.10 AUDIT FINDING OPERATIONAL</h2>
                <div className="flex items-center gap-4">
                  <label className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">
                    UPLOAD
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".xlsx,.xls,.pdf"
                    />
                  </label>
                  {filePath && (
                    <div className="text-sm text-gray-600 max-w-md truncate">{filePath}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-sm font-semibold text-gray-700">PREPARER STATUS: </span>
                  <span className="text-sm font-semibold text-red-600">{preparerStatus || "---"}</span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700">FINAL STATUS: </span>
                  <span className="text-sm font-semibold text-yellow-600">{finalStatus || "---"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6">
              <div className="col-span-1 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    FINDING RESULT:
                  </label>
                  <input
                    type="text"
                    value={findingResult}
                    onChange={(e) => setFindingResult(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    REPORT AS:
                  </label>
                  <input
                    type="text"
                    value={reportAs}
                    onChange={(e) => setReportAs(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="Enter report as"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PREPARE:
                  </label>
                  <input
                    type="text"
                    value={prepare}
                    onChange={(e) => setPrepare(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="Enter preparer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    DATE:
                  </label>
                  <input
                    type="text"
                    value={prepareDate}
                    onChange={(e) => setPrepareDate(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    REVIEW:
                  </label>
                  <input
                    type="text"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="Enter reviewer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    DATE:
                  </label>
                  <input
                    type="text"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
              </div>

              <div className="col-span-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#141D38] text-white">
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">NO</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">ISK ID NI</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">RISK DESCRIPTION</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">RISK DETAILS</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">AP CODI</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">SUBTANTIVE TEST</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">RISICHECK (Y/N)</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">METHOD</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Preparer</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">FINDING RESULT</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">FINDING DESCRIPTION</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">RECOMMENDATION</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">AUDITEE</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">COMPLETION STATUS</th>
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold">COMPLETION DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-[#E6F0FA]"}>
                        <td className="border border-gray-300 px-2 py-2">{row.no}</td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.riskId}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].riskId = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="A2.1.1"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.riskDescription}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].riskDescription = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="Risk description"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <textarea
                            value={row.riskDetails}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].riskDetails = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none resize-none"
                            rows={2}
                            placeholder="Risk details"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.apCode}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].apCode = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="A2.1.1.1"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.substantiveTest}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].substantiveTest = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="Test name"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={row.riskCheck}
                              onChange={(e) => {
                                const newData = [...tableData];
                                newData[index].riskCheck = e.target.value;
                                setTableData(newData);
                              }}
                              className="w-12 bg-transparent border-none focus:outline-none"
                              placeholder="6"
                            />
                            <select
                              value={row.riskCheckYN}
                              onChange={(e) => {
                                const newData = [...tableData];
                                newData[index].riskCheckYN = e.target.value;
                                setTableData(newData);
                              }}
                              className="bg-transparent border-none focus:outline-none"
                            >
                              <option value="">-</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.method}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].method = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="Random"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.preparer}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].preparer = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="Name"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.findingResult}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].findingResult = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="Minor Findings"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <textarea
                            value={row.findingDescription}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].findingDescription = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none resize-none"
                            rows={2}
                            placeholder="Finding description"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <textarea
                            value={row.recommendation}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].recommendation = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none resize-none"
                            rows={2}
                            placeholder="Recommendation"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.auditee}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].auditee = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="Auditee name"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <select
                            value={row.completionStatus}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].completionStatus = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                          >
                            <option value="">-</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="DRAFT">DRAFT</option>
                            <option value="IN PROGRESS">IN PROGRESS</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={row.completionDate}
                            onChange={(e) => {
                              const newData = [...tableData];
                              newData[index].completionDate = e.target.value;
                              setTableData(newData);
                            }}
                            className="w-full bg-transparent border-none focus:outline-none"
                            placeholder="DD/MM/YYYY"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => {
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
                  }}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Add Row
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

