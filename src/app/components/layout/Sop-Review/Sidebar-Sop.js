"use client";

import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { useToast } from "@/app/contexts/ToastContext";

/* ========== Helpers ========== */

async function ensureWorkerAvailable() {
  // Use worker that matches the installed pdfjs-dist version (5.4.530)
  // Priority 1: Use unpkg CDN with exact version 5.4.530
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
    pdfjsLib.GlobalWorkerOptions.disableWorker = false;
    // Verify worker is accessible
    const test = await fetch(pdfjsLib.GlobalWorkerOptions.workerSrc, { method: "HEAD" }).catch(() => null);
    if (test && test.ok) {
      return true;
    }
  } catch (e) {
    console.warn("Failed to load worker from unpkg:", e);
  }
  
  // Priority 2: Try jsdelivr CDN with version 5.4.530
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
    pdfjsLib.GlobalWorkerOptions.disableWorker = false;
    return true;
  } catch (e) {
    console.warn("Failed to load worker from jsdelivr:", e);
  }
  
  // Priority 3: Try local worker file (may be outdated)
  try {
    const local = "/pdf.worker.min.js";
    const r = await fetch(local, { method: "HEAD" }).catch(() => null);
    if (r && r.ok) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = local;
      pdfjsLib.GlobalWorkerOptions.disableWorker = false;
      console.warn("Using local worker file - ensure it matches version 5.4.530");
      return true;
    }
  } catch (e) {
    console.warn("Failed to load local worker:", e);
  }
  
  // Last resort: disable worker
  console.error("All worker sources failed, disabling worker. PDF parsing may be slower.");
  pdfjsLib.GlobalWorkerOptions.disableWorker = true;
  return false;
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

const MAX_PDF_SIZE_MOBILE_BYTES = 4 * 1024 * 1024;

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  if (w > 0 && w <= 768) return true;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
}

/* ========== Component ========== */

