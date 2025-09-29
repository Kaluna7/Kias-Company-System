"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewGeneralAffairInput } from "@/app/components/PopUp";
import { usePopUp } from "@/app/utils/store";
import { useMemo, useEffect } from "react";
import { useGeneralAffairStore } from "@/app/utils/store";

function GeneralAffairTable() {
  const generalAffair = useGeneralAffairStore((s) => s.generalAffair);
  const loadGeneralAffair = useGeneralAffairStore((s) => s.loadGeneralAffair);

  useEffect(() => {
    loadGeneralAffair();
  }, [loadGeneralAffair]);

  if (!generalAffair || generalAffair.length === 0)
    return <div className="p-4 text-gray-500">Belum ada data.</div>;

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full table-auto border-collapse">
          <colgroup>
            <col style={{ width: "25rem" }} />
            <col style={{ width: "20rem" }} />
            <col style={{ width: "20rem" }} />
            <col style={{ width: "9rem" }} />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "8rem" }} />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "8rem" }} />
            <col style={{ width: "20rem" }} />
            <col style={{ width: "12rem" }} />
            <col style={{ width: "12rem" }} />
            <col style={{ width: "10rem" }} />
          </colgroup>

          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                RISK ID NO.
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Category
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Sub Department
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                SOP Related
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Risk Description
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Risk Details
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Impact Description
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Impact Level
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Probability Level
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Priority Level
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Mitigation Strategy
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Owners
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Root Cause Category
              </th>
              <th className="p-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-300">
                Onset Timeframe
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {generalAffair.map((f, index) => (
              <tr
                key={f.risk_id}
                className={`transition-colors hover:bg-gray-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
              >
                {/* RISK ID NO */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.risk_id_no ?? `A.2.4.${f.risk_id}`}
                  </div>
                </td>

                {/* Category */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.category ?? "-"}
                  </div>
                </td>

                {/* Sub Department */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.sub_department ?? "-"}
                  </div>
                </td>

                {/* SOP Related */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.sop_related ?? "-"}
                  </div>
                </td>

                {/* Risk Description */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px] max-h-[8rem] overflow-auto">
                    {f.risk_description ?? "-"}
                  </div>
                </td>

                {/* Risk Details */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px] max-h-[8rem] overflow-auto">
                    {f.risk_details ?? "-"}
                  </div>
                </td>

                {/* Impact Description */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px] max-h-[8rem] overflow-auto">
                    {f.impact_description ?? "-"}
                  </div>
                </td>

                {/* Impact Level */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.impact_level ?? "-"}
                  </div>
                </td>

                {/* Probability Level */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.probability_level ?? "-"}
                  </div>
                </td>

                {/* Priority Level */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.priority_level ?? "-"}
                  </div>
                </td>

                {/* Mitigation Strategy */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px] max-h-[8rem] overflow-auto">
                    {f.mitigation_strategy ?? "-"}
                  </div>
                </td>

                {/* Owners */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.owners ?? "-"}
                  </div>
                </td>

                {/* Root Cause Category */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.root_cause_category ?? "-"}
                  </div>
                </td>

                {/* Onset Timeframe */}
                <td className="p-3 text-sm text-gray-800 border-b border-gray-200 align-top text-center">
                  <div className="whitespace-pre-wrap break-words break-all min-h-[40px]">
                    {f.onset_timeframe ?? "-"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Finance() {
  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const items = useMemo(
    () => [
      { name: "New Data", action: () => openPopUp() },
      { name: "Delete Data", action: () => console.log("del") },
      { name: "Export Data", action: () => console.log("export") },
    ],
    [openPopUp],
  );

  return (
    <main className="flex flex-row w-full h-full min-h-screen">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="Risk Assessment Form Finance" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewGeneralAffairInput onClose={closePopUp} />}
          <GeneralAffairTable />
        </div>
      </div>
    </main>
  );
}
