"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewMisInput } from "@/app/components/PopUp";
import { usePopUp } from "@/app/utils/store";
import { useMemo } from "react";
import { DataTable } from "@/app/components/DataTable";
import { useMisStore } from "@/app/utils/store";


function MisTable(){
  const mis = useMisStore((s) => s.mis);
  const loadMis = useMisStore((s) => s.loadMis);

  return(
    <DataTable 
    items={mis}
    load={loadMis}
    />
  );
}


export default function Mis() {
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
        <SmallHeader label="Risk Assessment Form Mis" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewMisInput onClose={closePopUp} />}
          <MisTable />
        </div>
      </div>
    </main>
  );
}
