"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/contexts/ToastContext";
import { canEditReviewerFields as canEditReviewerFieldsFromRole } from "@/lib/canEditReviewerFields";
import { flushSync } from "react-dom";
import LoadingProgressOverlay, {
  preloadLoadingAnimation,
} from "@/app/components/shared/LoadingProgressOverlay";
import { isVisionOnlyExtractMode } from "@/app/lib/sopExtractMode";
import { processSopPdfWithProgress } from "@/app/utils/processSopPdfWithProgress";
import { runSimulatedProgress } from "@/app/utils/simulatedLoadingProgress";
import {
  localParseProcedureSteps,
  sanitizeStepText,
} from "@/app/utils/sopProcedureText";

const MAX_PDF_SIZE_MOBILE_BYTES = 4 * 1024 * 1024;
/** UI preview only — AI always receives the full extracted text */
const RAW_PREVIEW_DISPLAY_MAX = 500000;

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
  const { data: session } = useSession();
  const canEditReviewer = canEditReviewerFieldsFromRole(session?.user?.role);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedPreview, setParsedPreview] = useState([]);
  const [fullTextPreview, setFullTextPreview] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [aiInProgress, setAiInProgress] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatusLabel, setLoadStatusLabel] = useState("");
  const [modalLoadProgress, setModalLoadProgress] = useState(0);

  // Modal state for preview comments
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalItems, setModalItems] = useState([]); // { no, sop_related, comment }

  const statusOptions = ["DRAFT", "IN REVIEW", "APPROVED", "REJECTED"];

  useEffect(() => {
    preloadLoadingAnimation();
  }, []);

  useEffect(() => {
    if (!modalLoading) return;
    return runSimulatedProgress(setModalLoadProgress, true, { start: 12, max: 88 });
  }, [modalLoading]);

  const appendParsedToTable = () => {
    if (!parsedPreview?.length) {
      toast.show("No parsed results to append.", "error");
      return;
    }

    const prepared = parsedPreview.map((p, idx) => ({
      no: idx + 1,
      sop_related: (p.sop_related || "").toString().trim(),
      status: "IN REVIEW",
      comment: "",
      reviewer: "",
    }));
    onSopParsed?.(prepared);
    setParsedPreview([]);
    setParseError("");
    toast.show(
      `${prepared.length} langkah masuk ke tabel. Klik Generate Comment untuk isi Review Comment (AI).`,
      "success",
    );
  };

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

    flushSync(() => {
      setSelectedFile(file);
      setParsing(true);
      setAiInProgress(true);
      setLoadProgress(2);
      setLoadStatusLabel("Memproses dokumen...");
      setParseError("");
    });

    try {
      const { mapAiStepsToPreview, formatAiExtractDebug } = await import(
        "@/app/utils/sopExtractStepsClient"
      );
      const aiRes = await processSopPdfWithProgress(file, {
        onProgress: ({ progress, statusLabel }) => {
          setLoadProgress(progress);
          setLoadStatusLabel(statusLabel);
        },
      });
      const visionMode =
        aiRes?.extractMode === "vision" || isVisionOnlyExtractMode();
      console.info("[SOP PDF] mode:", visionMode ? "vision_only" : "pipeline", aiRes);

      const merged = aiRes?.mergedText || "";
      setFullTextPreview(
        merged ||
          (visionMode
            ? `[Mode GPT Vision] ${aiRes?.visionPageCount ?? "?"} halaman dikirim ke model.`
            : "")
      );

      if (!visionMode && (!merged || merged.trim().length < 30)) {
        setParseError(
          "Teks PDF kosong setelah parser + OCR. Pastikan PDF valid atau coba ulang."
        );
        return;
      }

      const normalized =
        aiRes?.success && Array.isArray(aiRes.steps)
          ? mapAiStepsToPreview(aiRes.steps, sanitizeStepText)
          : [];

      if (normalized.length > 0) {
        setParsedPreview(normalized);
        setParseError("");
        if (visionMode) {
          toast.show(
            `GPT Vision: ${normalized.length} langkah (uji, tanpa parser lokal).`,
            "success"
          );
        }
      } else {
        console.warn("AI extract-steps failed or empty:", aiRes);
        const apiErr = formatAiExtractDebug(aiRes);
        if (visionMode) {
          setParseError(
            apiErr ||
              "GPT Vision tidak mengembalikan langkah. Cek log [KIAS AI][sop-vision] di server."
          );
          return;
        }
        const local = localParseProcedureSteps(merged);
        if (local && local.length > 0) {
          setParsedPreview(local);
          setParseError(
            apiErr
              ? `${apiErr} — parser lokal dipakai sebagai cadangan. Periksa hasil sebelum menyimpan.`
              : "AI tidak mengembalikan langkah — parser lokal dipakai. Periksa hasil sebelum menyimpan."
          );
        } else {
          setParseError(
            apiErr ||
              "AI dan parser lokal gagal. Buka pratinjau teks mentah. Cek /api/Ai/health di server."
          );
        }
      }
    } catch (err) {
      console.error("Error processing PDF:", err);
      setParseError("Failed to read PDF: " + (err?.message || String(err)));
    } finally {
      setParsing(false);
      setAiInProgress(false);
      setLoadProgress(100);
      setTimeout(() => {
        setLoadProgress(0);
        setLoadStatusLabel("");
      }, 400);
    }
  };

  /* ---------- Modal + Append flow ---------- */
  // Open modal and fetch preview comments for current parsedPreview
  const openAppendModal = () => {
    if (!parsedPreview || parsedPreview.length === 0) {
      toast.show("No parsed results to append.", "error");
      return;
    }
    setModalError("");
    setModalItems(
      parsedPreview.map((p, idx) => ({
        no: idx + 1,
        sop_related: p.sop_related,
        comment: (p.comment || "").toString().trim(),
      })),
    );
    setModalOpen(true);
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

    const prepared = modalItems.map((it, idx) => ({
      no: idx + 1,
      sop_related: (it.sop_related || "").toString().trim(),
      status: "IN REVIEW",
      comment: (it.comment || "").toString().trim(),
      reviewer: "",
    }));
    onSopParsed?.(prepared);
    setModalOpen(false);
    setModalItems([]);
    setParsedPreview([]);
    toast.show(
      `${prepared.length} baris masuk ke tabel. Klik Generate Comment untuk isi Review Comment (AI).`,
      "success",
    );
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

  const showPdfOverlay = parsing || aiInProgress;

  return (
    <aside className="bg-gradient-to-br from-white via-slate-50 to-blue-50 w-96 p-6 rounded-2xl shadow-2xl border border-slate-200/50 backdrop-blur-sm space-y-6 text-sm">
      <LoadingProgressOverlay
        open={showPdfOverlay}
        progress={loadProgress}
        title="Memproses dokumen SOP"
        statusLabel={loadStatusLabel}
        fileName={selectedFile?.name || ""}
      />
      <LoadingProgressOverlay
        open={modalLoading}
        progress={modalLoadProgress}
        title="Menghasilkan komentar review (OpenAI)"
        statusLabel="OpenAI sedang menganalisis langkah SOP..."
        subtitle=""
      />
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
          <label
            htmlFor="pdfUpload"
            className="cursor-pointer flex flex-col items-center text-center space-y-3 w-full"
            onClick={() => preloadLoadingAnimation()}
          >
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
              type="button"
              onClick={appendParsedToTable}
              disabled={parsing || aiInProgress}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                parsing || aiInProgress
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-sm"
              }`}
            >
              {aiInProgress
                ? "AI Processing..."
                : "📝 Append ke Tabel"}
            </button>
            <button
              type="button"
              onClick={openAppendModal}
              disabled={parsing || aiInProgress}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Pratinjau
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
                value={
                  fullTextPreview.length > RAW_PREVIEW_DISPLAY_MAX
                    ? fullTextPreview.slice(0, RAW_PREVIEW_DISPLAY_MAX) +
                      `\n\n[... tampilan UI dibatasi ${RAW_PREVIEW_DISPLAY_MAX} karakter; total ekstrak: ${fullTextPreview.length} — data lengkap tetap dikirim ke AI ...]`
                    : fullTextPreview
                }
                className="w-full h-48 p-3 text-xs border border-slate-200 rounded-lg bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Raw text content will appear here..."
              />
              <div className="text-xs text-slate-500 mt-2">
                Total karakter diekstrak dari PDF: {fullTextPreview.length.toLocaleString()} (tanpa batas untuk AI).
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
              className="w-full h-24 border border-slate-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter reviewer comments..."
              value={reviewerComment}
              onChange={(e) => onReviewerCommentChange?.(e.target.value)}
              disabled={!canEditReviewer}
              title={!canEditReviewer ? "Only admin or reviewer can edit Reviewer comments" : undefined}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">SOP Review Status</label>
            <select
              className="w-full border border-slate-200 bg-white px-3 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={reviewerStatus}
              onChange={(e) => onReviewerStatusChange?.(e.target.value)}
              disabled={!canEditReviewer}
              title={!canEditReviewer ? "Only admin or reviewer can edit Reviewer status" : undefined}
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reviewer Name</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter reviewer name..."
                value={reviewerName}
                onChange={(e) => onReviewerNameChange?.(e.target.value)}
                disabled={!canEditReviewer}
                title={!canEditReviewer ? "Only admin or reviewer can edit Reviewer name" : undefined}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={reviewerDate}
                onChange={(e) => onReviewerDateChange?.(e.target.value)}
                disabled={!canEditReviewer}
                title={!canEditReviewer ? "Only admin or reviewer can edit Reviewer date" : undefined}
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
                  <p className="text-xs text-slate-600 hidden sm:block">Edit langkah, Save & Append, lalu Generate Comment di tabel</p>
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
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  Memproses di latar belakang…
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
                          placeholder="Komentar untuk SOP Description di atas..."
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
