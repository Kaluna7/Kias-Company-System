import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Pencil, X, Trash2 } from "lucide-react";
import { compareCode } from "@/app/utils/compareCode";

export default function DataTableAudit({
  data = [],
  isPlanningMode = false,
  isMoveToDraftMode = false,
  isDeleteMode = false,
  isEditMode = false,
  viewDraft = false,
  sortBy = "risk_id_no",
  sortDir = "asc",
  onChangeSort,
  onMoveToDraft,
  onDelete,
  onDeleteAp,
  onEditAp,
  departmentApi,
}) {
  const [deleting, setDeleting] = useState({});
  const bodyRef = useRef(null);
  const headerScrollRef = useRef(null);
  const xScrollRef = useRef(null);
  const hBarRef = useRef(null);
  const tableRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1000);
  const scrollSyncLock = useRef(false);

  const syncHorizontalScroll = useCallback((source) => {
    if (scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    const left =
      source === "bar"
        ? (hBarRef.current?.scrollLeft ?? 0)
        : source === "header"
          ? (headerScrollRef.current?.scrollLeft ?? 0)
          : (xScrollRef.current?.scrollLeft ?? 0);
    if (xScrollRef.current) xScrollRef.current.scrollLeft = left;
    if (hBarRef.current) hBarRef.current.scrollLeft = left;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = left;
    requestAnimationFrame(() => {
      scrollSyncLock.current = false;
    });
  }, []);

  const handleSort = (field) => {
    if (!onChangeSort) return;
    if (sortBy === field) {
      onChangeSort(field, sortDir === "asc" ? "desc" : "asc");
    } else {
      onChangeSort(field, "asc");
    }
  };

  const sortIndicator = (field) => {
    if (sortBy !== field) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const arr = [...data];

    arr.sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      const va = a?.[sortBy];
      const vb = b?.[sortBy];

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      if (typeof va === "number" && typeof vb === "number") {
        return va === vb ? 0 : va < vb ? -1 * dir : 1 * dir;
      }

      // For dotted codes like A.2.1.10 or A.2.1.2.1, do segment-aware compare
      if (sortBy === "risk_id_no" || sortBy === "ap_code") {
        const cmp = compareCode(va, vb);
        return cmp === 0 ? 0 : cmp * dir;
      }

      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa === sb) return 0;
      return sa < sb ? -1 * dir : 1 * dir;
    });

    return arr;
  }, [data, sortBy, sortDir]);
  // Group data by risk_id supaya bagian kiri (risk) tidak berulang
  const grouped = useMemo(() => {
    if (!Array.isArray(sortedData) || sortedData.length === 0) return [];

    const map = new Map();

    sortedData.forEach((row) => {
      const key = row.risk_id ?? row.risk_id_no ?? "__no_risk__";
      if (!map.has(key)) {
        map.set(key, {
          risk: {
            risk_id: row.risk_id,
            risk_id_no: row.risk_id_no,
            risk_description: row.risk_description,
            risk_details: row.risk_details,
            owners: row.owners,
          },
          aps: [],
        });
      }
      map.get(key).aps.push(row);
    });

    return Array.from(map.values()).map((group) => {
      group.aps.sort((a, b) => compareCode(a?.ap_code, b?.ap_code));
      const hasRealAp = group.aps.some((ap) => ap.ap_id != null);
      if (hasRealAp) {
        group.aps = group.aps.filter((ap) => ap.ap_id != null);
      }
      return group;
    });
  }, [sortedData]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const updateWidth = () => setTableScrollWidth(table.scrollWidth);
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(table);
    window.addEventListener("resize", updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [grouped, isPlanningMode, isMoveToDraftMode, isDeleteMode, isEditMode]);

  const headerThClass =
    "px-3 py-2 border border-gray-200 text-center align-top bg-gray-50";

  const showActionCol =
    isPlanningMode || isMoveToDraftMode || isDeleteMode || isEditMode;

  const tableClassName =
    "min-w-[1280px] w-full border-separate border-spacing-0 text-xs sm:text-sm text-gray-700";
  const tableStyle = { tableLayout: "fixed" };

  const tableColGroup = (
    <colgroup>
      <col style={{ width: 48 }} />
      <col style={{ width: 100 }} />
      <col style={{ width: 180 }} />
      <col style={{ width: 200 }} />
      <col style={{ width: 100 }} />
      <col style={{ width: 100 }} />
      <col style={{ width: 130 }} />
      <col style={{ width: 150 }} />
      <col style={{ width: 200 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 150 }} />
      <col style={{ width: 120 }} />
      {showActionCol && <col style={{ width: 130 }} />}
    </colgroup>
  );

  const tableHeader = (
    <thead>
      <tr className="bg-gray-50 text-gray-700 font-semibold">
        <th
          rowSpan={2}
          className={`${headerThClass} cursor-pointer select-none`}
          onClick={() => handleSort("risk_id")}
        >
          No{sortIndicator("risk_id")}
        </th>
        <th rowSpan={2} className={headerThClass}>
          Risk ID No.
        </th>
        <th rowSpan={2} className={headerThClass}>
          Risk Description
        </th>
        <th rowSpan={2} className={headerThClass}>
          Risk Details
        </th>
        <th rowSpan={2} className={headerThClass}>
          Owner
        </th>
        <th colSpan={4} className={headerThClass}>
          Audit Program
        </th>
        <th colSpan={3} className={headerThClass}>
          Sampling
        </th>
        {showActionCol && (
          <th rowSpan={2} className={headerThClass}>
            Action
          </th>
        )}
      </tr>
      <tr className="bg-gray-50 text-gray-700 font-semibold">
        <th
          className={`${headerThClass} cursor-pointer select-none`}
          onClick={() => handleSort("ap_code")}
        >
          AP Code{sortIndicator("ap_code")}
        </th>
        <th
          className={`${headerThClass} cursor-pointer select-none`}
          onClick={() => handleSort("substantive_test")}
        >
          Substantive Test{sortIndicator("substantive_test")}
        </th>
        <th className={headerThClass}>Objective</th>
        <th className={headerThClass}>Procedures</th>
        <th className={headerThClass}>Method</th>
        <th className={headerThClass}>Description</th>
        <th className={headerThClass}>Application</th>
      </tr>
    </thead>
  );

  return (
    <div className="w-full h-full min-h-0 flex flex-col p-2 sm:p-4 relative">
      {/* Close button di pojok kanan atas */}
      {(isPlanningMode || isMoveToDraftMode || isDeleteMode || isEditMode) && (
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("close-planning-mode")
            );
          }}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-lg transition-colors duration-150"
          title="Close Mode"
          aria-label="Close Mode"
        >
          <X size={16} />
        </button>
      )}
      <div className="md:hidden mb-2 px-1">
        <div className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-2 py-1">
          Geser tabel ke samping untuk melihat semua kolom.
        </div>
      </div>
      <div
        className="flex flex-col flex-1 min-h-0 rounded-2xl shadow-sm border border-gray-200 bg-white overflow-hidden"
        style={{ maxHeight: "calc(100dvh - 7.5rem)" }}
      >
        <div
          ref={headerScrollRef}
          className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-gray-200 bg-gray-50 shadow-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onScroll={() => syncHorizontalScroll("header")}
        >
          <table className={tableClassName} style={tableStyle}>
            {tableColGroup}
            {tableHeader}
          </table>
        </div>

        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div
            ref={xScrollRef}
            className="overflow-x-auto overflow-y-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onScroll={() => syncHorizontalScroll("content")}
          >
            <table ref={tableRef} className={tableClassName} style={tableStyle}>
              {tableColGroup}
              <tbody>
            {grouped.length > 0 ? (
              grouped.map((group, groupIndex) => {
                const { risk, aps } = group;
                const rowSpan = Math.max(aps.length, 1);

                return aps.map((ap, apIndex) => (
                  <tr
                    key={ap.ap_id ? `${risk.risk_id}-${ap.ap_id}` : `${risk.risk_id}-${apIndex}`}
                    className={`${groupIndex % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition`}
                  >
                    {/* Kolom risk (kiri) hanya ditampilkan di baris pertama per risk */}
                    {apIndex === 0 && (
                      <>
                        <td
                          rowSpan={rowSpan}
                          className="px-3 py-2 border border-gray-200 text-center align-top"
                        >
                          {groupIndex + 1}
                        </td>
                        <td
                          rowSpan={rowSpan}
                          className="px-3 py-2 border border-gray-200 text-center align-top"
                        >
                          {risk.risk_id_no}
                        </td>
                        <td
                          rowSpan={rowSpan}
                          className="px-3 py-2 border border-gray-200 align-top break-words whitespace-pre-wrap"
                          style={{ maxWidth: "250px" }}
                        >
                          {risk.risk_description}
                        </td>
                        <td
                          rowSpan={rowSpan}
                          className="px-3 py-2 border border-gray-200 align-top break-words whitespace-pre-wrap"
                          style={{ maxWidth: "300px" }}
                        >
                          {risk.risk_details}
                        </td>
                        <td
                          rowSpan={rowSpan}
                          className="px-3 py-2 border border-gray-200 align-top break-words"
                          style={{ maxWidth: "150px" }}
                        >
                          {risk.owners}
                        </td>
                      </>
                    )}

                    {/* AUDIT PROGRAM */}
                    <td className="px-3 py-2 border border-gray-200 break-words align-top">{ap.ap_code}</td>
                    <td className="px-3 py-2 border border-gray-200 break-words align-top" style={{ maxWidth: "180px" }}>{ap.substantive_test}</td>
                    <td className="px-3 py-2 border border-gray-200 break-words whitespace-pre-wrap align-top" style={{ maxWidth: "250px" }}>{ap.objective}</td>
                    <td className="px-3 py-2 border border-gray-200 break-words whitespace-pre-wrap align-top" style={{ maxWidth: "300px" }}>{ap.procedures}</td>

                    {/* SAMPLING */}
                    <td className="px-3 py-2 border border-gray-200 break-words align-top" style={{ maxWidth: "180px" }}>{ap.method}</td>
                    <td className="px-3 py-2 border border-gray-200 break-words whitespace-pre-wrap align-top" style={{ maxWidth: "250px" }}>
                      {ap.description ?? ap.sampling_description}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 break-words align-top" style={{ maxWidth: "180px" }}>{ap.application}</td>

                    {/* ACTION: hanya muncul 1x per risk (rowSpan) */}
                    {(isPlanningMode || isMoveToDraftMode) && apIndex === 0 && (
                      <td
                        rowSpan={rowSpan}
                        className="px-3 py-2 border border-gray-200 text-center align-top"
                      >
                        <div className="flex flex-col items-center gap-2">
                          {/* Add AP button - hanya muncul saat New Planning mode */}
                          {isPlanningMode && (
                            <button
                              onClick={() =>
                                window.dispatchEvent(
                                  new CustomEvent("open-modal", { detail: { name: "add-ap", row: aps[0] } })
                                )
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-xs font-medium shadow-sm transition-colors duration-150"
                              title={`Add Audit Program for ${risk.risk_id_no}`}
                              aria-label={`Add Audit Program for ${risk.risk_id_no}`}
                            >
                              <Pencil size={14} />
                              <span>Add AP</span>
                            </button>
                          )}

                          {/* Move to Draft/Publish button */}
                          {isMoveToDraftMode && onMoveToDraft && (
                            <button
                              type="button"
                              onClick={() => onMoveToDraft(risk.risk_id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 text-xs font-medium shadow-sm transition-colors duration-150"
                            >
                              <span>{viewDraft ? "Move to Publish" : "Move to Draft"}</span>
                            </button>
                          )}

                        </div>
                      </td>
                    )}

                    {isDeleteMode && apIndex === 0 && (
                      <td
                        rowSpan={rowSpan}
                        className="px-3 py-2 border border-gray-200 text-center align-top"
                      >
                        <div className="flex flex-col items-center gap-2">
                          {aps
                            .filter((apItem) => apItem.ap_id)
                            .map((apItem) => {
                              const deleteKey = `ap-${departmentApi}-${apItem.ap_id}`;
                              return (
                                <button
                                  key={apItem.ap_id}
                                  type="button"
                                  onClick={() => {
                                    const label = apItem.ap_code || "this AP";
                                    if (
                                      confirm(
                                        `Delete ${label}? AP codes after it will be renumbered automatically.`
                                      )
                                    ) {
                                      setDeleting((prev) => ({ ...prev, [deleteKey]: true }));
                                      onDeleteAp?.(apItem, departmentApi).finally(() => {
                                        setDeleting((prev) => {
                                          const next = { ...prev };
                                          delete next[deleteKey];
                                          return next;
                                        });
                                      });
                                    }
                                  }}
                                  disabled={!onDeleteAp || !departmentApi || deleting[deleteKey]}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={`Delete AP ${apItem.ap_code || ""}`}
                                >
                                  <Trash2 size={14} />
                                  <span>{deleting[deleteKey] ? "Deleting..." : `Delete ${apItem.ap_code || "AP"}`}</span>
                                </button>
                              );
                            })}
                          {aps.every((apItem) => !apItem.ap_id) && onDelete && departmentApi && (
                            <button
                              type="button"
                              onClick={() => {
                                const deleteKey = `risk-${departmentApi}-${risk.risk_id}`;
                                if (
                                  confirm(
                                    `Delete entire draft risk ${risk.risk_id_no} and all its APs?`
                                  )
                                ) {
                                  setDeleting((prev) => ({ ...prev, [deleteKey]: true }));
                                  onDelete(risk.risk_id, departmentApi).finally(() => {
                                    setDeleting((prev) => {
                                      const next = { ...prev };
                                      delete next[deleteKey];
                                      return next;
                                    });
                                  });
                                }
                              }}
                              disabled={deleting[`risk-${departmentApi}-${risk.risk_id}`]}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Delete draft risk ${risk.risk_id_no}`}
                            >
                              <Trash2 size={14} />
                              <span>
                                {deleting[`risk-${departmentApi}-${risk.risk_id}`]
                                  ? "Deleting..."
                                  : "Delete Risk"}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    {isEditMode && (
                      <td className="px-3 py-2 border border-gray-200 text-center align-top">
                        {ap.ap_id ? (
                          <button
                            type="button"
                            onClick={() => onEditAp?.(ap)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-xs font-medium shadow-sm transition-colors duration-150"
                            title={`Edit AP ${ap.ap_code || ""}`}
                          >
                            <Pencil size={14} />
                            <span>Edit AP</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ));
              })
            ) : (
              <tr>
                <td colSpan={(isPlanningMode || isMoveToDraftMode || isDeleteMode || isEditMode) ? 14 : 13} className="text-center py-6 text-gray-500 border border-gray-200">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
          </div>
        </div>
        <div
          ref={hBarRef}
          className="shrink-0 overflow-x-auto overflow-y-hidden border-t border-gray-200 bg-gray-50"
          onScroll={() => syncHorizontalScroll("bar")}
          aria-label="Scroll table horizontally"
        >
          <div style={{ width: tableScrollWidth, height: 14 }} />
        </div>
      </div>
    </div>
  );
}
