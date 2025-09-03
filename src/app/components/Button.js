"use client"

import Image from "next/image";
import Link from "next/link";
import { FaPlus } from 'react-icons/fa';

export function ButtonRiskAssessment({ name, href, logo }) {
  return (
    <ul className="">
      <li>
        <Link href={href} className="rounded-2xl text-center bg-white flex flex-col items-center text-[#034f75] font-extrabold p-2 shadow-md">
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


export function Button({onClick,label}){
  return(
    <button onClick={onClick}>
      {label}
    </button>
  );
}