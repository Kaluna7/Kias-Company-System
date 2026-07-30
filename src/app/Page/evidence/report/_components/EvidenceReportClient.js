"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { isSuperAdmin } from "@/lib/roles";
import { buildEvidenceDownloadHref } from "@/lib/evidenceFileUrl";

function parseAttachments(row) {
  let attachments = [];
  if (Array.isArray(row.attachments) && row.attachments.length > 0) {
    attachments = row.attachments;
  } else if (row.file_url || row.attachment) {
    const raw = row.file_url || row.attachment;
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          attachments = parsed
            .filter((item) => item && typeof item.url === "string")
            .map((item) => ({
              url: item.url,
              name: item.name || row.file_name || "",
              uploaded_at: item.uploaded_at || null,
            }));
        }
      } catch {
        attachments = [{ url: raw, name: row.file_name || "", uploaded_at: null }];
      }
    } else {
      attachments = [{ url: raw, name: row.file_name || "", uploaded_at: null }];
    }
  }
  return attachments;
}

export default function EvidenceReportClient({ initialData }) {
  const { data: session } = useSession();
  const canEdit = isSuperAdmin(session?.user?.role);

  const [rows, setRows] = useState(() => initialData || []);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setRows(initialData || []);
  }, [initialData]);

  const groupedData = useMemo(() => {
    const groups = {};

    rows.forEach((row) => {
      const dateKey = row.created_at
        ? new Date(row.created_at).toISOString().split("T")[0]
        : "no-date";
      const groupKey = `${row.department}|||${dateKey}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          department: row.department,
          createdDate: row.created_at ? new Date(row.created_at) : null,
          dateKey,
          preparer: row.preparer || "",
          overallStatus: row.overall_status || "",
          items: [],
        };
      }

      const attachments = parseAttachments(row);
      groups[groupKey].items.push({
        ...row,
        attachments,
      });

      if (row.preparer) groups[groupKey].preparer = row.preparer;
      if (row.overall_status) groups[groupKey].overallStatus = row.overall_status;
    });

    return Object.values(groups).sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      if (a.createdDate && b.createdDate) {
        return b.createdDate - a.createdDate;
      }
      return 0;
    });
  }, [rows]);

  const selectedGroup = useMemo(
    () => groupedData.find((g) => g.groupKey === selectedGroupKey) || null,
    [groupedData, selectedGroupKey]
  );

  const handleView = (group) => {
    setSelectedGroupKey(group.groupKey);
    setViewOpen(true);
    setEditingId(null);
    setEditDraft(null);
    setSaveError("");
  };

  const startEdit = (item) => {
    if (!canEdit || !item?.id) return;
    setSaveError("");
    setEditingId(item.id);
    setEditDraft({
      ap_code: item.ap_code || "",
      substantive_test: item.substantive_test || "",
      preparer: item.preparer || "",
      overall_status: (item.overall_status || "COMPLETE").toUpperCase(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setSaveError("");
  };

  const saveEdit = async () => {
    if (!canEdit || !editingId || !editDraft) return;
    try {
      setIsSaving(true);
      setSaveError("");
      const res = await fetch("/api/evidence/report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ap_code: editDraft.ap_code,
          substantive_test: editDraft.substantive_test,
          preparer: editDraft.preparer,
          overall_status: editDraft.overall_status,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setSaveError(json?.error || `Failed to save (HTTP ${res.status})`);
        return;
      }

      const updated = json.data;
      setRows((prev) =>
        prev.map((r) =>
          Number(r.id) === Number(editingId)
            ? {
                ...r,
                ...updated,
                ap_code: updated.ap_code,
                substantive_test: updated.substantive_test,
                preparer: updated.preparer,
                overall_status: updated.overall_status,
                updated_at: updated.updated_at,
              }
            : r
        )
      );
      setEditingId(null);
      setEditDraft(null);
    } catch (e) {
      setSaveError(e?.message || "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/Page/evidence";
  }, []);

  const closeModal = () => {
    if (isSaving) return;
    setViewOpen(false);
    setSelectedGroupKey(null);
    cancelEdit();
  };

  const downloadFile = useCallback((url, name) => {
    const href = buildEvidenceDownloadHref(url, name);
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = name || "download";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  return (
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#E6F0FA]">
      <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-4 flex flex-col h-full min-w-0">
        <div className="mb-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors text-sm w-full sm:w-auto justify-center sm:justify-start"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700 font-semibold">B3.1 EVIDENCE REPORT</div>
          {canEdit && (
            <div className="text-xs text-slate-500">Super admin: open View Details to edit each item.</div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6 border border-gray-200 min-w-0">
          <div className="mt-4 space-y-4">
            {groupedData.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-600">
                Belum ada data evidence yang disimpan. Silakan save data di evidence department terlebih dahulu.
              </div>
            )}

            {groupedData.map((group, groupIdx) => (
              <div
                key={`${group.department}-${group.dateKey}-${groupIdx}`}
                className="border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                <div className="bg-gradient-to-r from-[#141D38] to-[#1a2744] text-white p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-0">
                        <h3 className="text-base sm:text-lg font-bold break-words">{group.department}</h3>
                        <span className="text-xs sm:text-sm text-blue-200 shrink-0">
                          {group.createdDate
                            ? group.createdDate.toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "No Date"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-x-4 sm:gap-y-2 mt-2 text-xs sm:text-sm">
                        <span className="text-gray-300 min-w-0 break-words">
                          <span className="font-semibold">Preparer:</span> {group.preparer || "-"}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold shrink-0 ${
                            group.overallStatus === "COMPLETE"
                              ? "bg-yellow-500 text-yellow-900"
                              : group.overallStatus === "INCOMPLETE"
                                ? "bg-gray-500 text-gray-900"
                                : "bg-gray-400 text-gray-900"
                          }`}
                        >
                          {group.overallStatus || "-"}
                        </span>
                        <span className="text-gray-300 shrink-0">
                          <span className="font-semibold">Items:</span> {group.items.length}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleView(group)}
                      className="w-full sm:w-auto sm:shrink-0 px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg touch-manipulation"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-1 sm:mx-0 overscroll-x-contain touch-pan-x">
                  <table className="min-w-[480px] w-full text-[11px] sm:text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left font-semibold border border-gray-200">AP Code</th>
                        <th className="p-2 text-left font-semibold border border-gray-200">Substantive Test</th>
                        <th className="p-2 text-left font-semibold border border-gray-200">File Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.slice(0, 5).map((item, idx) => {
                        const files = item.attachments || [];
                        const fileNames =
                          files.length > 0
                            ? files
                                .map((f) => f.name || "")
                                .filter(Boolean)
                                .join(", ")
                            : item.file_name || "-";
                        return (
                          <tr
                            key={`${item.ap_id}-${item.id}-${idx}`}
                            className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                          >
                            <td className="p-2 border border-gray-200 font-medium">{item.ap_code || "-"}</td>
                            <td className="p-2 border border-gray-200 max-w-[40vw] sm:max-w-xs">
                              <div
                                className="line-clamp-2 sm:line-clamp-none sm:truncate"
                                title={item.substantive_test || "-"}
                              >
                                {item.substantive_test || "-"}
                              </div>
                            </td>
                            <td className="p-2 border border-gray-200 max-w-[35vw] sm:max-w-xs">
                              <div className="text-[10px] sm:text-xs text-gray-700 break-words" title={fileNames}>
                                {files.length > 1
                                  ? `${files.length} files: ${fileNames.slice(0, 40)}${fileNames.length > 40 ? "…" : ""}`
                                  : fileNames || "-"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {group.items.length > 5 && (
                        <tr>
                          <td colSpan={4} className="p-2 text-center text-gray-500 italic border border-gray-200">
                            ... and {group.items.length - 5} more items. Click &quot;View Details&quot; to see all.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {viewOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white shadow-lg w-full rounded-t-2xl sm:rounded-lg sm:w-[min(1200px,calc(100vw-2rem))] max-h-[min(100dvh,100vh)] sm:max-h-[90vh] flex flex-col min-h-0 overflow-hidden"
          >
            <div className="sticky top-0 bg-white border-b z-10 shrink-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between px-3 py-3 sm:px-4 sm:py-3 pr-12 sm:pr-4 relative">
                <div className="min-w-0 pr-2">
                  <h3 className="text-base sm:text-xl font-bold text-gray-800 break-words">
                    {selectedGroup.department} - Evidence Details
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                    Created Date:{" "}
                    {selectedGroup.createdDate
                      ? selectedGroup.createdDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "No Date"}{" "}
                    | AP Items: {selectedGroup.items.length} | Total Files:{" "}
                    {selectedGroup.items.reduce((n, it) => n + (it.attachments?.length || 0), 0)}
                    {canEdit ? " | Super admin can edit each row" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="absolute right-2 top-2 sm:static sm:self-start p-2 -m-2 sm:m-0 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 touch-manipulation"
                  onClick={closeModal}
                  aria-label="Close"
                  disabled={isSaving}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-4 overflow-y-auto min-h-0 flex-1">
              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {saveError}
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Preparer</div>
                    <div className="text-sm mt-1">{selectedGroup.preparer || "-"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Overall Status</div>
                    <div className="text-sm mt-1">
                      <span
                        className={`px-2 py-1 rounded font-semibold ${
                          selectedGroup.overallStatus === "COMPLETE"
                            ? "bg-yellow-200 text-yellow-900"
                            : selectedGroup.overallStatus === "INCOMPLETE"
                              ? "bg-gray-200 text-gray-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedGroup.overallStatus || "-"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 text-xs">Total Evidence Items</div>
                    <div className="text-sm mt-1 font-bold text-blue-600">
                      {selectedGroup.items.length} AP(s),{" "}
                      {selectedGroup.items.reduce((n, it) => n + (it.attachments?.length || 0), 0)} file(s)
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0 overscroll-x-contain touch-pan-x">
                <table className="min-w-[640px] w-full border-collapse text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-[#141D38] text-white">
                      <th className="p-2 text-left font-semibold border border-gray-300">AP Code</th>
                      <th className="p-2 text-left font-semibold border border-gray-300">Substantive Test</th>
                      <th className="p-2 text-left font-semibold border border-gray-300">Preparer</th>
                      <th className="p-2 text-left font-semibold border border-gray-300">Overall Status</th>
                      <th className="p-2 text-left font-semibold border border-gray-300">File Name</th>
                      <th className="p-2 text-center font-semibold border border-gray-300">Updated Date</th>
                      <th className="p-2 text-center font-semibold border border-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.items.map((item, idx) => {
                      const files = item.attachments || [];
                      const fileNames =
                        files.length > 0
                          ? files.map((f) => f.name || "").filter(Boolean)
                          : [];
                      const isEditing = canEdit && editingId === item.id;
                      return (
                        <tr
                          key={`${item.ap_id}-${item.id}-${idx}`}
                          className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="p-2 border border-gray-200 font-medium align-top">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft?.ap_code || ""}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, ap_code: e.target.value }))
                                }
                                className="w-full min-w-[80px] rounded border border-slate-300 px-2 py-1 text-xs"
                                disabled={isSaving}
                              />
                            ) : (
                              item.ap_code || "-"
                            )}
                          </td>
                          <td className="p-2 border border-gray-200 align-top">
                            {isEditing ? (
                              <textarea
                                value={editDraft?.substantive_test || ""}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    substantive_test: e.target.value,
                                  }))
                                }
                                rows={3}
                                className="w-full min-w-[160px] rounded border border-slate-300 px-2 py-1 text-xs"
                                disabled={isSaving}
                              />
                            ) : (
                              <div className="max-w-md break-words">{item.substantive_test || "-"}</div>
                            )}
                          </td>
                          <td className="p-2 border border-gray-200 align-top">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editDraft?.preparer || ""}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, preparer: e.target.value }))
                                }
                                className="w-full min-w-[100px] rounded border border-slate-300 px-2 py-1 text-xs"
                                disabled={isSaving}
                              />
                            ) : (
                              item.preparer || "-"
                            )}
                          </td>
                          <td className="p-2 border border-gray-200 align-top">
                            {isEditing ? (
                              <select
                                value={editDraft?.overall_status || "COMPLETE"}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    overall_status: e.target.value,
                                  }))
                                }
                                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                                disabled={isSaving}
                              >
                                <option value="COMPLETE">COMPLETE</option>
                                <option value="INCOMPLETE">INCOMPLETE</option>
                                <option value="IN PROGRESS">IN PROGRESS</option>
                              </select>
                            ) : (
                              item.overall_status || "-"
                            )}
                          </td>
                          <td className="p-2 border border-gray-200 align-top">
                            <div className="text-xs space-y-0.5">
                              {fileNames.length > 0 ? (
                                fileNames.map((name, i) => (
                                  <div key={i} className="text-gray-700">
                                    {name}
                                  </div>
                                ))
                              ) : item.file_name ? (
                                <span className="text-blue-600 font-medium">{item.file_name}</span>
                              ) : (
                                "-"
                              )}
                            </div>
                          </td>
                          <td className="p-2 border border-gray-200 text-center text-[10px] sm:text-xs whitespace-nowrap align-top">
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>
                          <td className="p-2 border border-gray-200 align-top">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {(files.length > 0
                                ? files
                                : item.file_url && !String(item.file_url).trim().startsWith("[")
                                  ? [{ url: item.file_url, name: item.file_name }]
                                  : []
                              ).map(
                                (f, i) =>
                                  f.url && (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => downloadFile(f.url, f.name || item.file_name)}
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs whitespace-nowrap"
                                    >
                                      Download{files.length > 1 ? ` ${i + 1}` : ""}
                                    </button>
                                  )
                              )}
                              {canEdit && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="px-2 py-0.5 rounded bg-[#141D38] text-white text-xs font-semibold hover:bg-[#1a2744]"
                                  disabled={isSaving || (editingId != null && editingId !== item.id)}
                                >
                                  Edit
                                </button>
                              )}
                              {isEditing && (
                                <>
                                  <button
                                    type="button"
                                    onClick={saveEdit}
                                    className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                                    disabled={isSaving}
                                  >
                                    {isSaving ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300"
                                    disabled={isSaving}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedGroup.items.some((item) => (item.attachments?.length || 0) > 0) && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Uploaded Files</h4>
                  <div className="space-y-2">
                    {selectedGroup.items.flatMap((item, itemIdx) =>
                      (item.attachments || []).map((att, attIdx) => (
                        <div
                          key={`file-${item.ap_id}-${itemIdx}-${attIdx}`}
                          className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
                            <svg
                              className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-blue-900 text-xs">
                                AP Code: {item.ap_code || "-"}
                              </div>
                              <div className="text-sm text-gray-700 break-words" title={att.name || ""}>
                                {att.name || "N/A"}
                              </div>
                              {att.url && (
                                <button
                                  type="button"
                                  onClick={() => downloadFile(att.url, att.name || item.file_name)}
                                  className="text-blue-600 hover:underline break-all text-xs block mt-1 text-left"
                                >
                                  {att.name || att.url}
                                </button>
                              )}
                            </div>
                            {att.url && (
                              <button
                                type="button"
                                onClick={() => downloadFile(att.url, att.name || item.file_name)}
                                className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 inline-flex items-center gap-1 flex-shrink-0 touch-manipulation self-stretch sm:self-auto"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t px-3 py-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-stretch sm:justify-end shrink-0">
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg bg-gray-200 text-sm font-medium hover:bg-gray-300 touch-manipulation"
                onClick={closeModal}
                disabled={isSaving}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
