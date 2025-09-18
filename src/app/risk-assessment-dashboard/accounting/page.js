"use client"

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { newAccountingDataPopUp } from "@/app/utils/store";
import { NewAccountingInput } from "@/app/components/PopUp";
import { useMemo } from "react";

export default function Accounting() {
  const isNewAccountingOpen = newAccountingDataPopUp((s) => s.isNewAccountingOpen);
  const openNewAccounting = newAccountingDataPopUp((s) => s.openNewAccounting);
  const closeNewAccounting = newAccountingDataPopUp((s) => s.closeNewAccounting);

  const items = useMemo(
    () => [
      {name: "New Data", action: () => openNewAccounting() },
      {name: "Delete Data", action: () => console.log("test")},
      {name: "Export Data", action: () => console.log("test")}
    ],
    [openNewAccounting]
  );


  return (
    <main className="flex flex-row w-max h-full">
      <SmallSidebar />
      <div className="flex flex-col">
        <SmallHeader label={"Risk Assessment Form Accounting"} items={items}/>
        <div className="mt-12 ml-14">
          {isNewAccountingOpen && <NewAccountingInput onClose={closeNewAccounting}/>}
        </div>
      </div>
    </main>
  );
}
