"use client";

import { useEffect, useState } from "react";
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

  const { notes , setNotes } = useState([]);
  const { title , setTitle } = useState("");
  const { description , setDescription } = useState("");


  useEffect(() => {
    fetch("/api/notes")
    .then((res) => res.json())
    .then((data) => setNotes(data));
  },[]);


  async function addNote(){
    const res = await fetch("/api/notes",{
      method : "POST",
      headers : {'Content-Type':'application/json'},
      body : JSON.stringify({title , description})
    });

    const newNote = await res.json();
    setNotes([...notes, newNote]);
    setTitle("");
    setDescription("");


    async function updateNote(id){
      const res = await fetch("/api/notes",{
        method : "PUT",
        headers : {'Content-type' : 'application/json'},
        body : JSON.stringify({id, title : 'Updated title', description : 'Updated Description'})
      });
      const updated = await res.json();
      setNotes(notes.map((n) => (n.id === id ? updated : n)));
    }


    async function deteleNote(id){
      const res = await fetch("/api/notes",{
        method : "DELETE",
        headers : {'Content-type' : 'application/json'},
        body : JSON.stringify({id})
      });
      setNotes(notes.filter((n) => n.id !== id));
    }
  }


  return(
    <div className="flex flex-col text-white h-full w-full gap-2">
      <div className="flex flex-row justify-between items-center">
        <h1 className="font-bold text-lg">Note</h1>
        <button className="bg-white text-black px-2 rounded-xl">New</button>
      </div>
      <div className="h-full w-full bg-white rounded-2xl text-black p-2">
        
      </div>
    </div>
  );
}