export default function SOPSidebar({
  department = "Finance",
  apiPath = "finance",
  sopStatus = "AVAILABLE",
  preparerStatus,
  reviewerStatus,
  onPreparerStatusChange,
  onReviewerStatusChange,
  preparerName = "",
  preparerDate = "",
  reviewerComment = "",
  reviewerName = "",
  reviewerDate = "",
  onPreparerNameChange,
  onPreparerDateChange,
  onReviewerCommentChange,
  onReviewerNameChange,
  onReviewerDateChange,
  onSaveSidebar,
  onSopParsed,
}) {
  const toast = useToast();
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
    const data = new Uint8Array(arrayBuffer);
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
      const res = await fetch(`/api/SopReview/${apiPath}/generate-comments-preview`, {
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
      toast.show("Only PDF files are allowed.", "error");
      return;
    }

    const mobile = isMobileDevice();
    if (mobile && file.size > MAX_PDF_SIZE_MOBILE_BYTES) {
      toast.show("File too large for mobile (max 4MB). Use a smaller PDF or upload from desktop.", "error");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setParsing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const fullText = await extractFullTextFromPdfArrayBuffer(arrayBuffer);
      const previewText = fullText || "";
      setFullTextPreview(mobile && previewText.length > 30000 ? previewText.slice(0, 30000) + "\n\n[... truncated for mobile ...]" : previewText);

      await new Promise((r) => setTimeout(r, 0));

      const base64 = await arrayBufferToBase64UsingFileReader(arrayBuffer);

      const aiRes = await callAiExtract({ data: base64, text: fullText });

      if (aiRes && aiRes.success && Array.isArray(aiRes.steps) && aiRes.steps.length > 0) {
        const normalized = aiRes.steps.map((s, idx) => {
          const raw = (s.text || s.instruction || (typeof s === "string" ? s : "") || "").toString();
          const clean = sanitizeStepText(raw);
          return {
            no: (typeof s.step === "number" ? s.step : idx + 1),
            sop_related: clean,
            // Default status for freshly parsed items: IN REVIEW
            status: "IN REVIEW",
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
          setParseError("AI did not return structured steps — using the local parser as a fallback. Please review the results before saving.");
        } else {
          setParseError("AI did not return steps and the local parser failed. Toggle raw text preview to tune the prompt.");
        }
      }
    } catch (err) {
      console.error("Error processing PDF:", err);
      setParseError("Failed to read PDF: " + (err?.message || String(err)));
    } finally {
      setParsing(false);
      setAiInProgress(false);
    }
  };

  /* ---------- Modal + Append flow ---------- */
  // Open modal and fetch preview comments for current parsedPreview
  const openAppendModal = async () => {
    if (!parsedPreview || parsedPreview.length === 0) {
      toast.show("No parsed results to append.", "error");
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
      setModalError("Failed to generate comments automatically — you can type comments manually before saving.");
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
      // Default status when appending from sidebar modal: IN REVIEW
      status: "IN REVIEW",
      comment: (it.comment || "").toString().trim(),
      reviewer: ""
    }));
    onSopParsed?.(prepared);
    setModalOpen(false);
    setModalItems([]);
    // No alerts — keep UX quiet and consistent
  };

  /* ---------- UI ---------- */

  const getStatusColor = (status) => {
    switch (status) {
      case "APPROVED":
        return "bg-gradient-to-r from-green-500 to-green-600 text-white border-green-500 shadow-lg";
      case "REJECTED":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-500 shadow-lg";
      case "IN REVIEW":
        return "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg";
      case "AVAILABLE":
        return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-500 shadow-lg";
      default:
        return "bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-500 shadow-lg";
    }
  };

  return (
    <aside className="bg-gradient-to-br from-white via-slate-50 to-blue-50 w-96 p-6 rounded-2xl shadow-2xl border border-slate-200/50 backdrop-blur-sm space-y-6 text-sm">
      {/* Header Section */}
      <div className="text-center pb-4 border-b border-slate-200/60">
        <h2 className="text-lg font-bold text-slate-800 mb-1">SOP Source & Status</h2>
        <p className="text-xs text-slate-600">Manage department information, SOP status, documents, and team details</p>
      </div>

      <div className="space-y-6">
        {/* Department & SOP Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">🏢</span>
              </div>
              <span className="text-white/90 text-xs font-medium uppercase tracking-wide">Department</span>
            </div>
            <div className="text-white font-bold text-sm">{department}</div>
          </div>

          <div className={`p-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 ${getStatusColor(sopStatus)}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-current/20 rounded-full flex items-center justify-center">
                <span className="text-current text-xs font-bold">
                  {sopStatus === 'AVAILABLE' ? '✅' : sopStatus === 'IN REVIEW' ? '🔄' : '📋'}
                </span>
              </div>
              <span className="text-current text-xs font-medium uppercase tracking-wide">SOP Status</span>
            </div>
            <div className="text-current font-bold text-sm">{sopStatus}</div>
          </div>
        </div>
      </div>

      {/* SOP Document Section */}
      <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-slate-200/60 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">📋</span>
          </div>
          <span className="font-semibold text-slate-800">SOP Document</span>
        </div>

        <div className={`border-2 border-dashed rounded-xl p-6 transition-all duration-300 ${
          selectedFile
            ? 'border-green-300 bg-green-50/50'
            : parsing
              ? 'border-blue-300 bg-blue-50/50'
              : 'border-slate-300 bg-slate-50/80 hover:border-blue-400 hover:bg-blue-50/30'
        }`}>
          <label htmlFor="pdfUpload" className="cursor-pointer flex flex-col items-center text-center space-y-3 w-full">
            <div className={`text-4xl transition-transform duration-300 ${parsing ? 'animate-spin' : 'hover:scale-110'}`}>
              {parsing ? "⏳" : selectedFile ? "📄" : "📤"}
            </div>
            <div className="text-sm">
              {selectedFile ? (
                <div className="space-y-1">
                  <div className="font-semibold text-green-700">{selectedFile.name}</div>
                  <div className="text-xs text-slate-500">File selected successfully</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-medium text-slate-700">{parsing ? "Processing document..." : "Choose PDF file"}</div>
                  <div className="text-xs text-slate-500">Maximum 20MB • PDF format only</div>
                </div>
              )}
            </div>
            <input id="pdfUpload" type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
          </label>

          {parsing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-blue-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              Processing PDF content...
            </div>
          )}

          {parseError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              ⚠️ {parseError}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setShowRaw(s => !s)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              {showRaw ? 'Hide' : 'Show'} Raw Text
            </button>
            <button
              onClick={openAppendModal}
              disabled={parsing || aiInProgress}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                parsing || aiInProgress
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-sm"
              }`}
            >
              {aiInProgress ? "AI Processing..." : "📝 Append Parsed"}
            </button>
          </div>

          {parsedPreview.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50/50 border border-blue-200/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-blue-800">📋 Parsed Preview</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {parsedPreview.length} items
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto">
                <ol className="list-decimal list-inside text-xs space-y-1 text-slate-700">
                  {parsedPreview.map((p, i) => (
                    <li key={i} className="leading-relaxed">{p.sop_related || p.text}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {showRaw && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-700">📄 Raw Text Preview</span>
              </div>
              <textarea
                readOnly
                value={fullTextPreview.slice(0, 300000)}
                className="w-full h-32 p-3 text-xs border border-slate-200 rounded-lg bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Raw text content will appear here..."
              />
              <div className="text-xs text-slate-500 mt-2">
                💡 If AI parsing fails, copy 600-1200 characters from the procedure section above for prompt tuning.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preparer Section */}
      <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-slate-200/60 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">👤</span>
          </div>
          <span className="font-semibold text-slate-800">Preparer</span>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            preparerStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
            preparerStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
            preparerStatus === 'IN REVIEW' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {preparerStatus}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Status</label>
            <select
              className="w-full border border-slate-200 bg-white px-3 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={preparerStatus}
              onChange={(e) => onPreparerStatusChange?.(e.target.value)}
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Preparer Name</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Enter preparer name..."
                value={preparerName}
                onChange={(e) => onPreparerNameChange?.(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={preparerDate}
                onChange={(e) => onPreparerDateChange?.(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reviewer Section */}
      <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-slate-200/60 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">🔍</span>
          </div>
          <span className="font-semibold text-slate-800">Reviewer</span>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            reviewerStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
            reviewerStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
            reviewerStatus === 'IN REVIEW' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {reviewerStatus}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Comment</label>
            <textarea
              className="w-full h-24 border border-slate-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
              placeholder="Enter reviewer comments..."
              value={reviewerComment}
              onChange={(e) => onReviewerCommentChange?.(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">SOP Review Status</label>
            <select
              className="w-full border border-slate-200 bg-white px-3 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              value={reviewerStatus}
              onChange={(e) => onReviewerStatusChange?.(e.target.value)}
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reviewer Name</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="Enter reviewer name..."
                value={reviewerName}
                onChange={(e) => onReviewerNameChange?.(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                value={reviewerDate}
                onChange={(e) => onReviewerDateChange?.(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6">
        <button
          onClick={async () => {
            try {
              const payload = {
                department_name: department,
                sop_status: sopStatus,
                preparer_status: preparerStatus,
                preparer_name: preparerName || null,
                preparer_date: preparerDate || null,
                reviewer_status: reviewerStatus,
                reviewer_name: reviewerName || null,
                reviewer_date: reviewerDate || null,
                reviewer_comment: reviewerComment || null,
              };
              const res = await fetch(`/api/SopReview/${apiPath}/meta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok) {
                toast.show("Data saved successfully.", "success");
                onSaveSidebar?.(payload);
              } else {
                toast.show("Failed to save: " + (json?.error || "Unknown error"), "error");
              }
            } catch (err) {
              console.error("Save sidebar error:", err);
              toast.show("Failed to save sidebar data.", "error");
            }
          }}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          💾 Save Changes
        </button>
      </div>

      {/* Modal: preview comments - padding on mobile so popup not full-bleed / hidden on Android */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-3 pt-1 pb-4 sm:p-0 sm:px-4">
          <div className="bg-white rounded-2xl shadow-lg sm:shadow-2xl w-full sm:w-[min(1000px,95vw)] max-h-[82vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-base sm:text-lg">📝</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">Review Comments Preview</h3>
                  <p className="text-xs text-slate-600 hidden sm:block">Review and edit generated comments before appending</p>
                </div>
              </div>
              <button
                className="min-h-[44px] min-w-[44px] sm:w-8 sm:h-8 sm:min-h-0 sm:min-w-0 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors flex-shrink-0"
                onClick={() => { setModalOpen(false); setModalItems([]); setModalError(""); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 max-h-[calc(82vh-160px)] sm:max-h-[calc(90vh-140px)] overscroll-contain">
              {modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-slate-600">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <span className="text-sm font-medium">Generating AI comments... Please wait</span>
                  </div>
                </div>
              ) : (
                <>
                  {modalError && (
                    <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      ⚠️ {modalError}
                    </div>
                  )}
                  <div className="space-y-3 sm:space-y-4">
                    {modalItems.map((it, idx) => (
                      <div key={idx} className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 sm:mb-3">
                          <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {it.no}
                          </span>
                          <span className="text-sm font-semibold text-slate-700">SOP Item</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:p-3 mb-2 sm:mb-3">
                          <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
                            {it.sop_related}
                          </div>
                        </div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">💬 Review Comment (Editable)</label>
                        <textarea
                          className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[72px]"
                          rows={3}
                          value={it.comment || ""}
                          onChange={(e) => setModalItemComment(idx, e.target.value)}
                          placeholder="Enter or edit the review comment..."
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <button
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                onClick={() => { setModalOpen(false); setModalItems([]); setModalError(""); }}
              >
                Cancel
              </button>
              <button
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={saveAndAppendFromModal}
                disabled={modalLoading}
              >
                ✅ Save & Append
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
