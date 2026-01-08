// pages/Page/sop-review/finance.js
"use client";

import { useState, useEffect } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SOPSidebar from "@/app/components/layout/Sop-Review/Sidebar-Sop";

export default function FinanceSopReview() {
  const [preparerStatus, setPreparerStatus] = useState("DRAFT");
  const [reviewerStatus, setReviewerStatus] = useState("DRAFT");
  const [sopData, setSopData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const departmentName = "Finance";
  const sopStatusValue = "AVAILABLE";
  const [preparerName, setPreparerName] = useState("");
  const [preparerDate, setPreparerDate] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerDate, setReviewerDate] = useState("");
  const [reviewerComment, setReviewerComment] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // modal for viewing single comment (preview & save)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentModalText, setCommentModalText] = useState("");
  const [commentModalTitle, setCommentModalTitle] = useState("");
  const [commentModalPending, setCommentModalPending] = useState(false);
  const [commentModalIndex, setCommentModalIndex] = useState(null);

  const reindex = (list) => list.map((item, idx) => ({ ...item, no: idx + 1 }));

  // safely parse JSON, return both parsed and raw text for better error logs
  const safeJson = async (res) => {
    const raw = await res.text().catch(() => "");
    try { return { data: raw ? JSON.parse(raw) : {}, raw }; } catch (e) { return { data: null, raw }; }
  };

  // Fetch existing rows on mount
  useEffect(() => {
    let mounted = true;
    async function fetchRows() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [res, metaRes] = await Promise.all([
          fetch("/api/SopReview/finance", { method: "GET" }),
          fetch("/api/SopReview/finance/meta", { method: "GET" }),
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
            no: r.no ?? (idx + 1),
            sop_related: (r.sop_related || "").toString(),
            status: r.status || "DRAFT",
            comment: r.comment || "",
            reviewer: r.reviewer || ""
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
    return () => { mounted = false; };
  }, []);

  // when SOPSidebar calls onSopParsed, include comment/id if present
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
          reviewer: it.reviewer || ""
        }))
        .filter((it) => it.sop_related && !existingTitles.has(it.sop_related.toLowerCase()));

      const merged = [...prev, ...newItems];
      return reindex(merged);
    });
  };

  const updateRow = (index, changes) => {
    setSopData((prev) => {
      const copy = prev.map((r) => ({ ...r }));
      copy[index] = { ...copy[index], ...changes };
      return reindex(copy);
    });
  };

  const removeRow = (index) => {
    if (!confirm("Hapus SOP ini dari daftar?")) return;
    setSopData((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      return reindex(copy);
    });
  };

  const preparePayload = (list) =>
    reindex(list).map((it) => ({
      no: it.no,
      sop_related: (it.sop_related || "").trim(),
      status: it.status || null,
      comment: it.comment || null,
      reviewer: it.reviewer || null
    }));

  const handleSidebarSaveDraft = (sidebarData) => {
    try {
      // Save to state (local draft)
      if (sidebarData?.preparerStatus) setPreparerStatus(sidebarData.preparerStatus);
      if (sidebarData?.reviewerStatus) setReviewerStatus(sidebarData.reviewerStatus);
      if (sidebarData?.preparerName !== undefined) setPreparerName(sidebarData.preparerName || "");
      if (sidebarData?.preparerDate !== undefined) setPreparerDate(sidebarData.preparerDate || "");
      if (sidebarData?.reviewerName !== undefined) setReviewerName(sidebarData.reviewerName || "");
      if (sidebarData?.reviewerDate !== undefined) setReviewerDate(sidebarData.reviewerDate || "");
      if (sidebarData?.reviewerComment !== undefined) setReviewerComment(sidebarData.reviewerComment || "");
      
      setSaveMessage({ type: "success", text: "Draft sidebar disimpan (lokal). Klik Publish untuk menyimpan ke server." });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Save sidebar error:", err);
      setSaveMessage({ type: "error", text: "Gagal menyimpan draft sidebar." });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // helper: post and safe-parse JSON
  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await res.text().catch(() => "");
    try { return text ? JSON.parse(text) : {}; } catch (e) { return { success:false, error:"Invalid JSON response", rawText: text }; }
  }

  // save all rows to server (unchanged)
  const saveAllToServer = async () => {
    if (sopData.length === 0) {
      alert("Tidak ada SOP untuk disimpan.");
      return;
    }

    for (const it of sopData) {
      if (!it.sop_related || !it.sop_related.trim()) {
        alert("Semua SOP harus memiliki deskripsi (SOP Related). Harap periksa kembali.");
        return;
      }
    }

    if (!confirm(`Simpan ${sopData.length} SOP ke server?`)) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const stepsPayload = preparePayload(sopData);
      const metaPayload = {
        department_name: departmentName,
        sop_status: sopStatusValue,
        preparer_status: preparerStatus,
        preparer_name: preparerName || null,
        preparer_date: preparerDate || null,
        reviewer_comment: reviewerComment || null,
        reviewer_status: reviewerStatus,
        reviewer_name: reviewerName || null,
        reviewer_date: reviewerDate || null,
      };

      const [metaRes, res] = await Promise.all([
        fetch("/api/SopReview/finance/meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaPayload),
        }),
        fetch("/api/SopReview/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepsPayload)
        })
      ]);

      const [{ data: metaJson, raw: rawMeta }, { data: json, raw: rawSteps }] = await Promise.all([
        safeJson(metaRes),
        safeJson(res),
      ]);

      const stepsOk = res.ok;
      const metaOk = metaRes.ok;

      if (!stepsOk || !metaOk) {
        const errMeta = !metaOk ? (metaJson?.error || `Meta HTTP ${metaRes.status} | ${rawMeta || "no body"}`) : null;
        const errSteps = !stepsOk ? (json?.error || json?.message || `SOP HTTP ${res.status} | ${rawSteps || "no body"}`) : null;
        setSaveMessage({
          type: "error",
          text: `Gagal menyimpan${errMeta ? ` meta: ${errMeta}` : ""}${errSteps ? ` | SOP: ${errSteps}` : ""}`,
        });
        console.error("Save error meta/steps:", { metaJson, json, rawMeta, rawSteps });
      } else {
        setSaveMessage({ type: "success", text: `Berhasil menyimpan meta & ${json.inserted?.length ?? sopData.length} SOP.` });
        if (Array.isArray(json.inserted) && json.inserted.length > 0) {
          setSopData(prev => {
            const map = new Map(json.inserted.map(r => [ (r.sop_related||"").trim().toLowerCase(), r ]));
            return reindex(prev.map(row => {
              const key = (row.sop_related||"").trim().toLowerCase();
              if (map.has(key)) {
                const r = map.get(key);
                return {
                  ...row,
                  id: r.id ?? row.id ?? null,
                  comment: r.comment ?? row.comment ?? "",
                  status: r.status ?? row.status,
                  reviewer: r.reviewer ?? row.reviewer
                };
              }
              return row;
            }));
          });
        }
      }
    } catch (err) {
      console.error("Network/save error:", err);
      setSaveMessage({ type: "error", text: "Terjadi kesalahan jaringan saat menyimpan." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const getStatusBadge = (status) => {
    switch ((status || "").toUpperCase()) {
      case "APPROVED":
        return "bg-green-100 text-green-800 border border-green-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 border border-red-200";
      case "IN REVIEW":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "DRAFT":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  // ========== NEW FLOW: preview modal + save to DB ==========
  // 1) request preview comment for a given row (shows modal)
  const genCommentForRow = async (index) => {
    const row = sopData[index];
    if (!row || !row.sop_related) { alert("Tidak ada teks SOP untuk di-generate."); return; }
    try {
      // call preview endpoint
      const res = await postJson("/api/SopReview/finance/generate-comments-preview", { items: [{ id: row.id ?? null, sop_related: row.sop_related }] });
      console.log("generate-preview response:", res);
      if (res && res.success && Array.isArray(res.comments) && res.comments.length > 0) {
        const commentObj = res.comments[0];
        const comment = commentObj?.comment ?? "";
        // show modal with preview
        setCommentModalText(comment);
        setCommentModalTitle(row.sop_related?.slice(0,80) || `Langkah ${row.no}`);
        setCommentModalIndex(index);
        setCommentModalOpen(true);
      } else {
        console.error("Preview failed:", res);
        alert("Gagal meng-generate komentar preview. Cek console.");
      }
    } catch (err) {
      console.error("genCommentForRow error:", err);
      alert("Error saat generate komentar preview. Cek console.");
    }
  };

  // 2) Save comment from modal -> call server generate-comments (which will update DB)
  const saveCommentFromModal = async () => {
    if (commentModalIndex == null) return;
    const idx = commentModalIndex;
    const row = sopData[idx];
    if (!row) { alert("Baris tidak ditemukan."); return; }
    const previewComment = (commentModalText || "").trim();
    if (!previewComment) { alert("Tidak ada komentar untuk disimpan."); return; }

    setCommentModalPending(true);

    try {
      // Call generate-comments (server will generate & update). We pass same item so server will generate then update.
      // If you prefer server to accept our preview and update DB without regen, you'd need a separate update endpoint.
      const res = await postJson("/api/SopReview/finance/generate-comments", { items: [{ id: row.id ?? null, sop_related: row.sop_related }] });
      console.log("generate-comments save response:", res);

      if (res && res.success && Array.isArray(res.updated) && res.updated.length > 0) {
        // Merge updated rows into state: match by id (preferred) or sop_related
        setSopData(prev => {
          const mapById = new Map(res.updated.filter(r => r.id != null).map(r => [r.id, r]));
          const mapByText = new Map(res.updated.map(r => [(r.sop_related||"").trim().toLowerCase(), r]));
          return reindex(prev.map(rowLocal => {
            const keyText = (rowLocal.sop_related || "").trim().toLowerCase();
            if (rowLocal.id != null && mapById.has(rowLocal.id)) {
              const r = mapById.get(rowLocal.id);
              return { ...rowLocal, comment: r.comment ?? rowLocal.comment, status: r.status ?? rowLocal.status, reviewer: r.reviewer ?? rowLocal.reviewer, id: r.id ?? rowLocal.id };
            } else if (mapByText.has(keyText)) {
              const r = mapByText.get(keyText);
              return { ...rowLocal, comment: r.comment ?? rowLocal.comment, status: r.status ?? rowLocal.status, reviewer: r.reviewer ?? rowLocal.reviewer, id: r.id ?? rowLocal.id };
            }
            return rowLocal;
          }));
        });

        alert("Komentar tersimpan dan UI terupdate.");
      } else {
        // server didn't return updated rows; fallback: apply preview locally
        updateRow(idx, { comment: previewComment });
        console.warn("generate-comments did not return updated rows:", res);
        alert("Komentar diterapkan di UI (lokal). Penyimpanan di server gagal atau tidak mengembalikan data. Cek console.");
      }
    } catch (err) {
      console.error("saveCommentFromModal error:", err);
      // fallback local apply
      updateRow(idx, { comment: previewComment });
      alert("Gagal menyimpan ke server — komentar diterapkan secara lokal. Cek console.");
    } finally {
      setCommentModalPending(false);
      setCommentModalOpen(false);
      setCommentModalIndex(null);
    }
  };

  // open modal to view comment (bigger) — still allow viewing existing comment
  const viewComment = (index) => {
    const row = sopData[index];
    if (!row) return;
    setCommentModalTitle(row.sop_related ? `Langkah ${row.no}` : `Langkah ${row.no}`);
    setCommentModalText(row.comment || "(Tidak ada komentar)");
    setCommentModalIndex(index);
    setCommentModalOpen(true);
  };

  return (
    <main className="flex flex-row w-full h-full min-h-screen bg-[#E6F0FA]">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="Finance SOP Review" showSearch={false} />
        <div className="mt-12 ml-14 flex-1 p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-[95%] mx-auto">
            {/* Header Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Finance SOP Review</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveAllToServer}
                    disabled={sopData.length === 0 || isSaving}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      sopData.length === 0 || isSaving
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isSaving ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-sm font-semibold text-gray-700">PREPARER STATUS: </span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${
                    preparerStatus === "COMPLETED" || preparerStatus === "APPROVED"
                      ? "bg-yellow-100 text-red-600"
                      : preparerStatus === "PROGRESS" || preparerStatus === "IN REVIEW"
                      ? "bg-red-100 text-red-600"
                      : preparerStatus === "DRAFT"
                      ? "bg-yellow-100 text-yellow-800"
                      : "text-red-600"
                  }`}>
                    {preparerStatus || "---"}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700">REVIEWER STATUS: </span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${
                    reviewerStatus === "PROGRESS" || reviewerStatus === "IN REVIEW"
                      ? "bg-red-100 text-red-600"
                      : reviewerStatus === "APPROVED"
                      ? "bg-green-100 text-green-800"
                      : reviewerStatus === "DRAFT"
                      ? "bg-yellow-100 text-yellow-800"
                      : "text-yellow-600"
                  }`}>
                    {reviewerStatus || "---"}
                  </span>
                </div>
              </div>
            </div>

            {saveMessage && (
              <div className={`mb-4 px-4 py-3 rounded-md ${
                saveMessage.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
              }`}>
                {saveMessage.text}
              </div>
            )}

            <div className="flex gap-6">
              {/* Left Panel */}
              <div className="w-80 flex-shrink-0">
                <SOPSidebar
                  department={departmentName}
                  sopStatus={sopStatusValue}
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
                />
              </div>

              {/* Main Table - Right Side */}
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-gray-600 bg-white rounded-lg border border-gray-200">Loading SOPs from server...</div>
                ) : loadError ? (
                  <div className="p-4 text-center text-sm text-red-600 bg-white rounded-lg border border-gray-200">Gagal memuat data: {loadError}</div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full table-fixed border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-12">NO</th>
                            <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">SOP RELATED</th>
                            <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-32">STATUS</th>
                            <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200">COMMENT REVIEW</th>
                            <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-32">REVIEWER</th>
                            <th className="p-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-40">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sopData.map((row, idx) => (
                            <tr key={idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                              <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">{row.no}</td>

                              <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                                <textarea
                                  value={row.sop_related}
                                  onChange={(e) => updateRow(idx, { sop_related: e.target.value })}
                                  className="w-full bg-transparent border-none focus:outline-none resize-none"
                                  rows={2}
                                  placeholder="SOP Related..."
                                />
                              </td>

                              <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                                <select
                                  value={row.status || ""}
                                  onChange={(e) => updateRow(idx, { status: e.target.value })}
                                  className={`w-full bg-transparent border-none focus:outline-none text-center text-xs ${getStatusBadge(row.status)}`}
                                >
                                  <option value="">Not set</option>
                                  <option value="DRAFT">DRAFT</option>
                                  <option value="IN REVIEW">IN REVIEW</option>
                                  <option value="APPROVED">APPROVED</option>
                                  <option value="REJECTED">REJECTED</option>
                                </select>
                              </td>

                              <td className="p-1 text-xs text-gray-800 border border-gray-200 text-left break-words whitespace-pre-wrap align-top">
                                <input
                                  value={row.comment || ""}
                                  onChange={(e) => updateRow(idx, { comment: e.target.value })}
                                  className="w-full bg-transparent border-none focus:outline-none"
                                  placeholder="Reviewer comment..."
                                />
                              </td>

                              <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                                <input
                                  value={row.reviewer || ""}
                                  onChange={(e) => updateRow(idx, { reviewer: e.target.value })}
                                  className="w-full bg-transparent border-none focus:outline-none text-center"
                                  placeholder="Reviewer username..."
                                />
                              </td>

                              <td className="p-1 text-xs text-gray-800 border border-gray-200 text-center">
                                <div className="flex gap-1 justify-center items-center flex-wrap">
                                  <button
                                    onClick={() => genCommentForRow(idx)}
                                    title="Generate comment preview"
                                    className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100 whitespace-nowrap"
                                  >
                                    Gen
                                  </button>

                                  <button
                                    onClick={() => viewComment(idx)}
                                    title="View comment"
                                    className="px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs hover:bg-gray-100 whitespace-nowrap"
                                  >
                                    View
                                  </button>

                                  <button
                                    onClick={() => removeRow(idx)}
                                    title="Hapus"
                                    className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs hover:bg-red-100 whitespace-nowrap"
                                  >
                                    Del
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {sopData.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-xs text-gray-500 border border-gray-200">
                                No SOPs yet. Upload a PDF to extract SOP items.
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
          </div>
        </div>
      </div>

      {/* Comment modal */}
      {commentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[min(800px,95vw)] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">{commentModalTitle}</h3>
              <button className="text-gray-600" onClick={() => { setCommentModalOpen(false); setCommentModalIndex(null); }}>✕</button>
            </div>
            <div className="p-4">
              <label className="text-xs text-gray-600">Generated comment preview</label>
              <textarea
                value={commentModalText}
                onChange={(e) => setCommentModalText(e.target.value)}
                className="w-full h-40 p-3 border rounded text-sm mt-2"
              />
              <div className="text-xs text-gray-500 mt-2">Edit jika perlu, lalu tekan Save untuk menyimpan ke DB (baris akan terupdate langsung).</div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t">
              <button className="px-3 py-1 rounded bg-gray-200 text-sm" onClick={() => { setCommentModalOpen(false); setCommentModalIndex(null); }}>Cancel</button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                onClick={saveCommentFromModal}
                disabled={commentModalPending}
              >
                {commentModalPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
