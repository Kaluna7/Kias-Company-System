"use client"

import Image from "next/image";


export default function SmallSidebar(){
    return(
        <div className="h-screen w-12 flex flex-col items-center gap-16 bg-[#141D38] p-2 fixed z-100">
            <div className="text-white">
            <ul className="flex flex-col gap-8 mt-20">
                <li>
                    <a href="#">
                        <Image 
                            src= "/images/Home.png"
                            width={50}
                            height={50}
                            alt="kias logo"
                            className="hover:scale-90"
                        />
                    </a>
                </li>
                <li>
                    <a href="#">
                        <Image 
                            src= "/images/Calender.png"
                            width={50}
                            height={50}
                            alt="kias logo"
                            className="hover:scale-90"
                        />
                    </a>
                </li>
                <li>
                    <a href="#">
                        <Image 
                            src= "/images/Molekul.png"
                            width={50}
                            height={50}
                            alt="kias logo"
                            className="hover:scale-90"
                        />
                    </a>
                </li>
                <li>
                    <a href="#">
                        <Image 
                            src= "/images/Chart.png"
                            width={50}
                            height={50}
                            alt="kias logo"
                            className="hover:scale-90"
                        />
                    </a>
                </li>
            </ul>
            </div>
        </div>
    );
}