"use client";

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewTaxInput } from "@/app/components/PopUp";
import { usePopUp, useTaxStore } from "@/app/utils/store";
import { useMemo } from "react";
import { DataTable } from "@/app/components/DataTable";


function TaxTable(){
  const tax = useTaxStore((s) => s.tax);
  const loadTax = useTaxStore((s) => s.loadTax);

  return(
    <DataTable 
    items={tax}
    load={loadTax}
    />
  );
}


export default function Tax() {
  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const items = useMemo(
    () => [
      { name: "New Data", action: () => openPopUp() },
      { name: "Delete Data", action: () => console.log("del") },
      { name: "Export Data", action: console.log("export") },
    ],
    [openPopUp],
  );

  return (
  <main className="flex flex-row w-full h-full min-h-screen">
      <SmallSidebar />
      <div className="flex flex-col flex-1">
        <SmallHeader label="Risk Assessment Form L&P" items={items} />
        <div className="mt-12 ml-14 flex-1">
          {isOpen && <NewTaxInput onClose={closePopUp} />}
          <TaxTable />
        </div>
      </div>
    </main>
  );
}
