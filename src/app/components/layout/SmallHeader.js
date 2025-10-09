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
  sortByItems: sortByItemsProp = null,
  onSearch,
}) {
  const [active, setActive] = useState(null);

  // Default array kosong agar tidak undefined
  const fileItems =
    fileItemsProp ?? (Array.isArray(itemsProp) ? itemsProp : []);
  const editItems = editItemsProp ?? [];
  const viewItems = viewItemsProp ?? [];
  const sortByItems = sortByItemsProp ?? [];


  // Fungsi mencari item
  const findItemFromName = (name) => {
    return (
      fileItems.find((i) => i.name === name) ||
      editItems.find((i) => i.name === name) ||
      viewItems.find((i) => i.name === name) ||
      null
    );
  };

  // Klik dropdown item
  const handleClick = (payload) => {
    const item =
      typeof payload === "object" && payload !== null
        ? payload
        : findItemFromName(payload);

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

    setActive(null);
  };

  // Handle pencarian
  const handleSearch = (value) => {
    if (typeof onSearch === "function") onSearch(value);
  };

  return (
    <div className="w-full z-[200]">
      <header className="w-full bg-[#141D38] h-12 flex items-center justify-between fixed border-b border-white">
        {/* Logo */}
        <Image
          src="/images/kias-logo.png"
          width={45}
          height={45}
          alt="kias logo"
          className="ml-1"
        />

        {/* Dropdown menus */}
        <div className="flex flex-row gap-4 ml-[-140px]">
          {/* Hanya tampil jika ada items di File */}
          {fileItems.length > 0 && (
            <DropDown
              items={fileItems}
              label="File"
              onSelect={handleClick}
              isOpen={active === "File"}
              onToggle={() =>
                setActive(active === "File" ? null : "File")
              }
              onClose={() => setActive(null)}
            />
          )}

          {/* Hanya tampil jika ada items di Edit */}
          {editItems.length > 0 && (
            <DropDown
              items={editItems}
              label="Edit"
              onSelect={handleClick}
              isOpen={active === "Edit"}
              onToggle={() =>
                setActive(active === "Edit" ? null : "Edit")
              }
              onClose={() => setActive(null)}
            />
          )}

          {/* View selalu muncul */}
          <DropDown
            items={viewItems}
            label="View"
            onSelect={handleClick}
            isOpen={active === "View"}
            onToggle={() =>
              setActive(active === "View" ? null : "View")
            }
            onClose={() => setActive(null)}
          />

          <DropDown
  items={sortByItems}
  label="Sort By"
  onSelect={handleClick}
  isOpen={active === "Sort By"}
  onToggle={() => setActive(active === "Sort By" ? null : "Sort By")}
  onClose={() => setActive(null)}
/>

        </div>

        {/* Search */}
        <Search onSearch={handleSearch} />

        {/* Label */}
        <h1 className="text-[#141D38] mr-10 rounded-2xl bg-white text-sm font-bold px-4 py-1 inset-shadow-sm inset-shadow-[#141D38]/50">
          {label}
        </h1>
      </header>
    </div>
  );
}
