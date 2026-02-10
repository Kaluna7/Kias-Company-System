"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

export default function EvidenceDeptPage({
  departmentLabel, // e.g. "ACCOUNTING"
  evidenceApiSlug, // e.g. "accounting"
  dashboardLabel, // e.g. "Accounting"
}) {
  const { data: session } = useSession();
  const [preparer, setPreparer] = useState("");
  const [apData, setApData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState("COMPLETE");
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [error, setError] = useState("");
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (session?.user?.name) setPreparer(session.user.name);
  }, [session]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchApData = async () => {
      try {
        setLoading(true);
        setError("");

        // Source of truth: Audit Program (AP code + substantive test) merged with evidence
        const res = await fetch(`/api/evidence/${evidenceApiSlug}?department=${encodeURIComponent(departmentLabel)}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result?.error || `API Error: ${res.status} ${res.statusText}`);

        const rows = Array.isArray(result?.data) ? result.data : [];
        setApData(
          rows.map((r) => ({
            ap_id: r.ap_id,
            ap_code: r.ap_code || "",
            substantive_test: r.substantive_test || "",
            attachment: r.attachment || "",
            file_name: r.file_name || "",
            status: r.status || "",
          }))
        );

        if (!session?.user?.name && result?.meta?.preparer) setPreparer(result.meta.preparer);
        if (result?.meta?.overall_status) setOverallStatus(result.meta.overall_status);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error.message || "Failed to load data");
        setApData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIndex(index);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("ap_id", apData[index].ap_id);
      formData.append("ap_code", apData[index].ap_code);
      formData.append("department", departmentLabel);

      const response = await fetch(`/api/evidence/${evidenceApiSlug}`, { method: "POST", body: formData });
      const result = await response.json();

      if (result.success) {
        const newData = [...apData];
        newData[index].attachment = result.fileUrl || "";
        newData[index].file_name = result.fileName || file.name;
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

  const handleSave = async () => {
    try {
      setError("");
      const response = await fetch(`/api/evidence/${evidenceApiSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: departmentLabel, preparer, overallStatus, evidenceData: apData }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to save");
    } catch (error) {
      console.error("Error saving data:", error);
      setError(error.message || "Failed to save");
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      <div className="px-3 sm:px-4 pt-6 pb-4 flex flex-col h-full">
        <div className="mb-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">B3.1 EVIDENCE</div>
            <div className="text-lg font-bold text-slate-900">{departmentLabel}</div>
            <div className="text-sm text-slate-600">Document uploads are linked to Audit Program AP codes</div>
          </div>
        </div>

        {/* Top controls */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">Preparer:</span>
            <input
              type="text"
              value={preparer}
              onChange={(e) => setPreparer(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141D38] bg-white"
              placeholder="Enter preparer name"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={overallStatus}
              onChange={(e) => setOverallStatus(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#141D38]"
            >
              <option value="COMPLETE">COMPLETE</option>
              <option value="INCOMPLETE">INCOMPLETE</option>
            </select>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Save
            </button>
          </div>
        </div>

        {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4">
          <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">AP Code</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">Substantive Test</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">Attachment</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">File Name</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="border border-gray-200 px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : apData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="border border-gray-200 px-4 py-8 text-center text-gray-500">
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
                        <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">{row.ap_code || "-"}</td>
                        <td className="border border-gray-200 px-4 py-3 text-gray-800">{row.substantive_test || "-"}</td>
                        <td className="border border-gray-200 px-4 py-3">
                          {row.attachment ? (
                            <div className="flex items-center gap-3">
                              <a
                                href={row.attachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                Open
                              </a>
                              <a
                                href={row.attachment}
                                download={row.file_name || `evidence_${row.ap_code || row.ap_id || ""}`}
                                className="text-slate-700 hover:text-slate-900 hover:underline font-medium"
                              >
                                Download
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-gray-800 text-sm">{row.file_name || "-"}</td>
                        <td className="border border-gray-200 px-4 py-3">
                          <label className="flex items-center justify-center gap-2 bg-[#141D38] hover:bg-[#141D38]/90 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer">
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
        </div>
      </div>
    </main>
  );
}


