"use client";
import { useState } from "react";
import { useNoteStore } from "../utils/store";
import { newFinanceDataPopUp } from "../utils/store";


// NOTEPAD

export function NewNotePad({ onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const addNote = useNoteStore((s) => s.addNote);

  async function handleSave(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!title.trim()) return; 

    try {
      await addNote(title, description);
      setTitle("");
      setDescription("");
      onClose();
    } catch (err) {
      console.error("Gagal menyimpan note:", err);
    }
  }

  return (
    <div className="bg-[#141D38] text-white rounded-2xl max-h-[60%] max-w-[30%] h-full w-full z-999 flex flex-col p-8 absolute top-[20%] right-[38%] items-center gap-2">
      <h1 className="font-bold text-4xl">New Note</h1>
      <div className="bg-white text-black w-full h-full rounded-2xl p-6 flex flex-col gap-6">
        <form onSubmit={handleSave} className="flex flex-col gap-4 ">
          <div className="flex flex-col gap-2">
            <legend className="font-bold">Title</legend>
            <input
              placeholder="Title..."
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 focus:outline-none rounded-lg inset-shadow-sm inset-shadow-black/30"
            />
          </div>
          <div className="flex flex-col gap-2">
            <legend className="font-bold">Description</legend>
            <input
              placeholder="Description..."
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 focus:outline-none rounded-lg inset-shadow-sm inset-shadow-black/30"
            />
          </div>

          <div className="flex flex-row gap-12 items-center justify-center mt-2">
            <button
              type="submit"
              className="bg-[#141D38] text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-[#141D38] text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



// STILL NOT DONE

export function EditNotePad({onClose}){

    const [ notes , setNotes ] = useState([]);
    const [ title , setTitle ] = useState("");
    const [ description , setDescription ] = useState("");


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

  function addNotes(){
    addNote;
    onClick;
  }
    
    return(
        <div className="bg-[#141D38] text-white rounded-2xl max-h-[60%] max-w-[30%] h-full w-full z-999 flex flex-col p-8 absolute top-[20%] right-[38%] items-center gap-2">
            <h1 className="font-bold text-4xl">New Note</h1>
            <div className="bg-white text-black w-full h-full rounded-2xl p-6 flex flex-col gap-6">
                <form className="flex flex-col gap-4 ">
                <div className="flex flex-col gap-2">
                    <legend className="font-bold">Title</legend>
                    <input placeholder="Title..." type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 focus:outline-none rounded-lg inset-shadow-sm inset-shadow-black/30"></input>
                </div>
                <div className="flex flex-col gap-2">
                    <legend className="font-bold">Description</legend>
                    <input placeholder="Description..." type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 focus:outline-none rounded-lg inset-shadow-sm inset-shadow-black/30"></input>
                </div>
            </form>
            <div className="flex flex-row gap-12 items-center justify-center">
                <button onClick={addNotes} className="bg-[#141D38] text-white px-4 py-2 rounded-xl font-bold cursor-pointer">Save</button>
                <button onClick={onClose} className="bg-[#141D38] text-white px-4 py-2 rounded-xl font-bold cursor-pointer">Cancel</button>
            </div>
            </div>
        </div>
    );
}

// VIEW NOTE

export function ViewNote({onClose}){
    
    return(
        <div className="bg-[#141D38] text-white rounded-2xl max-h-[60%] max-w-[30%] h-full w-full z-999 flex flex-col p-8 absolute top-[20%] right-[38%] items-center gap-2">
            <h1 className="font-bold text-4xl">Note</h1>
            <div className="bg-white text-black w-full h-full rounded-2xl p-6 flex flex-col gap-6">
                 <h1>hi</h1>
            <div className="flex flex-row gap-12 items-center justify-center">
                <button onClick={onClose} className="bg-[#141D38] text-white px-4 py-2 rounded-xl font-bold cursor-pointer">Cancel</button>
            </div>
            </div>
        </div>
    );
}


// FINANCE INPUT POP UP

import { List } from "./List";
import { ListFinance } from "../data/Data";


export function NewFinanceInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          {ListFinance.map((item , index) => (
            <List key={index} {...item}/>
          ))}
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}

// ACCOUNTING INPUT POP UP

export function NewAccountingInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          {/* test */}
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}


// HRD INPUT POP UP

export function NewHrdInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          {/* test */}
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}