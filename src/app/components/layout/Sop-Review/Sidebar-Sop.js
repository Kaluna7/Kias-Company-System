"use client";

import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf"; // pastikan terinstal: pdfjs-dist

/**
 * SOP Sidebar (fixed + comment-preview modal)
 *
 * Flow:
 * - User uploads PDF -> client reconstructs text preview
 * - Client sends base64 PDF to /api/Ai/extract-steps as { data: base64, text: fullText }
 * - Server returns steps -> parsedPreview
 * - User clicks "Append parsed →" -> open modal, call preview endpoint to generate comments for parsedPreview
 * - User can edit comments in modal; click "Save & Append" -> call onSopParsed(parsedWithComments)
 * - Parent will update UI immediately (no refresh)
 */

/* ========== Helpers ========== */

async function ensureWorkerAvailable() {
  try {
    const local = "/pdf.worker.min.js";
    const r = await fetch(local, { method: "HEAD" }).catch(() => null);
    if (r && r.ok) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = local;
      pdfjsLib.GlobalWorkerOptions.disableWorker = false;
      return true;
    }
  } catch (e) {}
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    pdfjsLib.GlobalWorkerOptions.disableWorker = false;
    return true;
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.disableWorker = true;
    return false;
  }
}

// Convert ArrayBuffer -> base64 using Blob + FileReader (safe)
function arrayBufferToBase64UsingFileReader(arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const reader = new FileReader();
      reader.onerror = () => {
        reader.abort();
        reject(new Error("Failed to read blob as data URL."));
      };
      reader.onload = () => {
        try {
          const dataUrl = reader.result || "";
          const comma = dataUrl.indexOf(",");
          const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
          resolve(base64);
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      reject(err);
    }
  });
}

function sanitizeStepText(s) {
  if (!s || typeof s !== "string") return "";
  const withoutComment = s.split(/Comment\s*:/i)[0];
  return withoutComment.replace(/[\{\}]/g, " ").replace(/\s+/g, " ").trim();
}

/* ========== Component ========== */

