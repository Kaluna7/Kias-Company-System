"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewAccountingInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/RiskAssessement/popupStore";
import { useMemo } from "react";
import { useAccountingStore } from "@/app/stores/RiskAssessement/accountingStore";
import { DataTable } from "@/app/components/ui/DataTable";

function AccountingTable() {
  const accountings = useAccountingStore((s) => s.accounting);
  const loadAccounting = useAccountingStore((s) => s.loadAccounting);

  return (
    <DataTable
    items={accountings}
    load={loadAccounting}
    />
  );
}

export default function Accounting() {
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
        <SmallHeader label="Risk Assessment Form Accounting" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewAccountingInput onClose={closePopUp} />}
          <AccountingTable />
        </div>
      </div>
    </main>
  );
}
