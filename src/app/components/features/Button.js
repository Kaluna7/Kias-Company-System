"use client";

import Image from "next/image";
import Link from "next/link";
import { BsSearch } from "react-icons/bs";
import { useRef, useEffect, useState } from "react";

export function ButtonDashboard({ name, href, logo }) {
  return (
    <ul>
      <li>
        <Link
          href={href}
          prefetch={true}
          className="rounded-2xl text-center bg-white flex flex-col items-center text-[#034f75] font-extrabold py-5 shadow-md text-[14px] px-10 gap-2 hover:scale-98 transition-transform duration-200"
        >
          <Image src={logo} width={120} height={120} alt={name} priority={false} />
          {name}
        </Link>
      </li>
    </ul>
  );
}

export function Button({ onClick, label, style }) {
  return (
    <button onClick={onClick} className={style}>
      {label}
    </button>
  );
}

// DROP DOWN THAT CONNECT TO SMALL HEADER
export function DropDown({
  onSelect,
  label,
  items = [],
  isOpen,
  onToggle,
  onClose,
  openWhat,
}) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={onToggle}
        className="px-3 py-1.5 md:px-4 md:py-2 text-white hover:text-yellow-300 rounded-lg flex flex-row items-center gap-1 text-sm font-medium cursor-pointer hover:bg-white/10 transition-colors duration-200"
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-48 bg-[#141D38]/90 backdrop-blur-xl backdrop-saturate-150 rounded-xl z-10 text-sm shadow-xl shadow-black/30 border border-white/20 overflow-hidden">
          {items.map((item, idx) => (
            <button
              key={item.id ?? `${item.name}-${idx}`}
              className="block w-full text-left px-4 py-2.5 hover:bg-white/10 text-white hover:text-yellow-300 transition-colors duration-150"
              onClick={() => {
                // Jangan jalankan item.action() di sini.
                // Kirim object item ke SmallHeader supaya parent yang menjalankan action
                if (typeof onSelect === "function") onSelect(item);

                // optional: jika ada handler openWhat (legacy), panggil juga
                if (typeof openWhat === "function") openWhat(item.name);

                // tutup dropdown
                if (typeof onClose === "function") onClose();
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// SEARCH


export function Search({ onSearch }) {
  const [value, setValue] = useState("");

  const handleChange = (e) => {
    const newVal = e.target.value;
    setValue(newVal);
    if (onSearch) onSearch(newVal); // kirim ke parent
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative bg-white flex flex-row rounded-2xl p-1 gap-1 w-full md:w-[50%] border border-gray-300 shadow-sm"
    >
      <input
        type="text"
        placeholder="🔎Search"
        value={value}
        onChange={handleChange}
        className="w-full bg-white px-3 md:px-6 rounded-2xl text-sm border-0 focus:outline-none"
      />
    </form>
  );
}
