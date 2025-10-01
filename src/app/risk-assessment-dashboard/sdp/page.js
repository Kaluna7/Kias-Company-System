"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewSDPInput } from "@/app/components/PopUp";
import { usePopUp } from "@/app/utils/store";
import { useMemo, useEffect } from "react";
import { useStorePlanningStore } from "@/app/utils/store";
import { DataTable } from "@/app/components/DataTable";

function StorePlanningTable() {
  const sdps = useStorePlanningStore((s) => s.sdp);
  const loadStorePlanning = useStorePlanningStore((s) => s.loadStorePlanning);

  return (
   <DataTable 
   items={sdps}
   load={loadStorePlanning}
   />
  );
}

export default function SDP() {
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
        <SmallHeader label="Risk Assessment Form SDP" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewSDPInput onClose={closePopUp} />}
          <StorePlanningTable />
        </div>
      </div>
    </main>
  );
}
