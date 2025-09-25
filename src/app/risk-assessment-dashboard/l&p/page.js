"use client"

import SmallSidebar from "@/app/components/SmallSidebar";
import SmallHeader from "@/app/components/SmallHeader";
import { NewLpInput } from "@/app/components/PopUp";
import { usePopUp } from "@/app/utils/store";
import { useMemo } from "react";

export default function LossPrevention() {

  const isOpen = usePopUp((s) => s.isOpen);
  const openPopUp = usePopUp((s) => s.openPopUp);
  const closePopUp = usePopUp((s) => s.closePopUp);

  const items = useMemo(() => [
    { name: "New Data", action : () => openPopUp() },
    { name: "Delete Data", action : () => console.log("del") },
    { name: "Export Data", action : () => console.log("export") }
  ],[openPopUp]);


  return (
    <main className="flex flex-row w-max h-full">
      <SmallSidebar />
      <div className="flex flex-col">
        <SmallHeader label={"Risk Assessment Form Loss Prevention"} items={items}/>
        <div className="mt-12 ml-14">
          { isOpen && <NewLpInput onClose={closePopUp} /> }
        </div>
      </div>
    </main>
  );
}
