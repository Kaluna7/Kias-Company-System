"use client";

import Image from "next/image";
import { DropDown, Search } from "../features/Button";
import { useState } from "react";

export default function SmallHeader({
  label,
  items: itemsProp = null,
  fileItems: fileItemsProp = null,
  editItems: editItemsProp = null,
  viewItems: viewItemsProp = null,
}) {
  const [active, setActive] = useState(null);
  const fileButton = [];
    
  const editButton = [];
    
  const viewButton = [];
  
  const fileItems =
    fileItemsProp ?? (Array.isArray(itemsProp) ? itemsProp : fileButton);
  const editItems = editItemsProp ?? editItemsProp ?? editButton;
  const viewItems = viewItemsProp ?? viewButton;

  const findItemFromName = (name) => {
    return (
      fileItems.find((i) => i.name === name) ||
      editItems.find((i) => i.name === name) ||
      viewItems.find((i) => i.name === name) ||
      null
    );
  };

  const handleClick = (payload) => {
    const item =
      typeof payload === "object" && payload !== null
        ? payload
        : findItemFromName(payload);

    console.log(
      "[SmallHeader] clicked payload:",
      payload,
      "=> resolved item:",
      item,
    );

    if (!item) {
      setActive(null);
      return;
    }

    if (typeof item.action === "function") {
      try {
        item.action();
      } catch (err) {
        console.error("[SmallHeader] error running item.action:", err);
      }
      setActive(null);
      return;
    }

    if (item.modal) {
      window.dispatchEvent(
        new CustomEvent("open-modal", { detail: { name: item.modal } }),
      );
      setActive(null);
      return;
    }

    console.log("[SmallHeader] no action/modal for item:", item);
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
            items={fileItems}
            label="File"
            onSelect={handleClick}
            isOpen={active === "File"}
            onToggle={() => setActive(active === "File" ? null : "File")}
            onClose={() => setActive(null)}
          />
          <DropDown
            items={editItems}
            label="Edit"
            onSelect={handleClick}
            isOpen={active === "Edit"}
            onToggle={() => setActive(active === "Edit" ? null : "Edit")}
            onClose={() => setActive(null)}
          />
          <DropDown
            items={viewItems}
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
