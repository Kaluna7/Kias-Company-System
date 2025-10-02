"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewFinanceInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/RiskAssessement/popupStore";
import { useMemo, useState } from "react";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";
import { DataTable } from "@/app/components/ui/DataTable";
import { useCallback, useEffect } from "react";

function FinanceTable({ convertMode, onCloseConvert, viewDraft, loadFinance }) {
  const load = useCallback(() => {
    return loadFinance(viewDraft ? "draft" : "published");
  }, [loadFinance, viewDraft]);

  useEffect(() => {
    load();
  }, [load]);

  const finances = useFinanceStore((s) => s.finance);

  return (
    <DataTable
      items={finances}
      load={load}
      convertMode={convertMode}
      onCloseConvert={onCloseConvert}
      viewDraft={viewDraft}
    />
  );
}



export default function Finance() {
  const [convertMode, setConvertMode] = useState(false);
  const [viewDraft, setViewDraft] = useState(false);

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const loadFinance = useFinanceStore((s) => s.loadFinance);

  // header items
  const items = useMemo(
    () => [
      { name: "New Data", action: () => openPopUp() },
      { name: "Convert To Draft", action: () => setConvertMode((p) => !p) },
      { name: "Export Data", action: () => console.log("export") },
    ],
    [openPopUp]
  );

  const viewItems = useMemo(
    () => [
      {
        name: "View Draft",
        action: async () => {
          setViewDraft(true);
        },
      },
      {
        name: "View Published",
        action: async () => {
          setViewDraft(false);
        },
      },
    ],
    []
  );

  return (
    <main className="flex flex-row w-full h-full min-h-screen">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="Risk Assessment Form Finance" items={items} viewItems={viewItems} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewFinanceInput onClose={closePopUp} />}

          <FinanceTable
            convertMode={convertMode}
            onCloseConvert={() => setConvertMode(false)}
            viewDraft={viewDraft}
            loadFinance={loadFinance}
          />
        </div>
      </div>
    </main>
  );
}
