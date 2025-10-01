"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewMerchandiseInput } from "@/app/components/PopUp";
import { usePopUp } from "@/app/utils/store";
import { useMemo } from "react";
import { useMerchandiseStore } from "@/app/utils/store";
import { DataTable } from "@/app/components/DataTable";



function MerchandiseTable(){
  const merchandises = useMerchandiseStore((s) => s.merchandise);
  const loadMerchandise = useMerchandiseStore((s) => s.loadMerchandise);
  return(
    <DataTable 
    items={merchandises}
    load={loadMerchandise}
    />
  );
}

export default function Merchandise() {
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
            <SmallHeader label="Risk Assessment Form Merchandise" items={items} />
            <div className="mt-12 ml-14 flex-1">
              {isOpen && <NewMerchandiseInput onClose={closePopUp} />}
              <MerchandiseTable />
            </div>
          </div>
        </main>
  );
}
