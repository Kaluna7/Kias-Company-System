"use client";

import { useState } from "react";
import "react-calendar/dist/Calendar.css";
import dynamic from "next/dynamic";

const Calendar = dynamic(() => import("react-calendar"), {
  ssr: false,
});

export function MyCalendar() {
  const [value, setValue] = useState(new Date());

  return (
    <div className="text-[12px] flex flex-col">
      <h1 className="font-bold text-white text-lg">Calendar</h1>
      <Calendar onChange={setValue} value={value} className="rounded-2xl" z />
    </div>
  );
}