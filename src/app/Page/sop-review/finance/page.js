// pages/Page/sop-review/finance.js
"use client";

import { useState } from "react";
import SmallHeader from "@/app/components/layout/SmallHeader";
import SOPSidebar from "@/app/components/layout/Sop-Review/Sidebar-Sop";

export default function FinanceSopReview() {
  const [preparerStatus, setPreparerStatus] = useState("DRAFT");
  const [reviewerStatus, setReviewerStatus] = useState("DRAFT");
  const [sopData, setSopData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const reindex = (list) => list.map((item, idx) => ({ ...item, no: idx + 1 }));

  const handleSopParsed = (parsedSops) => {
    if (!Array.isArray(parsedSops) || parsedSops.length === 0) return;

    setSopData((prev) => {
      const existingTitles = new Set(prev.map((p) => (p.sop_related || "").trim().toLowerCase()));
      const newItems = parsedSops
        .map((it) => ({
          sop_related: (it.sop_related || it.name || "").trim(),
          status: "DRAFT",
          comment: "",
          reviewer: ""
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
      const payload = preparePayload(sopData);
      const res = await fetch("/api/SopReview/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = json?.error || json?.message || `HTTP ${res.status}`;
        setSaveMessage({ type: "error", text: `Gagal menyimpan: ${errMsg}` });
        console.error("Save error:", json);
      } else {
        setSaveMessage({ type: "success", text: `Berhasil menyimpan ${json.inserted?.length ?? sopData.length} SOP.` });
        // optionally clear table:
        // setSopData([]);
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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mb-10">
        <SmallHeader label="Finance SOP Review" />
      </div>

      <div className="flex flex-col lg:flex-row mt-6 justify-between gap-20 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="lg:w-80">
          <SOPSidebar
            department="Finance"
            sopStatus="Available"
            preparerStatus={preparerStatus}
            reviewerStatus={reviewerStatus}
            onPreparerStatusChange={setPreparerStatus}
            onReviewerStatusChange={setReviewerStatus}
            onSopParsed={handleSopParsed}
          />
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">SOP Review List</h2>
              <p className="text-sm text-gray-600 mt-1">Manage and review Standard Operating Procedures</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveAllToServer}
                disabled={sopData.length === 0 || isSaving}
                className={`px-3 py-2 rounded-lg text-sm shadow-sm ${sopData.length === 0 || isSaving ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-blue-600 text-white"}`}
              >
                {isSaving ? "Saving..." : "Save All"}
              </button>
            </div>
          </div>

          {saveMessage && (
            <div className={`px-6 py-3 ${saveMessage.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {saveMessage.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gradient-to-r from-gray-800 to-black">
                <tr>
                  <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-12">No</th>
                  <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">SOP Related</th>
                  <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-28">Status</th>
                  <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Comment Review</th>
                  <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-32">Reviewer</th>
                  <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sopData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors duration-150 align-top">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{row.no}</td>

                    <td className="px-4 py-4">
                      <textarea
                        value={row.sop_related}
                        onChange={(e) => updateRow(idx, { sop_related: e.target.value })}
                        className="w-full resize-none border border-gray-200 rounded-md p-2 text-sm"
                        rows={2}
                      />
                    </td>

                    <td className="px-4 py-4">
                      <select
                        value={row.status || ""}
                        onChange={(e) => updateRow(idx, { status: e.target.value })}
                        className={`w-full px-2 py-1 rounded-md text-sm ${getStatusBadge(row.status)}`}
                      >
                        <option value="">Not set</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="IN REVIEW">IN REVIEW</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      <input
                        value={row.comment}
                        onChange={(e) => updateRow(idx, { comment: e.target.value })}
                        className="w-full border border-gray-200 rounded-md p-2 text-sm"
                        placeholder="Reviewer comment..."
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        value={row.reviewer}
                        onChange={(e) => updateRow(idx, { reviewer: e.target.value })}
                        className="w-full border border-gray-200 rounded-md p-2 text-sm"
                        placeholder="Reviewer username..."
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => removeRow(idx)}
                          title="Hapus"
                          className="px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-md text-sm"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {sopData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                      No SOPs yet. Upload a PDF to extract SOP items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
