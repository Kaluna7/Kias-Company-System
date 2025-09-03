"use client";

import { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export function MyCalendar() {
  const [value, setValue] = useState(new Date());

  return (
    <div className="p-2 flex justify-center text-[12px]">
      <Calendar onChange={setValue} value={value} className="rounded-2xl"/>
    </div>
  );
}
