"use client";

import Image from "next/image";
import { FaSignOutAlt } from 'react-icons/fa';

export default function LargeSidebar(){
    return(
        <div className="h-full max-w-[16%] w-full flex flex-col gap-20 p-6 rounded-2xl bg-[#141D38] ">
            <Image 
                src="/images/kias-logo.png"
                width={100}
                height={100}
                alt="kias logo"
                className="mx-auto"
            />

            <div className="text-white flex flex-col gap-40 justify-between items-center text-[16px]">
                <ul className="flex flex-col gap-8">
                    <li>
                        <a href="#" className="flex flex-row justify-start items-center gap-4 w-full py-1 px-2 rounded-2xl hover:bg-[#4c4c54] hover:scale-95">
                            <Image 
                                src="/images/Home.png"
                                width={40}
                                height={40}
                                alt="home"
                            />
                            Home
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex flex-row justify-start items-center gap-4 w-full py-2 px-2 rounded-2xl hover:bg-[#4c4c54] hover:scale-95">
                            <Image 
                                src="/images/Calender.png"
                                width={40}
                                height={40}
                                alt="calendar"
                            />
                            Calendar
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex flex-row justify-start items-center gap-4 w-full py-2 px-2 rounded-2xl hover:bg-[#4c4c54] hover:scale-95">
                            <Image 
                                src="/images/Molekul.png"
                                width={40}
                                height={40}
                                alt="molecule"
                            />
                            Molekul
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex flex-row justify-start items-center gap-4 w-full py-2 px-2 rounded-2xl hover:bg-[#4c4c54] hover:scale-95">
                            <Image 
                                src="/images/Chart.png"
                                width={40}
                                height={35}
                                alt="chart"
                            />
                            Chart
                        </a>
                    </li>
                </ul>
                {/* <a href="" className="flex flex-row justify-start items-center gap-2 text-lg">
                    <FaSignOutAlt />
                    Exit
                </a> */}
            </div>
        </div>
    );
}
