// SmallHeader.jsx
"use client";

import Image from "next/image";
import { DropDown, Search } from "./Button";
import { fileButton, editButton, viewButton } from "../data/Data";
import { useState } from "react";

/*
  Perubahan utama:
  - Tidak lagi import/mengandalkan modalOpeners secara default untuk action utama.
  - Menerima prop items (array) sebagai file menu (backward compatible).
  - Juga menerima explicit props fileItems/editItems/viewItems bila ingin custom per group.
  - Menjalankan item.action() bila tersedia (parent harus mengirim action).
*/

export default function SmallHeader({
  label,
  items: itemsProp = null,
  fileItems: fileItemsProp = null,
  editItems: editItemsProp = null,
  viewItems: viewItemsProp = null,
}) {
  const [active, setActive] = useState(null);

  // Prioritas:
  // - jika parent kirim explicit fileItems prop -> pakai
  // - else jika parent kirim items array -> treat sebagai fileItems (backward compat)
  // - else pakai default imports
  const fileItems = fileItemsProp ?? (Array.isArray(itemsProp) ? itemsProp : fileButton);
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
    // payload idealnya object item, tapi handle juga kalau string (legacy)
    const item = typeof payload === "object" && payload !== null ? payload : findItemFromName(payload);

    console.log("[SmallHeader] clicked payload:", payload, "=> resolved item:", item);

    if (!item) {
      setActive(null);
      return;
    }

    // Primary: jalankan action yang dikirim oleh parent
    if (typeof item.action === "function") {
      try {
        item.action();
      } catch (err) {
        console.error("[SmallHeader] error running item.action:", err);
      }
      setActive(null);
      return;
    }

    // Fallback: kalau item punya modal string (opsional), emit event atau log
    if (item.modal) {
      // contoh: emit custom event (kalau kamu punya ModalHost central yang listen)
      window.dispatchEvent(new CustomEvent("open-modal", { detail: { name: item.modal } }));
      setActive(null);
      return;
    }

    console.log("[SmallHeader] no action/modal for item:", item);
    setActive(null);
  };

  return (
    <div className="w-full z-200">
      <header className="w-full bg-[#141D38] h-12 flex items-center justify-between fixed border-b border-white">
        <Image src="/images/kias-logo.png" width={45} height={45} alt="kias logo" className="ml-1" />

        <div className="flex flex-row gap-4 ml-[-140px]">
          <DropDown items={fileItems} label="File" onSelect={handleClick} isOpen={active === "File"} onToggle={() => setActive(active === "File" ? null : "File")} onClose={() => setActive(null)} />
          <DropDown items={editItems} label="Edit" onSelect={handleClick} isOpen={active === "Edit"} onToggle={() => setActive(active === "Edit" ? null : "Edit")} onClose={() => setActive(null)} />
          <DropDown items={viewItems} label="View" onSelect={handleClick} isOpen={active === "View"} onToggle={() => setActive(active === "View" ? null : "View")} onClose={() => setActive(null)} />
        </div>

        <Search />

        <h1 className="text-[#141D38] mr-10 rounded-2xl bg-white text-sm font-bold px-4 py-1 inset-shadow-sm inset-shadow-[#141D38]/50">
          {label}
        </h1>
      </header>
    </div>
  );
}
