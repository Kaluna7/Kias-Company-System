"use client";

import { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export function MyCalendar() {
  const [value, setValue] = useState(new Date());

  return (
    <div className="text-[12px] flex flex-col">
      <h1 className="font-bold text-white text-lg">Calendar</h1>
      <Calendar onChange={setValue} value={value} className="rounded-2xl"z/>
    </div>
  );
}



export function Note(){
  return(
    <div className="flex flex-col text-white h-full w-full">
      <h1 className="font-bold text-lg">Note</h1>
      <div className="h-full w-full bg-white rounded-2xl text-black p-2">
        <h1>ext</h1>
      </div>
    </div>
  );
}