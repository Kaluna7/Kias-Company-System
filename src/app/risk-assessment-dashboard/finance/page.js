"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewFinanceData } from "@/app/components/PopUp";
import { newFinanceDataPopUp } from "@/app/utils/store";
import { useMemo } from "react";

export default function Finance() {
  const isNewFinanceOpen = newFinanceDataPopUp((s) => s.isNewFinanceOpen);
  const openNewFinance = newFinanceDataPopUp((s) => s.openNewFinance);
  const closeNewFinance = newFinanceDataPopUp((s) => s.closeNewFinance);

  const items = useMemo(
    () => [
      { name: "New Data", action: () => openNewFinance() },
      { name: "Delete Data", action: () => console.log("Delete") },
      { name: "Export Data", action: () => console.log("Export") },
    ],
    [openNewFinance],
  );

  return (
    <main className="flex flex-row w-max h-full">
      <SmallSidebar />
      <div className="flex flex-col">
        <SmallHeader label="Risk Assessment Form Finance" items={items} />
        <div className="mt-12 ml-14">
          {isNewFinanceOpen && <NewFinanceData onClose={closeNewFinance} />}
        </div>
      </div>
    </main>
  );
}
