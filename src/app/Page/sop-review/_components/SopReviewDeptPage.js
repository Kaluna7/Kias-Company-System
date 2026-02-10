"use client";

import { useEffect, useState } from "react";
import SOPHeader from "@/app/components/layout/Sop-Review/SOPHeader";

export default function SopReviewDeptPage({ apiPath, departmentName }) {
  const [preparerStatus, setPreparerStatus] = useState("DRAFT");
  const [reviewerStatus, setReviewerStatus] = useState("DRAFT");
  const [sopData, setSopData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const [preparerName, setPreparerName] = useState("");
  const [preparerDate, setPreparerDate] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerDate, setReviewerDate] = useState("");
  const [reviewerComment, setReviewerComment] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);


  const reindex = (list) => list.map((item, idx) => ({ ...item, no: idx + 1 }));

  const safeJson = async (res) => {
    const raw = await res.text().catch(() => "");
    try {
      return { data: raw ? JSON.parse(raw) : {}, raw };
    } catch (e) {
      return { data: null, raw };
    }
  };

  useEffect(() => {
    let mounted = true;
    async function fetchRows() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [res, metaRes] = await Promise.all([
          fetch(`/api/SopReview/${apiPath}`, { method: "GET" }),
          fetch(`/api/SopReview/${apiPath}/meta`, { method: "GET" }),
        ]);
        const [{ data: json, raw: rawSteps }, { data: metaJson, raw: rawMeta }] = await Promise.all([
          safeJson(res),
          safeJson(metaRes),
        ]);

        if (!res.ok) {
          const msg = (json && json.error) || `HTTP ${res.status} | ${rawSteps || "no body"}`;
          setLoadError(msg);
          setSopData([]);
        } else {
          const rows = Array.isArray(json?.rows) ? json.rows : [];
          const normalized = rows.map((r, idx) => ({
            id: r.id ?? null,
            no: r.no ?? idx + 1,
            sop_related: (r.sop_related || "").toString(),
            status: r.status || "DRAFT",
            comment: r.comment || "",
            reviewer: r.reviewer || "",
          }));
          if (mounted) setSopData(reindex(normalized));
        }

        if (metaRes.ok && Array.isArray(metaJson?.rows) && metaJson.rows.length > 0) {
          const latest = metaJson.rows[0];
          if (mounted) {
            setPreparerStatus(latest.preparer_status || "DRAFT");
            setReviewerStatus(latest.reviewer_status || "DRAFT");
            setPreparerName(latest.preparer_name || "");
            setPreparerDate(latest.preparer_date ? String(latest.preparer_date).slice(0, 10) : "");
            setReviewerComment(latest.reviewer_comment || "");
            setReviewerName(latest.reviewer_name || "");
            setReviewerDate(latest.reviewer_date ? String(latest.reviewer_date).slice(0, 10) : "");
          }
        } else if (!metaRes.ok) {
          console.error("Load meta failed:", rawMeta);
        }
      } catch (err) {
        console.error("Fetch existing sops error:", err);
        setLoadError(String(err));
        setSopData([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchRows();
    return () => {
      mounted = false;
    };
  }, [apiPath]);

  const handleSopParsed = (parsedSops) => {
    if (!Array.isArray(parsedSops) || parsedSops.length === 0) return;
    setSopData((prev) => {
      const existingTitles = new Set(prev.map((p) => (p.sop_related || "").trim().toLowerCase()));
      const newItems = parsedSops
        .map((it) => ({
          id: it.id ?? null,
          sop_related: (it.sop_related || it.name || "").trim(),
          status: it.status || "DRAFT",
          comment: it.comment || "",
          reviewer: it.reviewer || "",
        }))
        .filter((it) => it.sop_related && !existingTitles.has(it.sop_related.toLowerCase()));
      return reindex([...prev, ...newItems]);
    });
  };

  const updateRow = (index, changes) => {
    setSopData((prev) => {
      const copy = prev.map((r) => ({ ...r }));
      copy[index] = { ...copy[index], ...changes };
      return reindex(copy);
    });
  };

  const addRow = () => {
    setSopData((prev) => reindex([...prev, {
      id: null,
      sop_related: "",
      status: "DRAFT",
      comment: "",
      reviewer: "",
    }]));
  };

  const removeRow = (index) => {
    if (!confirm("Remove this SOP item from the list?")) return;
    setSopData((prev) => reindex(prev.filter((_, i) => i !== index)));
  };

  const preparePayload = (list) =>
    reindex(list).map((it) => ({
      no: it.no,
      sop_related: (it.sop_related || "").trim(),
      status: it.status || null,
      comment: it.comment || null,
      reviewer: it.reviewer || null,
    }));

  const handleSidebarSaveDraft = (sidebarData) => {
    try {
      if (sidebarData?.preparerStatus) setPreparerStatus(sidebarData.preparerStatus);
      if (sidebarData?.reviewerStatus) setReviewerStatus(sidebarData.reviewerStatus);
      if (sidebarData?.preparerName !== undefined) setPreparerName(sidebarData.preparerName || "");
      if (sidebarData?.preparerDate !== undefined) setPreparerDate(sidebarData.preparerDate || "");
      if (sidebarData?.reviewerName !== undefined) setReviewerName(sidebarData.reviewerName || "");
      if (sidebarData?.reviewerDate !== undefined) setReviewerDate(sidebarData.reviewerDate || "");
      if (sidebarData?.reviewerComment !== undefined) setReviewerComment(sidebarData.reviewerComment || "");

      setSaveMessage({ type: "success", text: "Sidebar draft saved locally. Click Publish to save it to the server." });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Save sidebar error:", err);
      setSaveMessage({ type: "error", text: "Failed to save sidebar draft." });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleToggleHeader = () => {
    setIsHeaderCollapsed(prev => !prev);
  };

  const isPublishAllowed =
    String(preparerStatus || "").toUpperCase() === "APPROVED" &&
    String(reviewerStatus || "").toUpperCase() === "APPROVED";

  async function postJson(url, body) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text().catch(() => "");
    try { return text ? JSON.parse(text) : {}; } catch (e) { return { success: false, error: "Invalid JSON response", rawText: text }; }
  }

  const publishToReport = async () => {
    if (sopData.length === 0) {
      setSaveMessage({ type: "error", text: "No SOP items to publish." });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    if (!isPublishAllowed) {
      setSaveMessage({
        type: "error",
        text: "Publish is only allowed when both Preparer and Reviewer statuses are APPROVED.",
      });
      setTimeout(() => setSaveMessage(null), 4000);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      // 1) Ensure latest draft saved to department tables
      const stepsPayload = preparePayload(sopData);
      const metaPayload = {
        department_name: departmentName,
        preparer_status: preparerStatus,
        preparer_name: preparerName || null,
        preparer_date: preparerDate || null,
        reviewer_comment: reviewerComment || null,
        reviewer_status: reviewerStatus,
        reviewer_name: reviewerName || null,
        reviewer_date: reviewerDate || null,
      };

      const [metaRes, res] = await Promise.all([
        fetch(`/api/SopReview/${apiPath}/meta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metaPayload) }),
        fetch(`/api/SopReview/${apiPath}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stepsPayload) }),
      ]);
      if (!metaRes.ok || !res.ok) {
        const metaTxt = await metaRes.text().catch(() => "");
        const stepsTxt = await res.text().catch(() => "");
        throw new Error(`Failed to save draft before publishing. Meta: ${metaTxt || metaRes.status} | Steps: ${stepsTxt || res.status}`);
      }

      // 2) Publish (move to report + clear dept tables)
      const pubRes = await fetch(`/api/SopReview/${apiPath}/publish`, { method: "POST" });
      const pubJson = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok || !pubJson.success) {
        throw new Error(pubJson.error || `Publish failed (HTTP ${pubRes.status})`);
      }

      setSaveMessage({ type: "success", text: `✅ Published ${pubJson.published ?? sopData.length} SOP to Report. Department data has been cleared.` });

      // 3) Clear local state + refresh
      setSopData([]);
      setPreparerStatus("DRAFT");
      setReviewerStatus("DRAFT");
      setPreparerName("");
      setPreparerDate("");
      setReviewerName("");
      setReviewerDate("");
      setReviewerComment("");
    } catch (err) {
      console.error("Publish error:", err);
      setSaveMessage({ type: "error", text: err?.message || "Failed to publish." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const openPublishModal = () => {
    if (sopData.length === 0) {
      setSaveMessage({ type: "error", text: "No SOP items to publish." });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    setPublishModalOpen(true);
  };


  // Status badge function (kept for compatibility but now using inline styling)
  const getStatusBadge = (status) => {
    return ""; // No longer needed since we use inline styling in the select
  };

  return (
    <main className="min-h-screen w-full bg-[#E6F0FA]">
      {/* Integrated Header with SOP Source & Status */}
      <SOPHeader
        department={departmentName}
        apiPath={apiPath}
        preparerStatus={preparerStatus}
        reviewerStatus={reviewerStatus}
        onPreparerStatusChange={setPreparerStatus}
        onReviewerStatusChange={setReviewerStatus}
        preparerName={preparerName}
        preparerDate={preparerDate}
        reviewerComment={reviewerComment}
        reviewerName={reviewerName}
        reviewerDate={reviewerDate}
        onPreparerNameChange={setPreparerName}
        onPreparerDateChange={setPreparerDate}
        onReviewerCommentChange={setReviewerComment}
        onReviewerNameChange={setReviewerName}
        onReviewerDateChange={setReviewerDate}
        onSaveSidebar={handleSidebarSaveDraft}
        onSopParsed={handleSopParsed}
        isPublishing={isSaving}
        saveMessage={saveMessage}
        sopDataCount={sopData.length}
        isCollapsed={isHeaderCollapsed}
        onToggleCollapse={handleToggleHeader}
      />

      <div className={`px-3 sm:px-4 pb-4 flex flex-col h-full transition-all duration-500 ease-in-out ${
        isHeaderCollapsed ? 'pt-16' : 'pt-28'
      }`}>
        {/* SOP table */}
        <div className="flex-1 min-w-0 w-full h-full flex flex-col">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-600 bg-white rounded-lg border border-gray-200">
              Loading SOPs from server...
            </div>
          ) : loadError ? (
            <div className="p-4 text-center text-sm text-red-600 bg-white rounded-lg border border-gray-200">
              Failed to load data: {loadError}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl overflow-hidden flex-1 flex flex-col min-h-0 backdrop-blur-sm">
              {/* Table Header with SOP title moved here */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-blue-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-blue-600 text-sm font-bold">📋</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">SOP Source &amp; Status</span>
                    <span className="text-xs text-slate-500">{departmentName}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs font-medium text-slate-700">📊</span>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                        sopData.length > 0
                          ? "bg-green-100 text-green-800 border-green-300"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {sopData.length > 0 ? "AVAILABLE" : "Not Available"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end text-xs text-slate-500">
                  <div className="hidden sm:flex items-center gap-1 text-slate-600">
                    <span className="text-[11px]">Total SOP:</span>
                    <span className="text-[11px] font-semibold text-blue-700">{sopData.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sopData.length > 0 && (
                      <button
                        onClick={addRow}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md flex items-center gap-1"
                        title="Add new SOP item"
                      >
                        <span>➕</span>
                        <span className="hidden sm:inline">Add SOP Item</span>
                      </button>
                    )}
                    <button
                      onClick={openPublishModal}
                      disabled={sopData.length === 0 || isSaving}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        sopData.length === 0 || isSaving
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
                      }`}
                    >
                      {isSaving ? "Publishing..." : "Publish"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Content */}
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="min-w-full table-fixed border-collapse">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
                    <tr className="border-b border-slate-200/60">
                      <th className="p-3 text-center font-bold text-slate-700 border-r border-slate-200/40 w-12 sticky left-0 bg-gradient-to-r from-slate-100 to-slate-50">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs">No</span>
                        </div>
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700 border-r border-slate-200/40 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                            <span className="text-blue-600 text-xs">📝</span>
                          </span>
                          <span className="text-xs">SOP DESCRIPTION</span>
                        </div>
                      </th>
                      <th className="p-3 text-center font-bold text-slate-700 border-r border-slate-200/40 w-32">
                        <div className="flex items-center justify-center gap-1">
                          <span className="w-3 h-3 bg-yellow-100 rounded-full"></span>
                          <span className="text-xs">STATUS</span>
                        </div>
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700 border-r border-slate-200/40 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 bg-green-100 rounded flex items-center justify-center">
                            <span className="text-green-600 text-xs">💬</span>
                          </span>
                          <span className="text-xs">REVIEW COMMENT</span>
                        </div>
                      </th>
                      <th className="p-3 text-center font-bold text-slate-700 border-r border-slate-200/40 w-28">
                        <div className="flex items-center gap-1">
                          <span className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center">
                            <span className="text-purple-600 text-xs">👤</span>
                          </span>
                          <span className="text-xs">REVIEWER</span>
                        </div>
                      </th>
                      <th className="p-3 text-center font-bold text-slate-700 w-20">
                        <span className="text-xs">ACTIONS</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sopData.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                        } hover:bg-blue-50/30 transition-colors duration-150 border-b border-slate-100/60 group`}
                      >
                        {/* Row Number */}
                        <td className="p-3 text-center align-top sticky left-0 bg-inherit border-r border-slate-200/40">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-xs font-bold text-slate-600">{row.no}</span>
                          </div>
                        </td>

                        {/* SOP Description */}
                        <td className="p-3 align-top border-r border-slate-200/40">
                          <div className="relative">
                            <textarea
                              value={row.sop_related}
                              onChange={(e) => updateRow(idx, { sop_related: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-blue-200 focus:border-blue-400 focus:bg-white rounded-lg px-3 py-2 text-sm transition-all duration-200 resize-none leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              rows={2}
                              placeholder="Enter SOP description..."
                            />
                            {row.sop_related && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center align-top border-r border-slate-200/40">
                          <select
                            value={row.status || ""}
                            onChange={(e) => updateRow(idx, { status: e.target.value })}
                            className={`w-full px-2 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                              row.status === 'APPROVED'
                                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                : row.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                                : row.status === 'IN REVIEW'
                                ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                : 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                            }`}
                          >
                            <option value="">Not set</option>
                            <option value="DRAFT">📝 Draft</option>
                            <option value="IN REVIEW">🔄 In Review</option>
                            <option value="APPROVED">✅ Approved</option>
                            <option value="REJECTED">❌ Rejected</option>
                          </select>
                        </td>

                        {/* Review Comment */}
                        <td className="p-3 align-top border-r border-slate-200/40">
                          <div className="relative">
                            <input
                              value={row.comment || ""}
                              onChange={(e) => updateRow(idx, { comment: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-green-200 focus:border-green-400 focus:bg-white rounded-lg px-3 py-2 text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                              placeholder="Enter review comment..."
                            />
                            {row.comment && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></div>
                            )}
                          </div>
                        </td>

                        {/* Reviewer */}
                        <td className="p-3 text-center align-top border-r border-slate-200/40">
                          <div className="relative">
                            <input
                              value={row.reviewer || ""}
                              onChange={(e) => updateRow(idx, { reviewer: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-purple-200 focus:border-purple-400 focus:bg-white rounded-lg px-3 py-2 text-sm text-center transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                              placeholder="Reviewer..."
                            />
                            {row.reviewer && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full"></div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center align-top">
                          <button
                            onClick={() => removeRow(idx)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            title="Delete this SOP item"
                          >
                            <span className="text-sm">🗑️</span>
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sopData.length === 0 && (
                      <tr>
                        <td colSpan={6} className="border-0">
                          <div className="flex flex-col items-center justify-center py-16 px-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4 shadow-lg">
                              <span className="text-3xl">📄</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">No SOP Items Yet</h3>
                            <p className="text-sm text-slate-500 text-center max-w-md mb-6">
                              Start by uploading a PDF document from the header above. The system will automatically extract SOP procedures and populate this table for review.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-full">
                              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                              <span>Ready to process PDF documents</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish Modal (no alert/confirm) */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setPublishModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">Publish SOP Review</div>
                <div className="text-xs text-slate-600">
                  Department: <span className="font-semibold">{departmentName}</span> · Total SOP:{" "}
                  <span className="font-semibold">{sopData.length}</span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-2">Preparer</div>
                  <div className="text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Name</span>
                      <span className="font-semibold break-all">{preparerName || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Date</span>
                      <span className="font-semibold">{preparerDate || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`font-bold ${
                          String(preparerStatus || "").toUpperCase() === "APPROVED"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {preparerStatus || "DRAFT"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-800 mb-2">Reviewer</div>
                  <div className="text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Name</span>
                      <span className="font-semibold break-all">{reviewerName || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Date</span>
                      <span className="font-semibold">{reviewerDate || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">Status</span>
                      <span
                        className={`font-bold ${
                          String(reviewerStatus || "").toUpperCase() === "APPROVED"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {reviewerStatus || "DRAFT"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-white bg-red-600 w-fit rounded-2xl px-2 py-0.5 ">Rule !</div>
                <div className="text-sm text-slate-600 mt-1">
                  Publish is only allowed when <span className="font-semibold">Preparer</span> and{" "}
                  <span className="font-semibold">Reviewer</span> statuses are{" "}
                  <span className="font-semibold">APPROVED</span>.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isPublishAllowed || isSaving}
                onClick={async () => {
                  setPublishModalOpen(false);
                  await publishToReport();
                }}
                className={`px-4 py-2 rounded-xl font-semibold text-white ${
                  !isPublishAllowed || isSaving
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md"
                }`}
              >
                {isSaving ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


