"use client";

import Image from "next/image";
import { DropDown, Search } from "../features/Button";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";

export default function SmallHeader({
  label,
  items: itemsProp = null,
  fileItems: fileItemsProp = null,
  editItems: editItemsProp = null,
  viewItems: viewItemsProp = null,
  sortByItems: sortByItemsProp = null,
  onSearch,
  showSearch = true,
}) {
  const { data: session, status } = useSession();
  const [active, setActive] = useState(null);
  const [role, setRole] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <header className="w-full bg-[#141D38]/85 backdrop-blur-xl backdrop-saturate-150 border-b border-white/20 min-h-[56px] md:h-14 flex items-center justify-between fixed px-4 md:px-6 py-2 md:py-0 shadow-lg shadow-black/10">
        {/* Left Section: Logo + Hamburger (Mobile) / Menu (Desktop) */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Image
              src="/images/kias-logo.webp"
              width={45}
              height={45}
              alt="kias logo"
              className="rounded-lg"
            />
          </div>

          {/* Hamburger Button (Mobile Only) */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setActive(null); // Close any open dropdowns
            }}
            className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Menu (Desktop Only) */}
          <div className="hidden md:flex flex-row gap-1 md:gap-2 items-center">
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
        </div>

        {/* Center Section: Search (Desktop Only) */}
        {showSearch && (
          <div className="hidden md:flex flex-1 justify-center px-4">
            <Search onSearch={handleSearch} />
          </div>
        )}

        {/* Right Section: Label */}
        <div className="flex-shrink-0">
          <h1 className="text-white rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-xs md:text-sm font-semibold px-3 md:px-6 py-1.5 md:py-2 shadow-sm whitespace-nowrap">
            {label}
          </h1>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-[#141D38]/95 backdrop-blur-xl border-b border-white/20 shadow-xl md:hidden">
            <div className="px-4 py-4 space-y-2">
              {/* File hanya untuk admin */}
              {role === "admin" && fileItems.length > 0 && (
                <div className="mb-3">
                  <div className="text-white/70 text-xs font-semibold mb-2 px-2">File</div>
                  {fileItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleClick(item);
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2.5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              {/* View */}
              {viewItems.length > 0 && (
                <div className="mb-3">
                  <div className="text-white/70 text-xs font-semibold mb-2 px-2">View</div>
                  {viewItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleClick(item);
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2.5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Sort By */}
              {sortByItems.length > 0 && (
                <div className="mb-3">
                  <div className="text-white/70 text-xs font-semibold mb-2 px-2">Sort By</div>
                  {sortByItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleClick(item);
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2.5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
