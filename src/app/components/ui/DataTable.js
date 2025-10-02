"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "../features/ConfirmModal";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";

export function DataTable({ items, load, convertMode = false, onCloseConvert, viewDraft = false }) {
  const updateStatus = useFinanceStore((s) => s.updateStatus);
  const moveToDraft = useFinanceStore((s) => s.moveToDraft); // if needed
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null); // { id, action }

  useEffect(() => {
    // call load when load function changes (stable) or component mounts
    if (typeof load === "function") load();
  }, [load]);

  if (!items || items.length === 0) return <div className="p-4 text-gray-500">Belum ada data.</div>;

  const openConfirm = (payload) => {
    setConfirmPayload(payload);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmPayload(null);
  };

  const handleConfirm = async () => {
    if (!confirmPayload) return;
    const { id, action } = confirmPayload;
    try {
      if (action === "publish") {
        await updateStatus(id, "published");
      } else if (action === "draft") {
        await moveToDraft(id);
      } else {
        await updateStatus(id, action);
      }
      // reload after action
      if (typeof load === "function") await load();
      closeConfirm();
    } catch (err) {
      console.error("Confirm action error:", err);
      alert("Gagal melakukan action: " + (err?.message || err));
    }
  };

  return (
    <div className="p-4">
      <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "3%" }} />
            <col style={{ width: "3%" }} />
            <col style={{ width: "3%" }} />
            <col style={{ width: "3%" }} />
          </colgroup>

          <thead>
            <tr className="bg-gray-100">
              {[
                "RISK ID NO.",
                "Category",
                "Sub Department",
                "SOP Related",
                "Risk Description",
                "Risk Details",
                "Impact Description",
                "Impact Level",
                "Probability Level",
                "Priority Level",
                "Mitigation Strategy",
                "Owners",
                "Root Cause Category",
                "Onset Timeframe",
                "Status",
              ].map((h) => (
                <th key={h} className="p-3 text-center text-sm font-semibold text-gray-700 border border-gray-200">
                  {h}
                </th>
              ))}
              {(convertMode || viewDraft) && (
                <th className="p-3 text-center text-sm font-semibold text-gray-700 border border-gray-200">
                  Action
                  {convertMode && (
                    <button onClick={onCloseConvert} className="ml-2 text-red-500 hover:text-red-700 font-bold">❌</button>
                  )}
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {items.map((f, idx) => (
              <tr key={f.risk_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                {[
                  f.risk_id_no ?? `A.2.1.${f.risk_id}`,
                  f.category ?? "-",
                  f.sub_department ?? "-",
                  f.sop_related ?? "-",
                  f.risk_description ?? "-",
                  f.risk_details ?? "-",
                  f.impact_description ?? "-",
                  f.impact_level ?? "-",
                  f.probability_level ?? "-",
                  f.priority_level ?? "-",
                  f.mitigation_strategy ?? "-",
                  f.owners ?? "-",
                  f.root_cause_category ?? "-",
                  f.onset_timeframe ?? "-",
                ].map((val, i) => (
                  <td
                    key={i}
                    className={`p-2 text-xs text-gray-800 border border-gray-200 ${[4, 5, 6, 10].includes(i) ? "text-left break-words max-w-[180px] whitespace-normal break-all" : "text-center whitespace-normal break-all"}`}
                    title={typeof val === "string" ? val : undefined}
                  >
                    {val}
                  </td>
                ))}

                <td className="p-2 text-xs text-gray-800 border border-gray-200 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${f.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                    {f.status ?? "published"}
                  </span>
                </td>

                {(convertMode || viewDraft) && (
                  <td className="p-2 text-center border border-gray-200">
                    <div className="flex items-center justify-center gap-2">
                      {/* convertMode: move to draft */}
                      {convertMode && f.status !== "draft" && (
                        <button title="Move to Draft" className="p-1" onClick={() => openConfirm({ id: f.risk_id, action: "draft" })}>
                          📥
                        </button>
                      )}

                      {/* viewDraft: show publish button only in draft view */}
                      {viewDraft && f.status === "draft" && (
                        <button title="Move to Published" className="px-2 py-1 bg-green-600 text-white rounded text-xs" onClick={() => openConfirm({ id: f.risk_id, action: "publish" })}>
                          Publish
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmOpen && confirmPayload && (
        <ConfirmModal
          title={confirmPayload.action === "publish" ? "Move to Published" : "Confirm"}
          message={confirmPayload.action === "publish" ? "Are you sure you want to move this data to Published?" : "Are you sure you want to move this data to Draft?"}
          onClose={closeConfirm}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
