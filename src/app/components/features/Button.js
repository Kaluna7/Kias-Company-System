"use client";

import Image from "next/image";
import Link from "next/link";
import { BsSearch } from "react-icons/bs";
import { useRef, useEffect } from "react";

export function ButtonRiskAssessment({ name, href, logo }) {
  return (
    <ul>
      <li>
        <Link
          href={href}
          className="rounded-2xl text-center bg-white flex flex-col items-center text-[#034f75] font-extrabold py-5 shadow-md text-[14px] px-10 gap-2 hover:scale-98"
        >
          <Image src={logo} width={120} height={120} alt={name} />
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
        className="px-4 py-2 text-white rounded-lg flex flex-row items-center gap-1 text-sm cursor-pointer hover:text-yellow-400 hover:scale-98"
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-40 bg-[#141D38] rounded-lg z-10 text-sm shadow-md shadow-black text-white">
          {items.map((item, idx) => (
            <button
              key={item.id ?? `${item.name}-${idx}`}
              className="block w-full text-left px-4 py-2 hover:bg-[#4c4c54] rounded-lg hover:cursor-pointer"
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

export function Search() {
  return (
    <div className="relative bg-white flex flex-row rounded-2xl p-1 gap-1 w-[30%]">
      <input
        type="text"
        placeholder="Search..."
        className="w-full bg-white px-6 rounded-2xl"
      />
      <button className="p-1 bg-yellow-300 rounded-2xl cursor-pointer">
        <BsSearch />
      </button>
    </div>
  );
}
