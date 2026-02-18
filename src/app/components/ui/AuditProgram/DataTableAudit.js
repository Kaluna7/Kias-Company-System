import React, { useMemo, useState } from "react";
import { Pencil, X, Trash2 } from "lucide-react";
import { compareCode } from "@/app/utils/compareCode";

export default function DataTableAudit({
  data = [],
  isPlanningMode = false,
  isMoveToDraftMode = false,
  isDeleteMode = false,
  viewDraft = false,
  sortBy = "risk_id_no",
  sortDir = "asc",
  onChangeSort,
  onMoveToDraft,
  onDelete,
  departmentApi,
}) {
  const [deleting, setDeleting] = useState({});
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

    return Array.from(map.values());
  }, [sortedData]);

  return (
    <div className="w-full h-full flex flex-col p-4 relative">
      {/* Close button di pojok kanan atas */}
      {(isPlanningMode || isMoveToDraftMode || isDeleteMode) && (
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("close-planning-mode")
            );
          }}
          className="absolute top-4 right-4 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-lg transition-colors duration-150"
          title="Close Mode"
          aria-label="Close Mode"
        >
          <X size={16} />
        </button>
      )}
      <div className="flex-1 overflow-auto rounded-2xl shadow-sm border border-gray-200 bg-white">
        <div className="overflow-x-auto min-h-0">
          <table className="min-w-[900px] w-full border-collapse text-sm text-gray-700" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="bg-gray-50 text-gray-700 font-semibold">
              <th
                rowSpan="2"
                className="px-3 py-2 border border-gray-200 text-center cursor-pointer select-none align-top"
                onClick={() => handleSort("risk_id")}
              >
                No{sortIndicator("risk_id")}
              </th>
              <th
                rowSpan="2"
                className="px-3 py-2 border border-gray-200 text-center align-top"
              >
                Risk ID No.
              </th>
              <th
                rowSpan="2"
                className="px-3 py-2 border border-gray-200 text-center align-top"
                style={{ minWidth: "150px", maxWidth: "250px" }}
              >
                Risk Description
              </th>
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "150px", maxWidth: "300px" }}>Risk Details</th>
              <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "100px", maxWidth: "150px" }}>Owner</th>
              <th colSpan="4" className="px-3 py-2 border border-gray-200 text-center align-top">Audit Program</th>
              <th colSpan="3" className="px-3 py-2 border border-gray-200 text-center align-top">Sampling</th>
              {(isPlanningMode || isMoveToDraftMode || isDeleteMode) && (
                <th rowSpan="2" className="px-3 py-2 border border-gray-200 text-center align-top">Action</th>
              )}
            </tr>

            <tr className="bg-gray-50 text-gray-700 font-semibold">
              <th
                className="px-3 py-2 border border-gray-200 text-center cursor-pointer select-none align-top"
                onClick={() => handleSort("ap_code")}
              >
                AP Code{sortIndicator("ap_code")}
              </th>
              <th
                className="px-3 py-2 border border-gray-200 text-center cursor-pointer select-none align-top"
                onClick={() => handleSort("substantive_test")}
                style={{ minWidth: "120px", maxWidth: "180px" }}
              >
                Substantive Test{sortIndicator("substantive_test")}
              </th>
              <th className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "150px", maxWidth: "250px" }}>Objective</th>
              <th className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "150px", maxWidth: "300px" }}>Procedures</th>
              <th className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "120px", maxWidth: "180px" }}>Method</th>
              <th className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "150px", maxWidth: "250px" }}>Description</th>
              <th className="px-3 py-2 border border-gray-200 text-center align-top" style={{ minWidth: "120px", maxWidth: "180px" }}>Application</th>
            </tr>
          </thead>

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
                    {(isPlanningMode || isMoveToDraftMode || isDeleteMode) && apIndex === 0 && (
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

                          {/* Delete button - hanya muncul saat Delete Data mode */}
                          {isDeleteMode && onDelete && departmentApi && (
                            <button
                              type="button"
                              onClick={() => {
                                const deleteKey = `${departmentApi}-${risk.risk_id}`;
                                if (confirm(`Are you sure you want to delete this draft record?`)) {
                                  setDeleting((prev) => ({ ...prev, [deleteKey]: true }));
                                  onDelete(risk.risk_id, departmentApi).finally(() => {
                                    setDeleting((prev) => {
                                      const newState = { ...prev };
                                      delete newState[deleteKey];
                                      return newState;
                                    });
                                  });
                                }
                              }}
                              disabled={deleting[`${departmentApi}-${risk.risk_id}`]}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Delete draft record ${risk.risk_id_no}`}
                            >
                              <Trash2 size={14} />
                              <span>{deleting[`${departmentApi}-${risk.risk_id}`] ? "Deleting..." : "Delete"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ));
              })
            ) : (
              <tr>
                <td colSpan={(isPlanningMode || isMoveToDraftMode || isDeleteMode) ? 14 : 13} className="text-center py-6 text-gray-500 border border-gray-200">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
