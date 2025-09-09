"use client";

import Image from "next/image";
import { DropDown, Search } from "./Button";
import { fileButton, editButton, viewButton } from "../data/Data";
import { useState } from "react";
import { newFinanceDataPopUp } from "../utils/store";

export default function SmallHeader({ label }) {
  const [active, setActive] = useState(null);

  const handleClick = (name) => {
    console.log("You clicked:", name);

    // cek apakah yang diklik adalah New Data
    if (name === "New Data") {
      newFinanceDataPopUp.getState().openNewFinance();
    }

    setActive(null);
  };

  return (
    <div className="w-full z-200">
      <header className="w-full bg-[#141D38] h-12 flex items-center justify-between fixed border-b border-white">
        <Image
          src="/images/kias-logo.png"
          width={45}
          height={45}
          alt="kias logo"
          className="ml-1"
        />

        <div className="flex flex-row gap-4 ml-[-140px]">
          <DropDown
            items={fileButton}
            label="File"
            onSelect={handleClick}
            isOpen={active === "File"}
            onToggle={() => setActive(active === "File" ? null : "File")}
            onClose={() => setActive(null)}
          />
          <DropDown
            items={editButton}
            label="Edit"
            onSelect={handleClick}
            isOpen={active === "Edit"}
            onToggle={() => setActive(active === "Edit" ? null : "Edit")}
            onClose={() => setActive(null)}
          />
          <DropDown
            items={viewButton}
            label="View"
            onSelect={handleClick}
            isOpen={active === "View"}
            onToggle={() => setActive(active === "View" ? null : "View")}
            onClose={() => setActive(null)}
          />
        </div>

        <Search />

        <h1 className="text-[#141D38] mr-10 rounded-2xl bg-white text-sm font-bold px-4 py-1 inset-shadow-sm inset-shadow-[#141D38]/50">
          {label}
        </h1>
      </header>
    </div>
  );
}
