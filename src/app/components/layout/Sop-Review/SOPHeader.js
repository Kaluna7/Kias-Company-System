"use client";

import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { useToast } from "@/app/contexts/ToastContext";

/* ========== Helpers ========== */

async function ensureWorkerAvailable() {
  // Use worker that matches the installed pdfjs-dist version (5.4.530)
  // The actual installed version is 5.4.530, not 5.4.394 from package.json
  // We need to use worker version 5.4.530 to match the library
  
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
  
  // Priority 3: Try local worker file (may be outdated, but worth trying)
  try {
    const local = "/pdf.worker.min.js";
    const r = await fetch(local, { method: "HEAD" }).catch(() => null);
    if (r && r.ok) {
      // Only use local if CDN fails, as it may be outdated
      pdfjsLib.GlobalWorkerOptions.workerSrc = local;
      pdfjsLib.GlobalWorkerOptions.disableWorker = false;
      console.warn("Using local worker file - ensure it matches version 5.4.530");
      return true;
    }
  } catch (e) {
    console.warn("Failed to load local worker:", e);
  }
  
  // Last resort: disable worker (may cause performance issues)
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

/* ========== SOP Header Component ========== */

export default function SOPHeader({
  department = "Finance",
  apiPath = "finance",
  sopStatus = "AVAILABLE",
  preparerStatus,
  reviewerStatus,
  onPreparerStatusChange,
  onReviewerStatusChange,
  onSopStatusChange,
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
  onPublish,
  isPublishing = false,
  saveMessage,
  sopDataCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  isReviewer = false,
  isAdmin = false,
  isUser = false,
  schedulePreparerName = "",
  schedulePreparerDate = ""
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

  // Add item popup state
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [newItemSopRelated, setNewItemSopRelated] = useState("");
  const [newItemComment, setNewItemComment] = useState("");
  const [addItemError, setAddItemError] = useState("");

  // Delete confirmation popup state (for modal items)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);

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
  // This calls the API endpoint that uses Gemini AI to generate review comments
  // The prompt for Gemini is located in: src/app/api/SopReview/_shared/generate-comments-preview.js
  // Function: buildSinglePromptStrict() - lines 60-74
  async function callGenerateCommentsPreview(items) {
    try {
      console.log(`Calling generate-comments-preview API for ${items.length} items`);
      const res = await fetch(`/api/SopReview/${apiPath}/generate-comments-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      
      if (!res.ok) {
        console.error("API response not OK:", res.status, res.statusText);
        return { success: false, error: `API error: ${res.status} ${res.statusText}` };
      }
      
      const json = await res.json().catch(() => ({}));
      console.log("API response received:", json);
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
          const aiComment = (s.comment || s.reviewer_comment || "").toString().trim();
          return {
            no: (typeof s.step === "number" ? s.step : idx + 1),
            sop_related: clean,
            // Default status for freshly parsed items: IN REVIEW
            status: "IN REVIEW",
            comment: aiComment,
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
  // Open modal WITHOUT generating comments - user will click "Generate Comment" button
  const openAppendModal = () => {
    if (!parsedPreview || parsedPreview.length === 0) {
      toast.show("No parsed results to append.", "error");
      return;
    }
    
    console.log("Opening append modal with", parsedPreview.length, "items");
    setModalError("");
    setModalLoading(false);
    setModalOpen(true);

    // Keep parsed comments if AI extractor already returned them.
    // User can still regenerate/overwrite via "Generate Comment".
    const items = parsedPreview.map((p, idx) => ({ 
      no: idx + 1, 
      sop_related: p.sop_related, 
      comment: (p.comment || "").toString().trim(),
    }));
    setModalItems(items);
    console.log("Modal opened with items (no comments yet):", items.length);
  };

  // Generate comments for all items in modal
  const handleGenerateComments = async () => {
    if (!modalItems || modalItems.length === 0) {
      setModalError("There are no items to generate comments for.");
      return;
    }

    setModalError("");
    setModalLoading(true);

    // build items for API (id null since not in DB yet)
    const items = modalItems.map(it => ({ id: null, sop_related: it.sop_related }));
    console.log("Generating comments for", items.length, "items");

    try {
      const res = await callGenerateCommentsPreview(items);
      console.log("Generate comments preview response:", res);
      
      if (res && res.success && Array.isArray(res.comments)) {
        // merge comments into modal items (keep original order)
        const byText = new Map(res.comments.map(c => [ (c.sop_related||"").trim().toLowerCase(), c.comment || "" ]));
        const merged = modalItems.map((it, idx) => {
          const key = (it.sop_related || "").trim().toLowerCase();
          const comment = byText.has(key) ? byText.get(key) : (res.comments[idx]?.comment || "");
          return { ...it, comment: comment || "" };
        });
        setModalItems(merged);
        setModalLoading(false);
        console.log("Comments generated successfully:", merged.length);
      } else {
        console.warn("Preview endpoint failed or returned nothing:", res);
        setModalError("Failed to generate comments automatically — you can type comments manually before saving.");
        setModalLoading(false);
      }
    } catch (err) {
      console.error("Error in handleGenerateComments:", err);
      setModalError("An error occurred while generating comments: " + (err?.message || String(err)));
      setModalLoading(false);
    }
  };

  // Open add item popup
  const handleAddItem = () => {
    setNewItemSopRelated("");
    setNewItemComment("");
    setAddItemError("");
    setAddItemModalOpen(true);
  };

  // Save new item from popup
  const handleSaveNewItem = () => {
    if (!newItemSopRelated || !newItemSopRelated.trim()) {
      setAddItemError("SOP description cannot be empty.");
      return;
    }
    setModalItems(prev => {
      const newNo = prev.length > 0 ? Math.max(...prev.map(it => it.no || 0)) + 1 : 1;
      return [...prev, { no: newNo, sop_related: newItemSopRelated.trim(), comment: newItemComment.trim() }];
    });
    setAddItemModalOpen(false);
    setNewItemSopRelated("");
    setNewItemComment("");
    setAddItemError("");
  };

  // Remove item from modal
  const handleRemoveItem = (index) => {
    setDeleteConfirmIndex(index);
    setDeleteConfirmOpen(true);
  };

  const confirmRemoveItem = () => {
    if (deleteConfirmIndex == null) {
      setDeleteConfirmOpen(false);
      return;
    }
    setModalItems(prev => {
      const updated = prev.filter((_, idx) => idx !== deleteConfirmIndex);
      return updated.map((it, idx) => ({ ...it, no: idx + 1 }));
    });
    setDeleteConfirmOpen(false);
    setDeleteConfirmIndex(null);
  };

  // Edit sop_related inside modal
  const setModalItemSopRelated = (index, newSopRelated) => {
    setModalItems(prev => {
      const copy = prev.map(it => ({ ...it }));
      copy[index] = { ...copy[index], sop_related: newSopRelated };
      return copy;
    });
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
      // Default status for appended items from header modal: IN REVIEW
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
    <>
      {/* Single toggle button fixed at top-right corner of header */}
      <div className="fixed z-40 top-3 right-4">
        <button
          onClick={onToggleCollapse}
          className="w-11 h-9 flex items-center justify-center rounded-full shadow-md border border-slate-300 bg-white/95 text-sm font-semibold text-slate-700"
          title={isCollapsed ? "Tampilkan header" : "Sembunyikan header"}
          suppressHydrationWarning
        >
          {isCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Main Header: scrollable when too tall on responsive */}
      <header className={`fixed top-0 left-0 right-0 z-30 bg-gradient-to-br from-white via-slate-50/95 to-blue-50/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain ${
        isCollapsed ? '-translate-y-full opacity-0 invisible' : 'translate-y-0 opacity-100 visible'
      }`}
        style={{ transition: 'none' }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Compact Header Section - Enhanced */}
          <div className={`px-6 py-4 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex items-center justify-between">
              {/* Left Side - Title with Icon */}
              <div className="flex items-center gap-4">
                {/* Icon Badge */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
                      SOP REVIEW
                    </h1>
                    <span className="px-2.5 py-0.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                      {department.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">
                    Manage and review Standard Operating Procedures
                  </p>
                </div>
              </div>

              {/* Right Side - Status message */}
              <div className={`flex items-center justify-end gap-2 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                {saveMessage && (
                  <div className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-md ${
                    saveMessage.type === "error"
                      ? "bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200"
                      : "bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 border border-green-200"
                  }`}>
                    {saveMessage.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section - Preparer & Reviewer (height natural; header is scrollable when long) */}
          <div className={`px-6 py-4 bg-gradient-to-b from-white/40 via-white/30 to-transparent border-t border-slate-200/40 overflow-visible ${
            isCollapsed ? 'max-h-0 py-0 opacity-0 overflow-hidden' : 'opacity-100'
          }`}
            style={{ transition: 'none' }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preparer Section - Enhanced Card */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-md">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800">Preparer</h3>
                    <select
                      className="mt-1 w-full px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={preparerStatus}
                      onChange={(e) => onPreparerStatusChange?.(e.target.value)}
                      // Admin and reviewer cannot change header; only preparer/user may
                      disabled={isReviewer || isAdmin}
                      suppressHydrationWarning
                    >
                      {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Name"
                      value={preparerName}
                      onChange={(e) => onPreparerNameChange?.(e.target.value)}
                      // Admin and reviewer cannot change header; user can, respecting schedule lock
                      disabled={isReviewer || isAdmin || (isUser && schedulePreparerName)}
                      readOnly={isUser && schedulePreparerName}
                      suppressHydrationWarning
                    />
                    <input
                      type="date"
                      className="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={preparerDate || ""}
                      onChange={(e) => {
                        // Prevent change if schedule per module has start_date and user is regular user
                        if (schedulePreparerDate && isUser) {
                          console.warn(`[SOP Header] Cannot change preparer date - it's set from schedule per module: ${schedulePreparerDate}`);
                          e.preventDefault();
                          e.stopPropagation();
                          return false; // Ignore the change
                        }
                        onPreparerDateChange?.(e.target.value);
                      }}
                      // Admin and reviewer cannot change preparer date; user only, and not if schedule locked
                      disabled={isReviewer || isAdmin || schedulePreparerDate}
                      readOnly={schedulePreparerDate}
                      title={schedulePreparerDate ? `Date is set from schedule per module: ${schedulePreparerDate}. Cannot be changed.` : ""}
                      suppressHydrationWarning
                    />
                  </div>

                  {/* PDF Upload - Enhanced */}
                  <div className="space-y-2">
                    <label className={`relative block ${isReviewer ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        // Reviewer cannot upload; user and admin can upload & parse
                        disabled={isReviewer}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-md ${
                        parsing 
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400" 
                          : isReviewer
                          ? "bg-gradient-to-r from-gray-200 to-gray-100 text-gray-500 border border-gray-300"
                          : "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border border-slate-300 hover:from-slate-200 hover:to-slate-100"
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        {parsing ? "Processing PDF..." : "Choose PDF file"}
                      </div>
                    </label>
                    {parsedPreview.length > 0 && (
                      <button
                        onClick={openAppendModal}
                        disabled={aiInProgress}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-md ${
                          aiInProgress
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        {aiInProgress ? "AI Processing..." : `Append ${parsedPreview.length} Item(s)`}
                      </button>
                    )}
                    {parsedPreview.length > 0 && (
                      <div className="p-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{parsedPreview.length} item(s) ready. Click “Append” to open the preview.</span>
                      </div>
                    )}
                    {parseError && (
                      <div className="p-2 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{parseError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reviewer Section - Enhanced Card */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-md">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800">Reviewer</h3>
                    <select
                      className="mt-1 w-full px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={reviewerStatus}
                      onChange={(e) => onReviewerStatusChange?.(e.target.value)}
                      disabled={isAdmin || isUser}
                      suppressHydrationWarning
                    >
                      {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Name"
                      value={reviewerName}
                      onChange={(e) => onReviewerNameChange?.(e.target.value)}
                      disabled={isAdmin || isUser}
                      readOnly={isUser}
                      suppressHydrationWarning
                    />
                    <input
                      type="date"
                      className="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={reviewerDate}
                      onChange={(e) => onReviewerDateChange?.(e.target.value)}
                      disabled={isAdmin || isUser}
                      suppressHydrationWarning
                      readOnly={isUser}
                    />
                  </div>
                  <textarea
                    className="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows={3}
                    placeholder="Review comments..."
                    value={reviewerComment}
                    onChange={(e) => onReviewerCommentChange?.(e.target.value)}
                    disabled={isAdmin || isUser}
                    readOnly={isUser}
                    suppressHydrationWarning
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal: preview comments - padding on mobile so popup not full-bleed / hidden on Android */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-3 pt-1 pb-4 sm:p-0 sm:px-4">
          <div className="bg-white rounded-2xl shadow-lg sm:shadow-2xl w-full sm:w-[min(1000px,95vw)] max-h-[88vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-base sm:text-lg">📝</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">Review Comments Preview</h3>
                  <p className="text-xs text-slate-600 hidden sm:block">Review and edit generated comments before appending</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAddItem}
                  className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
                  title="Add new SOP item"
                >
                  <span>➕</span>
                  <span>Add SOP Item</span>
                </button>
                {modalItems.length > 0 && (
                  <button
                    onClick={handleGenerateComments}
                    disabled={modalLoading}
                    className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                      modalLoading
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-sm"
                    }`}
                  >
                    {modalLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Generating...
                      </span>
                    ) : (
                      "✨ Generate Comment"
                    )}
                  </button>
                )}
                <button
                  className="min-h-[44px] min-w-[44px] sm:w-8 sm:h-8 sm:min-h-0 sm:min-w-0 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"
                  onClick={() => { setModalOpen(false); setModalItems([]); setModalError(""); }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 max-h-[calc(82vh-160px)] sm:max-h-[calc(90vh-140px)] overscroll-contain">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                    <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full"></div>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-slate-700">
                    <span className="text-base font-semibold">Generating AI Comments...</span>
                    <span className="text-sm text-slate-500">Please wait while Gemini AI generates review comments for all items</span>
                  </div>
                </div>
              ) : (
                <>
                  {modalError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      ⚠️ {modalError}
                    </div>
                  )}
                  {modalItems.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-slate-500 text-sm">No items yet. Please upload a PDF first, or add items manually.</div>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {modalItems.map((it, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm relative">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="absolute top-2 right-2 sm:top-3 sm:right-3 min-h-[36px] min-w-[36px] sm:w-7 sm:h-7 sm:min-h-0 sm:min-w-0 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors"
                            title="Remove this item"
                            aria-label="Remove item"
                          >
                            🗑️
                          </button>
                          <div className="flex items-center gap-2 mb-2 sm:mb-3 pr-10">
                            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {it.no}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">SOP Item</span>
                          </div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            📝 SOP Description
                          </label>
                          <textarea
                            className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-2 sm:mb-3 min-h-[72px]"
                            rows={3}
                            value={it.sop_related || ""}
                            onChange={(e) => setModalItemSopRelated(idx, e.target.value)}
                            placeholder="Enter SOP description..."
                          />
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            💬 Review Comment {it.comment ? "(Generated)" : ""}
                          </label>
                          <textarea
                            className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[72px]"
                            rows={3}
                            value={it.comment || ""}
                            onChange={(e) => setModalItemComment(idx, e.target.value)}
                            placeholder={it.comment ? "Edit comment..." : "Generate or type comment..."}
                          />
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Add Item Popup */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 px-3 pt-1 pb-4 sm:p-0 sm:px-4">
          <div className="bg-white rounded-2xl shadow-lg sm:shadow-2xl w-full sm:w-[min(600px,95vw)] max-h-[82vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-base sm:text-lg">➕</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Add New SOP Item</h3>
                  <p className="text-xs text-slate-600 hidden sm:block">Enter SOP description and optional comment</p>
                </div>
              </div>
              <button
                className="min-h-[44px] min-w-[44px] sm:w-8 sm:h-8 sm:min-h-0 sm:min-w-0 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"
                onClick={() => {
                  setAddItemModalOpen(false);
                  setNewItemSopRelated("");
                  setNewItemComment("");
                }}
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              {addItemError && (
                <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  ⚠️ {addItemError}
                </div>
              )}
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📝 SOP Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[100px]"
                    rows={4}
                    value={newItemSopRelated}
                    onChange={(e) => setNewItemSopRelated(e.target.value)}
                    placeholder="Enter SOP description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    💬 Review Comment (Optional)
                  </label>
                  <textarea
                    className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[80px]"
                    rows={3}
                    value={newItemComment}
                    onChange={(e) => setNewItemComment(e.target.value)}
                    placeholder="Enter review comment (optional)..."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <button
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                onClick={() => {
                  setAddItemModalOpen(false);
                  setNewItemSopRelated("");
                  setNewItemComment("");
                }}
              >
                Cancel
              </button>
              <button
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium transition-colors"
                onClick={handleSaveNewItem}
              >
                ✅ Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 px-3 pt-1 pb-4 sm:p-0 sm:px-4">
          <div className="bg-white rounded-2xl shadow-lg sm:shadow-2xl w-full sm:w-[min(520px,95vw)] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-base sm:text-lg">🗑️</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Remove SOP Item</h3>
                  <p className="text-xs text-slate-600">Are you sure you want to remove this item?</p>
                </div>
              </div>
              <button
                className="min-h-[44px] min-w-[44px] sm:w-8 sm:h-8 sm:min-h-0 sm:min-w-0 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors flex-shrink-0"
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmIndex(null); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="text-sm text-slate-700">
                This action will remove the item from the preview list. You can add it again if needed.
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50">
              <button
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmIndex(null); }}
              >
                No
              </button>
              <button
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium transition-colors"
                onClick={confirmRemoveItem}
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
