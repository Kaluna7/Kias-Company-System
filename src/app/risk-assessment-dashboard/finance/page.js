"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewFinanceInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/RiskAssessement/popupStore";
import { useMemo } from "react";
import { useFinanceStore } from "@/app/stores/RiskAssessement/financeStore";
import { DataTable } from "@/app/components/ui/DataTable";

function FinanceTable() {
  const finances = useFinanceStore((s) => s.finance);
  const loadFinance = useFinanceStore((s) => s.loadFinance);

  return (
    <DataTable
    items={finances}
    load={loadFinance}
    />
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
          {isOpen && <NewFinanceInput onClose={closePopUp} />}
          <FinanceTable />
        </div>
      </div>
    </main>
  );
}
