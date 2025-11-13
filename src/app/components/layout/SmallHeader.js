"use client";

import Image from "next/image";
import { DropDown, Search } from "../features/Button";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function SmallHeader({
  label,
  items: itemsProp = null,
  fileItems: fileItemsProp = null,
  editItems: editItemsProp = null,
  viewItems: viewItemsProp = null,
  sortByItems: sortByItemsProp = null,
  onSearch,
}) {
  const { data: session, status } = useSession();
  const [active, setActive] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (session?.user?.role) {
      setRole(session.user.role);
    }
  }, [session]);

  // Pastikan array aman
  const fileItems = fileItemsProp ?? (Array.isArray(itemsProp) ? itemsProp : []);
  const editItems = editItemsProp ?? [];
  const viewItems = viewItemsProp ?? [];
  const sortByItems = sortByItemsProp ?? [];

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

    if (!item) return setActive(null);

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
        new CustomEvent("open-modal", { detail: { name: item.modal } })
      );
      setActive(null);
      return;
    }

    setActive(null);
  };

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

        {/* Menu */}
        <div className="flex flex-row gap-4 ml-[-140px]">
          {/* File hanya untuk admin */}
          {role === "admin" && fileItems.length > 0 && (
            <DropDown
              items={fileItems}
              label="File"
              onSelect={handleClick}
              isOpen={active === "File"}
              onToggle={() => setActive(active === "File" ? null : "File")}
              onClose={() => setActive(null)}
            />
          )}

          {/* Edit hanya untuk admin */}
          {role === "admin" && editItems.length > 0 && (
            <DropDown
              items={editItems}
              label="Edit"
              onSelect={handleClick}
              isOpen={active === "Edit"}
              onToggle={() => setActive(active === "Edit" ? null : "Edit")}
              onClose={() => setActive(null)}
            />
          )}

          {/* View & Sort By semua user boleh */}
          {viewItems.length > 0 && (
            <DropDown
              items={viewItems}
              label="View"
              onSelect={handleClick}
              isOpen={active === "View"}
              onToggle={() => setActive(active === "View" ? null : "View")}
              onClose={() => setActive(null)}
            />
          )}

          {sortByItems.length > 0 && (
            <DropDown
              items={sortByItems}
              label="Sort By"
              onSelect={handleClick}
              isOpen={active === "Sort By"}
              onToggle={() =>
                setActive(active === "Sort By" ? null : "Sort By")
              }
              onClose={() => setActive(null)}
            />
          )}
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
