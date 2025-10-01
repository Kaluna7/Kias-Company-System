"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewHrdInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/RiskAssessement/popupStore";
import { useHrdStore } from "@/app/stores/RiskAssessement/hrdStore";
import { useMemo } from "react";
import { DataTable } from "@/app/components/ui/DataTable";

function HrdTable() {
  const hrds = useHrdStore((s) => s.hrd);
  const loadHrd = useHrdStore((s) => s.loadHrd);

  return (
    <DataTable 
    items={hrds}
    load={loadHrd}
    />
  );
}

export default function Hrd() {
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
        <SmallHeader label="Risk Assessment Form HRD" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewHrdInput onClose={closePopUp} />}
          <HrdTable />
        </div>
      </div>
    </main>
  );
}
