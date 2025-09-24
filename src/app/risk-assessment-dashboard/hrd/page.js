"use client"

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { newHrdDataPopUp } from "@/app/utils/store";
import { useMemo } from "react";
import { NewHrdInput } from "@/app/components/PopUp";

export default function Hrd() {
  const isNewHrdOpen = newHrdDataPopUp((s) => s.isNewHrdOpen);
  const openNewHrd = newHrdDataPopUp((s) => s.openNewHrd);
  const closeNewHrd = newHrdDataPopUp((s) => s.closeNewHrd);

  const items = useMemo(
    () => [
      {name : "New Data", action : () => openNewHrd()},
      {name : "Delete Data", action : () => console.log("delete")},
      {name : "Export Data", action : () => console.log("export")}
    ],
    [openNewHrd]
  );

  return (
    <main className="flex flex-row w-max h-full">
      <SmallSidebar />
      <div className="flex flex-col">
        <SmallHeader label={"Risk Assessment Form HRD"} items={items}/>
        <div className="mt-12 ml-14">
          {isNewHrdOpen && <NewHrdInput onClose={closeNewHrd}/>}
        </div>
      </div>
    </main>
  );
}
