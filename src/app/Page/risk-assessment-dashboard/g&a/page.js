"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewGeneralAffairInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useMemo } from "react";
import { useGeneralAffairStore } from "@/app/stores/RiskAssessement/gaStore";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";

function GeneralAffairTable() {
  const generalAffair = useGeneralAffairStore((s) => s.generalAffair);
  const loadGeneralAffair = useGeneralAffairStore((s) => s.loadGeneralAffair);

  return (
    <DataTable 
    items={generalAffair}
    load={loadGeneralAffair}
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
        <SmallHeader label="Risk Assessment Form G & A" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewGeneralAffairInput onClose={closePopUp} />}
          <GeneralAffairTable />
        </div>
      </div>
    </main>
  );
}
