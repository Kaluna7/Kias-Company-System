"use client";

import { MyCalendar, Note } from "./Accessories";

export default function RightSidebar(){
    return(
        <div className="h-full w-[22%] bg-[#141D38] rounded-2xl flex flex-col p-4 gap-2 ">
            <MyCalendar />
            <Note />
        </div>
    );
}