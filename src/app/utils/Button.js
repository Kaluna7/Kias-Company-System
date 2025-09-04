"use client"

import Image from "next/image";
import Link from "next/link";
import { FaPlus } from 'react-icons/fa';
import { BsSearch } from 'react-icons/bs';
import { useState } from "react";
import { BiDownArrow } from 'react-icons/bi';

export function ButtonRiskAssessment({ name, href, logo }) {
  return (
    <ul>
      <li>
        <Link href={href} className="rounded-2xl text-center bg-white flex flex-col items-center text-[#034f75] font-extrabold py-4 shadow-md text-[14px] px-6 gap-2 hover:scale-98">
          <Image 
            src={logo}
            width={120}
            height={120}
            alt={name}
          />
          {name}
        </Link>
      </li>
    </ul>
  );
}


export function Button({onClick,label,style}){
  return(
    <button onClick={onClick} className={style}>
      {label}
    </button>
  );
}


export function DropDown({onClick}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 text-white rounded-lg flex flex-row items-center gap-1 text-sm cursor-pointer hover:text-yellow-400 hover:scale-98"
      >
        View <BiDownArrow />
      </button>
      {open && (
        <div className="absolute mt-2 w-40 bg-white border rounded-lg shadow-lg z-10">
          <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={onClick}>
            Test
          </button>
          <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={onClick}>
            test
          </button>
          <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={onClick}>
            test
          </button>
        </div>
      )}
    </div>
  );
}


export function Search(){
  return(
  <div className="relative bg-white flex flex-row rounded-2xl p-1 gap-1 w-[30%]">
  <input type="text" placeholder="Search..." 
         class="w-full bg-white px-6 rounded-2xl" />
    <button className="p-1 bg-yellow-300 rounded-2xl cursor-pointer"><BsSearch /></button>
</div>
  );
}