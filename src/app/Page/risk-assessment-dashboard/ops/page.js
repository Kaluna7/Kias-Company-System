"use client";

import SmallSidebar from "@/app/components/layout/SmallSidebar";
import SmallHeader from "@/app/components/layout/SmallHeader";
import { NewOperationalInput } from "@/app/components/ui/PopUpRiskAssessmentInput";
import { usePopUp } from "@/app/stores/ComponentsStore/popupStore";
import { useOperationalStore } from "@/app/stores/RiskAssessement/opsStore";
import { useMemo } from "react";
import { DataTable } from "@/app/components/ui/Risk-Assessment/DataTable";


function OperationalTable(){
  const operational = useOperationalStore((s) => s.operational);
  const loadOperational = useOperationalStore((s) => s.loadOperational);
  return(
    <DataTable 
    items={operational}
    load={loadOperational}
    />
  );
}

export default function Operational() {
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
      <SmallHeader label="Risk Assessment Form Operational" items={items} />
      <div className="mt-12 ml-14 flex-1">
        {isOpen && <NewOperationalInput onClose={closePopUp} />}
        <OperationalTable />
      </div>
    </div>
  </main>
  );
}
