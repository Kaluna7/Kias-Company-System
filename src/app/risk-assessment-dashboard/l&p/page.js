"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewLpInput } from "@/app/components/PopUp";
import { usePopUp } from "@/app/utils/store";
import { useMemo, useEffect } from "react";
import { useLossPreventionStore } from "@/app/utils/store";
import { DataTable } from "@/app/components/DataTable";

function LossPreventionTable() {
  const lossPreventions = useLossPreventionStore((s) => s.lp);
  const loadLossPrevention = useLossPreventionStore((s) => s.loadLossPrevention);

  return (
   <DataTable 
   items={lossPreventions}
   load={loadLossPrevention}
   />
  );
}

export default function LossPrevention() {
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
        <SmallHeader label="Risk Assessment Form L&P" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewLpInput onClose={closePopUp} />}
          <LossPreventionTable />
        </div>
      </div>
    </main>
  );
}
