"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";
import { formatBytes, formatDate } from "./filesUtils";

function isImageFile(file) {
  return String(file?.type || "").startsWith("image/");
}

function isPdfFile(file) {
  const t = String(file?.type || "").toLowerCase();
  return t === "application/pdf" || String(file?.name || "").toLowerCase().endsWith(".pdf");
}

function buildPreviewEntries(files) {
  return files.map((file) => ({
    file,
    url: isImageFile(file) || isPdfFile(file) ? URL.createObjectURL(file) : null,
  }));
}

function revokePreviewEntries(entries) {
  for (const entry of entries) {
    if (entry?.url) URL.revokeObjectURL(entry.url);
  }
}

export default function FilesFolderClient() {
  const params = useParams();
  const folderId = String(params?.folderId || "").trim();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const previewEntriesRef = useRef(null);

  const currentYear = new Date().getFullYear();
  const yearFromUrl = searchParams.get("year");
  const initialYear = (() => {
    if (!yearFromUrl) return currentYear;
    const parsed = parseInt(yearFromUrl, 10);
    return Number.isNaN(parsed) ? currentYear : parsed;
  })();

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [folder, setFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [previewEntries, setPreviewEntries] = useState(null);

  const role = String(session?.user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "reviewer";
  const currentUserId = session?.user?.id || session?.user?.email || "";
  const isLegacyFolder = folder?.isLegacy === true;

  const yearQuery = `?year=${encodeURIComponent(String(selectedYear))}`;
  const filesListUrl = `/api/files?year=${encodeURIComponent(String(selectedYear))}&folderId=${encodeURIComponent(folderId)}`;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/Page/auth");
    }
  }, [status, router]);

  useEffect(() => {
    const raw = searchParams.get("year");
    const cy = new Date().getFullYear();
    if (raw == null || raw === "") {
      setSelectedYear((prev) => (prev !== cy ? cy : prev));
      return;
    }
    const p = parseInt(raw, 10);
    if (!Number.isNaN(p)) setSelectedYear((prev) => (prev !== p ? p : prev));
  }, [searchParams]);

  const loadFiles = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    try {
      const res = await fetch(filesListUrl, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        if (res.status === 404) {
          toast.show("Folder not found.", "error");
          router.replace(`/Page/files${yearQuery}`);
          return;
        }
        toast.show(json.error || `Failed to load files (${res.status})`, "error");
        setFiles([]);
        setFolder(null);
        return;
      }
      setFolder(json.folder || null);
      setFiles(Array.isArray(json.files) ? json.files : []);
    } catch (e) {
      toast.show(e?.message || "Failed to load files", "error");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [filesListUrl, folderId, router, toast, yearQuery]);

  useEffect(() => {
    if (status !== "authenticated" || !folderId) return;
    loadFiles();
  }, [status, folderId, loadFiles]);

  const clearFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closePreviewModal = useCallback(() => {
    setPreviewEntries((prev) => {
      if (prev) revokePreviewEntries(prev);
      return null;
    });
    clearFileInput();
  }, []);

  previewEntriesRef.current = previewEntries;

  useEffect(() => {
    return () => {
      if (previewEntriesRef.current) revokePreviewEntries(previewEntriesRef.current);
    };
  }, []);

  const handleFileInputChange = (e) => {
    if (isLegacyFolder) {
      toast.show("Create a new folder to upload files.", "error");
      clearFileInput();
      return;
    }
    const list = e.target.files;
    if (!list?.length) return;

    setPreviewEntries((prev) => {
      if (prev) revokePreviewEntries(prev);
      return buildPreviewEntries(Array.from(list));
    });
  };

  const uploadPendingFiles = async () => {
    if (!previewEntries?.length) return;

    setUploading(true);
    let okCount = 0;
    const files = previewEntries.map((e) => e.file);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("year", String(selectedYear));
        form.append("folderId", folderId);
        form.append("file", file);
        const res = await fetch("/api/files", { method: "POST", body: form });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          toast.show(json.error || `Upload failed: ${file.name}`, "error");
          continue;
        }
        okCount += 1;
      }
      if (okCount > 0) {
        toast.show(`${okCount} file(s) uploaded.`, "success");
        await loadFiles();
      }
      closePreviewModal();
    } catch (err) {
      toast.show(err?.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!file?.id) return;
    const ok = window.confirm(`Delete "${file.originalName}"?`);
    if (!ok) return;

    setDeletingId(file.id);
    try {
      const res = await fetch(
        `/api/files?year=${encodeURIComponent(String(selectedYear))}&folderId=${encodeURIComponent(folderId)}&id=${encodeURIComponent(file.id)}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.show(json.error || "Delete failed", "error");
        return;
      }
      toast.show("File deleted.", "success");
      await loadFiles();
    } catch (err) {
      toast.show(err?.message || "Delete failed", "error");
    } finally {
      setDeletingId("");
    }
  };

  const canDelete = (file) => {
    if (isAdmin) return true;
    const owner = file?.uploadedBy?.id || file?.uploadedBy?.email || "";
    return String(owner) === String(currentUserId);
  };

  const folderTitle = folder?.name || "Folder";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/Page/files${yearQuery}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <span aria-hidden="true">←</span>
            <span>Back to folders</span>
          </Link>
        </div>

        <header className="mb-6">
          <div className="bg-gradient-to-r from-[#141D38] to-[#1a2747] rounded-2xl shadow-xl p-4 sm:p-6 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2">
                <Image
                  src="/images/kias-logo.webp"
                  width={64}
                  height={64}
                  alt="KIAS logo"
                  className="drop-shadow-lg"
                  priority
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{folderTitle}</h1>
                <p className="text-blue-200 text-sm">
                  {selectedYear}
                  {isLegacyFolder ? " · read-only (legacy uploads)" : " · upload files below"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {!isLegacyFolder && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Upload files</h2>
                <p className="text-sm text-slate-500 mt-1">
                  PDF, Office, ZIP, images, CSV (max 100 MB per file).
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload file(s)"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Files
              <span className="ml-2 text-sm font-normal text-slate-500">({files.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              {isLegacyFolder
                ? "No legacy files in this folder."
                : "No files yet. Use Upload file(s) above."}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-slate-50/80"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{file.originalName}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                      {file.uploadedBy?.name ? ` · ${file.uploadedBy.name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <a
                      href={`/api/files/download?year=${encodeURIComponent(String(selectedYear))}&folderId=${encodeURIComponent(folderId)}&id=${encodeURIComponent(file.id)}`}
                      className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-[#141D38] bg-blue-50 hover:bg-blue-100 border border-blue-100"
                    >
                      Download
                    </a>
                    {canDelete(file) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file)}
                        disabled={deletingId === file.id}
                        className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 disabled:opacity-60"
                      >
                        {deletingId === file.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {previewEntries?.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-upload-preview-title"
          >
            <div className="px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 id="file-upload-preview-title" className="text-lg font-bold text-slate-900">
                Preview before upload
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {previewEntries.length} file{previewEntries.length > 1 ? "s" : ""} selected
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
              {previewEntries.map((entry, idx) => (
                <div
                  key={`${entry.file.name}-${entry.file.size}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-slate-100 bg-white">
                    <p className="text-sm font-semibold text-slate-800 truncate">{entry.file.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(entry.file.size)}</p>
                  </div>
                  <div className="p-3 flex items-center justify-center min-h-[120px] max-h-[280px] bg-white">
                    {entry.url && isImageFile(entry.file) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.url}
                        alt={entry.file.name}
                        className="max-h-[260px] max-w-full object-contain rounded"
                      />
                    ) : entry.url && isPdfFile(entry.file) ? (
                      <iframe
                        title={entry.file.name}
                        src={entry.url}
                        className="w-full h-[240px] rounded border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="text-center py-6 px-4">
                        <div className="text-4xl mb-2" aria-hidden="true">
                          📄
                        </div>
                        <p className="text-xs text-slate-500">No preview for this file type</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0 bg-white">
              <button
                type="button"
                onClick={closePreviewModal}
                disabled={uploading}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={uploadPendingFiles}
                disabled={uploading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white text-sm font-semibold hover:shadow-md disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
