"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";
import { formatDate } from "./filesUtils";

export default function FilesClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const currentYear = new Date().getFullYear();
  const yearFromUrl = searchParams.get("year");
  const initialYear = (() => {
    if (!yearFromUrl) return currentYear;
    const parsed = parseInt(yearFromUrl, 10);
    return Number.isNaN(parsed) ? currentYear : parsed;
  })();

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [folders, setFolders] = useState([]);
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const yearOptions = useMemo(() => {
    const base = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    const merged = [...new Set([...availableYears, ...base, selectedYear])];
    return merged.sort((a, b) => b - a);
  }, [availableYears, currentYear, selectedYear]);

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

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/folders?year=${encodeURIComponent(String(selectedYear))}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.show(json.error || `Failed to load folders (${res.status})`, "error");
        setFolders([]);
        return;
      }
      setFolders(Array.isArray(json.folders) ? json.folders : []);
      if (Array.isArray(json.availableYears) && json.availableYears.length > 0) {
        setAvailableYears(json.availableYears);
      }
    } catch (e) {
      toast.show(e?.message || "Failed to load folders", "error");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, toast]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadFolders();
  }, [status, loadFolders]);

  const handleYearChange = (nextYear) => {
    setSelectedYear(nextYear);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("year", String(nextYear));
      router.replace(url.pathname + url.search);
    } catch {
      // ignore
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.show("Enter a folder name.", "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/files/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear, name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.show(json.error || "Could not create folder", "error");
        return;
      }
      toast.show(`Folder "${json.folder?.name || name}" created.`, "success");
      setShowCreateModal(false);
      setNewFolderName("");
      await loadFolders();
      if (json.folder?.id) {
        router.push(
          `/Page/files/${encodeURIComponent(json.folder.id)}?year=${encodeURIComponent(String(selectedYear))}`,
        );
      }
    } catch (err) {
      toast.show(err?.message || "Could not create folder", "error");
    } finally {
      setCreating(false);
    }
  };

  const yearQuery = `?year=${encodeURIComponent(String(selectedYear))}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/Page/dashboard${yearQuery}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </Link>
        </div>

        <header className="mb-6">
          <div className="bg-gradient-to-r from-[#141D38] to-[#1a2747] rounded-2xl shadow-xl p-4 sm:p-6 border border-slate-700/50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2">
                  <Image
                    src="/images/kias-logo.webp"
                    width={72}
                    height={72}
                    alt="KIAS logo"
                    className="drop-shadow-lg"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Files</h1>
                  <p className="text-blue-200 text-sm">Organize documents in folders by audit year</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-100 font-medium">Year</span>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="bg-white/10 border border-white/30 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200/70"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y} className="text-slate-900 bg-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Folders — {selectedYear}</h2>
              <p className="text-sm text-slate-500 mt-1">
                Create a folder first, then open it to upload PDF, Office, ZIP, images, or CSV (max 100 MB per file).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white text-sm font-semibold shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create folder
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">
              Folders for {selectedYear}
              <span className="ml-2 text-sm font-normal text-slate-500">({folders.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No folders for {selectedYear}. Click <strong>Create folder</strong> to get started.
            </div>
          ) : (
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <Link
                  key={folder.id}
                  href={`/Page/files/${encodeURIComponent(folder.id)}${yearQuery}`}
                  className="group block rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate group-hover:text-[#141D38]">
                        {folder.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {folder.fileCount ?? 0} file{(folder.fileCount ?? 0) === 1 ? "" : "s"}
                        {folder.createdAt ? ` · ${formatDate(folder.createdAt)}` : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Create folder</h3>
            <p className="text-sm text-slate-500 mb-4">Year {selectedYear}</p>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Folder name</label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder="e.g. Audit evidence Q1"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/60 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFolderName("");
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-[#141D38] text-white text-sm font-semibold hover:bg-[#1a2747] disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
