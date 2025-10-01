"use client";
import { useState } from "react";
import { useNoteStore } from "../utils/store";

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

import React from "react";
import { ListAssessmentForm } from "../data/Data";
import { useFinanceStore } from "../utils/store";
import { GenericInputModal } from "./GenericInput";
import { LABEL_TO_KEY, NUMERIC_FIELDS,TEXTAREA_LABELS } from "../data/Data";

export function NewFinanceInput({onClose}){

  return (
   <GenericInputModal
  onClose={onClose}
  createItem={useFinanceStore.getState().createFinance}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
);
}


// ACCOUNTING INPUT POP UP

import { useAccountingStore } from "../utils/store";

export function NewAccountingInput({ onClose }) {
  return (
  <GenericInputModal
  onClose={onClose}
  createItem={useAccountingStore.getState().createAccounting}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}



// HRD INPUT POP UP

import { useHrdStore } from "../utils/store";

export function NewHrdInput({ onClose }) {

  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useHrdStore.getState().createHrd}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}



// GENERAL AFFAIR POP UP

import { useGeneralAffairStore } from "../utils/store";

export function NewGeneralAffairInput({ onClose }) {
 
  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useGeneralAffairStore.getState().createGeneralAffair}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// STORE DESIGN & PLANNING POP UP


import { useStorePlanningStore } from "../utils/store";

export function NewSDPInput({ onClose }) {
  
  return (
   <GenericInputModal
  onClose={onClose}
  createItem={useStorePlanningStore.getState().createStorePlanning}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// TAX POP UP

import { useTaxStore } from "../utils/store";

export function NewTaxInput({ onClose }) {
 
  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useTaxStore.getState().createTax}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// LOSS & PREVENTION POP UP

import { useLossPreventionStore } from "../utils/store";

export function NewLpInput({ onClose }) {
 
  return (
     <GenericInputModal
  onClose={onClose}
  createItem={useLossPreventionStore.getState().createLossPrevention}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// MIS POP UP

import { useMisStore } from "../utils/store";

export function NewMisInput({ onClose }) {
 
  return (
     <GenericInputModal
  onClose={onClose}
  createItem={useMisStore.getState().createMis}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// MERCHANDISE POP UP

import { useMerchandiseStore } from "../utils/store";

export function NewMerchandiseInput({ onClose }) {

  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useMerchandiseStore.getState().createMerchandise}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}



// OPERATIONAL POP UP

import { useOperationalStore } from "../utils/store";

export function NewOperationalInput({ onClose }) {
  
  return (
   <GenericInputModal
  onClose={onClose}
  createItem={useOperationalStore.getState().createOperational}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}


// WAREHOUSE POP UP

import { useWarehouseStore } from "../utils/store";

export function NewWarehouseInput({ onClose }) {
 
  return (
    <GenericInputModal
  onClose={onClose}
  createItem={useWarehouseStore.getState().createWarehouse}
  title="New Data"
  listForm={ListAssessmentForm}
  labelToKey={LABEL_TO_KEY}
  numericFields={NUMERIC_FIELDS}
  textareaLabels={TEXTAREA_LABELS}
/>
  );
}
