"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import SmallSidebar from "@/app/components/layout/SmallSidebar";

export default function AccountingEvidence() {
  const { data: session } = useSession();
  const [preparer, setPreparer] = useState("");
  const [apData, setApData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState("COMPLETE");
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const hasFetchedRef = useRef(false);

  // Set preparer from session on mount
  useEffect(() => {
    if (session?.user?.name) {
      setPreparer(session.user.name);
    }
  }, [session]);

  // Fetch AP codes from risk assessment dashboard and evidence from database
  useEffect(() => {
    // Prevent multiple fetches
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    const fetchApData = async () => {
      try {
        setLoading(true);
        console.log("Fetching data from Risk Assessment API...");
        
        // Fetch risk data with AP codes from Risk Assessment API only
        const riskResponse = await fetch("/api/RiskAssessment/accounting?status=published&includeAps=true");
        
        if (!riskResponse.ok) {
          throw new Error(`API Error: ${riskResponse.status} ${riskResponse.statusText}`);
        }
        
        const riskData = await riskResponse.json();
        console.log("Risk Assessment data with AP codes:", riskData);
        
        // Fetch saved evidence from database
        const evidenceResponse = await fetch("/api/evidence/accounting?department=ACCOUNTING");
        const evidenceResult = await evidenceResponse.json();
        console.log("Evidence Result:", evidenceResult);
        
        if (riskData && Array.isArray(riskData) && riskData.length > 0) {
          // Filter hanya data yang punya risk_id_no (AP Code)
          const apDataWithCodes = riskData.filter(item => item.risk_id_no && item.risk_id_no.trim() !== "");
          
          if (apDataWithCodes.length === 0) {
            console.warn("No Risk ID NO found. Please ensure risk data has Risk ID NO.");
            setApData([]);
            return;
          }
          
          // Create a map of saved evidence by ap_code (risk_id_no)
          const evidenceMap = {};
          if (evidenceResult.success && evidenceResult.data && Array.isArray(evidenceResult.data)) {
            evidenceResult.data.forEach((ev) => {
              if (ev.ap_code) {
                evidenceMap[ev.ap_code] = ev;
              }
            });
          }
          
          const transformedData = apDataWithCodes.map((item) => {
            const savedEvidence = evidenceMap[item.risk_id_no];
            return {
              risk_id: item.risk_id,
              ap_code: item.risk_id_no || "", // Use risk_id_no as AP Code
              substantive_test: item.substantive_test || item.risk_description || "",
              attachment: savedEvidence?.file_url || "",
              file_name: savedEvidence?.file_name || "",
              status: savedEvidence?.status || "",
            };
          });
          setApData(transformedData);
          
          if (evidenceResult.success && evidenceResult.data && evidenceResult.data.length > 0) {
            const firstEvidence = evidenceResult.data[0];
            // Only update preparer from database if session doesn't have name
            if (!session?.user?.name && firstEvidence.preparer) {
              setPreparer(firstEvidence.preparer);
            }
            if (firstEvidence.overall_status) {
              setOverallStatus(firstEvidence.overall_status);
            }
          }
        } else {
          console.warn("No data returned from Risk Assessment API");
          setApData([]);
        }
      } catch (error) {
        console.error("Error fetching data from Risk Assessment:", error);
        alert(`Error loading data: ${error.message}. Please check console for details.`);
        setApData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApData();
  }, []); // Empty dependency array - only fetch once on mount

  const handleFileUpload = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingIndex(index);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("risk_id", apData[index].risk_id);
      formData.append("ap_code", apData[index].ap_code); // risk_id_no
      formData.append("department", "ACCOUNTING");

      const response = await fetch("/api/evidence/accounting", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        const newData = [...apData];
        newData[index].attachment = result.fileUrl || "Click here to open the file";
        newData[index].file_name = result.fileName || file.name;
        setApData(newData);
        alert("File berhasil diupload!");
      } else {
        alert("Gagal upload file: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file: " + error.message);
    } finally {
      setUploadingIndex(null);
      e.target.value = "";
    }
  };


  const handleSave = async () => {
    try {
      const response = await fetch("/api/evidence/accounting", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          department: "ACCOUNTING",
          preparer,
          overallStatus,
          evidenceData: apData,
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
    }
  };

  return (
    <main className="flex flex-row w-full h-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="B3.1 EVIDENCES" showSearch={false} />
        <div className="mt-12 ml-14 flex-1 p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-[95%] mx-auto border border-gray-200">
            {/* Header Info */}
            <div className="mb-6 space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">B3.1 EVIDENCES</h1>
              <div className="flex flex-col gap-1 text-sm text-gray-700">
                <p><span className="font-semibold">DEPARTMENT:</span> ACCOUNTING</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">PREPARER:</span>
                  <input
                    type="text"
                    value={preparer}
                    onChange={(e) => setPreparer(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#141D38]"
                    placeholder="Enter preparer name"
                  />
                </div>
              </div>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#141D38] text-white">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm">AP Code</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm">Substantive Test</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm">Attachment</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm">File Name</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : apData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                        <div className="space-y-3">
                          <p className="font-semibold text-lg">⚠️ No Risk Data Found</p>
                          <p className="text-sm">Please create risk data in <strong>Risk Assessment Dashboard → Accounting</strong> first.</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Note: AP Code is automatically set from Risk ID NO in Risk Assessment.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    apData.map((row, index) => (
                      <tr 
                        key={row.ap_id || index} 
                        className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="border border-gray-300 px-4 py-3 text-gray-800 font-medium">
                          {row.ap_code || "-"}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-gray-800">
                          {row.substantive_test || "-"}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          {row.attachment ? (
                            <a
                              href={row.attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              Click here to open the file
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-gray-800 text-sm">
                          {row.file_name || "-"}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <label className="flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {uploadingIndex === index ? "Uploading..." : "UPLOAD"}
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload(index, e)}
                              accept=".pdf,.zip,.doc,.docx,.xlsx,.xls"
                              disabled={uploadingIndex === index}
                            />
                          </label>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Right Panel - Action and Status */}
            <div className="flex flex-row gap-6 items-start">
              {/* Action Section */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow-md min-w-[200px]">
                <h3 className="text-red-600 font-bold text-lg mb-4">Action</h3>
                <button
                  onClick={handleSave}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  SAVE
                </button>
              </div>

              {/* Status Section */}
              <div className="flex-1">
                <div className="mb-4">
                  <label className="text-gray-700 font-semibold text-sm mb-2 block">STATUS</label>
                  <select
                    value={overallStatus}
                    onChange={(e) => setOverallStatus(e.target.value)}
                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38] focus:border-transparent shadow-md"
                  >
                    <option value="COMPLETE">COMPLETE</option>
                    <option value="INCOMPLETE">INCOMPLETE</option>
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