export default function SOPSidebar({
  department = "Finance",
  sopStatus = "AVAILABLE",
  preparerStatus,
  reviewerStatus,
  onPreparerStatusChange,
  onReviewerStatusChange,
  onSopParsed,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedPreview, setParsedPreview] = useState([]);
  const [fullTextPreview, setFullTextPreview] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [aiInProgress, setAiInProgress] = useState(false);

  // Modal state for preview comments
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalItems, setModalItems] = useState([]); // { no, sop_related, comment }

  const statusOptions = ["DRAFT", "IN REVIEW", "APPROVED", "REJECTED"];

  /* ---------- PDF extraction preview (client-side) ---------- */
  async function extractFullTextFromPdfArrayBuffer(arrayBuffer) {
    await ensureWorkerAvailable();
    const copyBuf = arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer;
    const data = new Uint8Array(copyBuf);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageTexts = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items || [];
      const posItems = items.map((it) => {
        const tr = it.transform || it.transformMatrix || [];
        const x = tr[4] ?? 0;
        const y = tr[5] ?? 0;
        return { str: it.str || "", x, y };
      });
      const linesMap = new Map();
      for (const it of posItems) {
        const key = Math.round((it.y ?? 0) * 10) / 10;
        if (!linesMap.has(key)) linesMap.set(key, []);
        linesMap.get(key).push(it);
      }
      const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
      const lines = sortedYs
        .map((yKey) => {
          const row = linesMap.get(yKey) || [];
          row.sort((a, b) => (a.x || 0) - (b.x || 0));
          return row.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
        })
        .filter(Boolean);
      // merge heuristics
      const merged = [];
      for (let i = 0; i < lines.length; i++) {
        let cur = lines[i];
        if (!cur) continue;
        if (/[-–—]$/.test(cur) && i + 1 < lines.length) {
          lines[i + 1] = (cur.replace(/[-–—]$/, "") + lines[i + 1]).replace(/\s+/g, " ").trim();
        } else if (
          i + 1 < lines.length &&
          /^[a-z0-9]/i.test(lines[i + 1]) &&
          /[a-z0-9]$/i.test(cur) &&
          !/[.!?]$/.test(cur)
        ) {
          lines[i + 1] = (cur + " " + lines[i + 1]).replace(/\s+/g, " ").trim();
        } else {
          merged.push(cur);
        }
      }
      pageTexts.push(merged.join("\n"));
      if (page && typeof page.cleanup === "function") page.cleanup();
    }
    try {
      if (typeof pdf.destroy === "function") pdf.destroy();
      if (typeof loadingTask.destroy === "function") loadingTask.destroy();
    } catch (err) {}
    return pageTexts.join("\n\n---PAGE---\n\n");
  }

  /* ---------- Local parser fallback ---------- */
  function localParseProcedureSteps(fullText) {
    if (!fullText || typeof fullText !== "string") return [];
    let text = fullText.replace(/\u00A0/g, " ").replace(/\t/g, " ").replace(/\u200b/g, "").replace(/\r/g, "\n");
    text = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n");
    let start = -1;
    const m5 = text.match(/\b5\s*\.\s*Prosedur\b/i);
    if (m5) start = text.indexOf(m5[0]) + m5[0].length;
    else {
      const m = text.match(/\bProsedur\b/i);
      if (m) start = text.indexOf(m[0]) + m[0].length;
    }
    if (start < 0) {
      const m1 = text.search(/\n?\s*\b1\s*[\.\)\-:]\s*/);
      start = m1 >= 0 ? m1 : 0;
    }
    let procText = text.slice(start).replace(/^[\s\:\-–—\.]+/, "").trim();
    const endKeywords = ["Catatan", "Dokumen Pendukung", "Dokumen", "Revisi", "Persetujuan", "Lampiran", "Penutup", "Tanda Tangan", "Daftar", "Referensi", "Preparer", "Reviewer"];
    const endRegex = new RegExp("(" + endKeywords.join("|") + ")", "i");
    const endIdx = procText.search(endRegex);
    if (endIdx >= 0) procText = procText.slice(0, endIdx);
    const stepRegex = /(?:^|\b)(\d{1,3}(?:\.\d+)*)\s*[\.\)\-:]\s*([\s\S]*?)(?=(?:\b\d{1,3}(?:\.\d+)*\s*[\.\)\-:])|$)/g;
    const steps = [];
    for (const m of procText.matchAll(stepRegex)) {
      let content = (m[2] || "").replace(/\s+/g, " ").trim();
      if (content) steps.push(sanitizeStepText(content));
    }
    if (steps.length === 0) {
      const lines = procText.split("\n").map((l) => l.trim()).filter(Boolean);
      let current = null;
      for (const ln of lines) {
        const mnum = ln.match(/^\d{1,3}\s*[\.\)\-:]\s*(.*)/);
        if (mnum) {
          if (current) steps.push(sanitizeStepText(current.trim()));
          current = mnum[1] || "";
        } else {
          if (current) current += " " + ln;
          else if (ln.length > 40) steps.push(sanitizeStepText(ln));
        }
      }
      if (current) steps.push(sanitizeStepText(current.trim()));
    }
    const out = [];
    const seen = new Set();
    for (const s of steps) {
      const t = s.replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (t.split(/\s+/).length < 3) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out.map((textVal, idx) => ({ no: idx + 1, sop_related: textVal, status: "", comment: "", reviewer: "" }));
  }

  /* ---------- Call server AI extractor ---------- */
  async function callAiExtract(bodyObj) {
    setAiInProgress(true);
    try {
      const res = await fetch("/api/Ai/extract-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      const json = await res.json().catch(() => ({}));
      setAiInProgress(false);
      return json;
    } catch (err) {
      setAiInProgress(false);
      console.error("AI call error:", err);
      return { success: false, error: String(err) };
    }
  }

  /* ---------- Call comment preview endpoint (batch) ---------- */
  async function callGenerateCommentsPreview(items) {
    try {
      const res = await fetch("/api/SopReview/finance/generate-comments-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => ({}));
      return json;
    } catch (err) {
      console.error("generate-comments-preview error:", err);
      return { success: false, error: String(err) };
    }
  }

  /* ---------- File change handler ---------- */
  const handleFileChange = async (e) => {
    setParseError("");
    setParsedPreview([]);
    setFullTextPreview("");
    setShowRaw(false);

    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Hanya file PDF yang diperbolehkan.");
      return;
    }

    setSelectedFile(file);
    setParsing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      // client-side preview: extract text
      const fullText = await extractFullTextFromPdfArrayBuffer(arrayBuffer);
      setFullTextPreview(fullText || "");

      // convert to base64 (safe)
      const base64 = await arrayBufferToBase64UsingFileReader(arrayBuffer);

      // call server AI to extract steps
      const aiRes = await callAiExtract({ data: base64, text: fullText });

      if (aiRes && aiRes.success && Array.isArray(aiRes.steps) && aiRes.steps.length > 0) {
        const normalized = aiRes.steps.map((s, idx) => {
          const raw = (s.text || s.instruction || (typeof s === "string" ? s : "") || "").toString();
          const clean = sanitizeStepText(raw);
          return {
            no: (typeof s.step === "number" ? s.step : idx + 1),
            sop_related: clean,
            status: "DRAFT",
            comment: "",
            reviewer: "",
          };
        }).filter(it => it.sop_related && it.sop_related.length > 3);

        setParsedPreview(normalized);
        setParseError("");
      } else {
        // fallback: try server diagnostic raw or local parse
        console.warn("AI did not return structured steps:", aiRes);
        const serverRaw = aiRes?.diagnostic?.rawTextPreview || aiRes?.diagnostic?.generatedPreview || aiRes?.diagnostic?.generated;
        const sourceText = serverRaw && serverRaw.length > 50 ? serverRaw : fullText;
        const local = localParseProcedureSteps(sourceText);
        if (local && local.length > 0) {
          setParsedPreview(local);
          setParseError("AI tidak mengembalikan langkah terstruktur — digunakan parser lokal sebagai fallback. Periksa hasil sebelum menyimpan.");
        } else {
          setParseError("AI tidak mengembalikan langkah dan parser lokal gagal. Toggle raw text preview untuk tuning prompt.");
        }
      }
    } catch (err) {
      console.error("Error processing PDF:", err);
      setParseError("Gagal membaca PDF: " + (err?.message || String(err)));
    } finally {
      setParsing(false);
      setAiInProgress(false);
    }
  };

  /* ---------- Modal + Append flow ---------- */
  // Open modal and fetch preview comments for current parsedPreview
  const openAppendModal = async () => {
    if (!parsedPreview || parsedPreview.length === 0) {
      alert("Tidak ada hasil parsing untuk ditambahkan.");
      return;
    }
    setModalError("");
    setModalLoading(true);
    setModalOpen(true);

    // build items minimal for preview (id null since not in DB yet)
    const items = parsedPreview.map(p => ({ id: null, sop_related: p.sop_related }));

    const res = await callGenerateCommentsPreview(items);
    if (res && res.success && Array.isArray(res.comments)) {
      // merge comments into modal items (keep original order)
      const byText = new Map(res.comments.map(c => [ (c.sop_related||"").trim().toLowerCase(), c.comment || "" ]));
      const merged = items.map((it, idx) => {
        const key = (it.sop_related || "").trim().toLowerCase();
        const comment = byText.has(key) ? byText.get(key) : (res.comments[idx]?.comment || "");
        return { no: idx + 1, sop_related: it.sop_related, comment: comment || "" };
      });
      setModalItems(merged);
      setModalLoading(false);
    } else {
      // fallback: try to use generated array if present, else let user edit manually
      console.warn("Preview endpoint failed or returned nothing:", res);
      // create modal items with empty comments
      const fallback = items.map((it, idx) => ({ no: idx + 1, sop_related: it.sop_related, comment: "" }));
      setModalItems(fallback);
      setModalError("Gagal generate komentar otomatis — Anda dapat mengisi komentar secara manual sebelum menyimpan.");
      setModalLoading(false);
    }
  };

  // Edit comment inside modal
  const setModalItemComment = (index, newComment) => {
    setModalItems(prev => {
      const copy = prev.map(it => ({ ...it }));
      copy[index] = { ...copy[index], comment: newComment };
      return copy;
    });
  };

  // Save & Append: close modal and call onSopParsed with items containing comment
  const saveAndAppendFromModal = () => {
    if (!modalItems || modalItems.length === 0) {
      setModalOpen(false);
      return;
    }
    // map to parent shape expected: no, sop_related, status, comment, reviewer
    const prepared = modalItems.map((it, idx) => ({
      no: idx + 1,
      sop_related: (it.sop_related || "").toString().trim(),
      status: "DRAFT",
      comment: (it.comment || "").toString().trim(),
      reviewer: ""
    }));
    onSopParsed?.(prepared);
    setModalOpen(false);
    setModalItems([]);
    alert(`${prepared.length} item ditambahkan ke daftar (dengan komentar).`);
  };

  /* ---------- UI ---------- */

  const getStatusColor = (status) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-200";
      case "IN REVIEW":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  return (
    <aside className="bg-white w-96 p-6 rounded-xl shadow-lg border border-gray-200 space-y-6 text-sm">
      <div className="space-y-4">
        <div>
          <div className="font-semibold text-gray-700 mb-1">DEPARTMENT</div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 font-bold rounded-lg shadow-sm">{department}</div>
        </div>

        <div>
          <div className="font-semibold text-gray-700 mb-1">SOP Status</div>
          <div className={`px-3 py-2 font-bold rounded-lg border-2 ${getStatusColor(sopStatus)}`}>{sopStatus}</div>
        </div>
      </div>

      <div>
        <div className="font-semibold text-gray-700 mb-2">SOP DOCUMENT</div>
        <div className="border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 p-4 rounded-xl flex flex-col items-center justify-center space-y-3">
          <label htmlFor="pdfUpload" className="cursor-pointer flex flex-col items-center text-center space-y-2 w-full">
            <div className="text-blue-500 text-5xl">{parsing ? "⏳" : "📄"}</div>
            <div className="text-sm text-gray-600 mt-1">
              {selectedFile ? <span className="font-medium text-blue-600">{selectedFile.name}</span> : <div><div className="font-medium">{parsing ? "Uploading & processing..." : "Choose PDF file"}</div><div className="text-xs text-gray-500 mt-1">Max. 20MB</div></div>}
            </div>
            <input id="pdfUpload" type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
          </label>

          {parsing && <div className="text-xs text-gray-500">Processing PDF... please wait</div>}
          {parseError && <div className="text-xs text-red-600">{parseError}</div>}

          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowRaw(s => !s)} className="px-2 py-1 bg-gray-100 rounded text-xs">Toggle raw text preview</button>
            <button onClick={openAppendModal} disabled={parsing || aiInProgress} className={`px-2 py-1 rounded text-xs ${parsing || aiInProgress ? "bg-gray-200 text-gray-500" : "bg-green-600 text-white"}`}>{aiInProgress ? "AI..." : "Append parsed →"}</button>
          </div>

          <div className="w-full mt-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Parsed preview ({parsedPreview.length})</div>
            {parsedPreview.length === 0 ? <div className="text-xs text-gray-500">No parsed items yet.</div> :
              <ol className="list-decimal list-inside max-h-40 overflow-auto text-xs space-y-1">
                {parsedPreview.map((p, i) => <li key={i} className="text-gray-800">{p.sop_related || p.text}</li>)}
              </ol>
            }
          </div>

          {showRaw && (
            <div className="w-full mt-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Server / full raw text (truncated)</div>
              <textarea readOnly value={fullTextPreview.slice(0, 300000)} className="w-full h-48 p-2 text-xs border rounded" />
              <div className="text-xs text-gray-500 mt-1">Jika AI gagal, copy ~600–1200 karakter area 'Prosedur' di atas dan kirimkan untuk tuning prompt.</div>
            </div>
          )}
        </div>
      </div>

      {/* Preparer */}
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-gray-800 to-black text-white px-3 py-2 font-semibold rounded-lg">Preparer</div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
          <select className="w-full border border-gray-300 bg-white px-3 py-2 rounded-lg text-sm" value={preparerStatus} onChange={(e) => onPreparerStatusChange?.(e.target.value)}>
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="text-xs">
          <div className="text-gray-700">Preparer:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">Nama Preparer</div>
          <div className="text-gray-700 mt-2">Date:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">DD/MM/YYYY</div>
        </div>
      </div>

      {/* Reviewer */}
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-gray-800 to-black text-white px-3 py-2 font-semibold rounded-lg">Reviewer</div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Comment :</label>
          <textarea className="w-full h-24 border border-gray-300 rounded-lg p-3 text-sm" placeholder="Enter reviewer comment..." />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">SOP Review Status</label>
          <select className="w-full border border-gray-300 bg-white px-3 py-2 rounded-lg text-sm" value={reviewerStatus} onChange={(e) => onReviewerStatusChange?.(e.target.value)}>
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="text-xs">
          <div className="text-gray-700">Reviewer:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">Nama Reviewer</div>
          <div className="text-gray-700 mt-2">Date:</div>
          <div className="bg-gray-100 h-8 rounded-lg flex items-center px-3 text-gray-600">DD/MM/YYYY</div>
        </div>
      </div>

      {/* Modal: preview comments */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[min(900px,95vw)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">Preview the comment before append the comment</h3>
              <button className="text-gray-600" onClick={() => { setModalOpen(false); setModalItems([]); setModalError(""); }}>✕</button>
            </div>

            <div className="p-4">
              {modalLoading ? (
                <div className="text-sm text-gray-600">Generating Comment Review. Please Wait</div>
              ) : (
                <>
                  {modalError && <div className="text-xs text-red-600 mb-2">{modalError}</div>}
                  <div className="space-y-3">
                    {modalItems.map((it, idx) => (
                      <div key={idx} className="border rounded p-3 bg-gray-50">
                        <div className="text-xs text-gray-700 font-medium mb-1"> {it.no}</div>
                        <div className="text-sm text-gray-900 mb-2 whitespace-pre-wrap">{it.sop_related}</div>
                        <label className="text-xs text-gray-600">Komentar (editable)</label>
                        <textarea
                          className="w-full p-2 border rounded text-sm mt-1"
                          rows={2}
                          value={it.comment || ""}
                          onChange={(e) => setModalItemComment(idx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t">
              <button className="px-3 py-1 rounded bg-gray-200 text-sm" onClick={() => { setModalOpen(false); setModalItems([]); setModalError(""); }}>Cancel</button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white text-sm"
                onClick={saveAndAppendFromModal}
                disabled={modalLoading}
              >
                Save & Append
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
