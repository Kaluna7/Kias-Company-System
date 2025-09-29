"use client";
import { useState } from "react";
import { useNoteStore } from "../utils/store";
import { newFinanceDataPopUp } from "../utils/store"// 
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

// mapping label -> key
const LABEL_TO_KEY = {
  "Category": "category",
  "Sub Department": "sub_department",
  "SOP Related / Standard": "sop_related",
  "Risk Description": "risk_description",
  "Risk Details": "risk_details",
  "Impact Description": "impact_description",
  "Impact Level": "impact_level",
  "Probability Level": "probability_level",
  "Priority Level": "priority_level",
  "Mitigation Strategy": "mitigation_strategy",
  "Owner": "owners",
  "Root Cause Category": "root_cause_category",
  "Onset TimeFrame": "onset_timeframe",
};

const NUMERIC_FIELDS = new Set(["impact_level", "probability_level", "priority_level"]);
const TEXTAREA_LABELS = new Set(["Risk Details", "Mitigation Strategy", "Impact Description", "Risk Description"]);

export function NewFinanceInput({ onClose }) {
  const createFinance = useFinanceStore((s) => s.createFinance);

  const initialForm = Object.values(LABEL_TO_KEY).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const onSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { ...form };
      for (const nf of NUMERIC_FIELDS) {
        if (payload[nf] === "") payload[nf] = null;
        else payload[nf] = Number(payload[nf]);
      }

      await createFinance(payload);
      setLoading(false);
      onClose();
      setForm(initialForm);
    } catch (err) {
      setError(err?.message || "Gagal menyimpan data");
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
   
      <div className="bg-gray-50 w-full rounded-2xl p-6 h-[28rem] max-h-[28rem]">
        <div
          className="w-full h-full overflow-y-auto pr-2"
          style={{ scrollbarGutter: "stable" }}
        >   
          <div className="grid grid-cols-4 gap-4 items-start">
            {ListAssessmentForm.map((item, idx) => {
              const label = item.label;
              const key = LABEL_TO_KEY[label];
              if (!key) return null;

              const isTextarea = TEXTAREA_LABELS.has(label);
              const isNumber = NUMERIC_FIELDS.has(key);

              if (isTextarea) {              
                return (
                  <div key={idx} className="col-span-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
                    <textarea
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-3 rounded resize-y min-h-[5rem] max-h-[14rem] border"
                    />
                  </div>
                );
              }             
              return (
                <React.Fragment key={idx}>
                  <div className="col-span-1 flex items-center">
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                  </div>

                  <div className="col-span-3">
                    <input
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-2 rounded h-10 border"
                      type={isNumber ? "number" : "text"}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="flex flex-row gap-6">
        <button
          onClick={onSave}
          disabled={loading}
          className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button onClick={onClose} className="bg-gray-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">
          Close
        </button>
      </div>
    </div>
  );
}



// ACCOUNTING INPUT POP UP

import { useAccountingStore } from "../utils/store";

export function NewAccountingInput({ onClose }) {
  const createAccounting = useAccountingStore((s) => s.createAccounting);

  const initialForm = Object.values(LABEL_TO_KEY).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const onSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { ...form };
      for (const nf of NUMERIC_FIELDS) {
        if (payload[nf] === "") payload[nf] = null;
        else payload[nf] = Number(payload[nf]);
      }

      await createAccounting(payload);
      setLoading(false);
      onClose();
      setForm(initialForm);
    } catch (err) {
      setError(err?.message || "Gagal menyimpan data");
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
   
      <div className="bg-gray-50 w-full rounded-2xl p-6 h-[28rem] max-h-[28rem]">
        <div
          className="w-full h-full overflow-y-auto pr-2"
          style={{ scrollbarGutter: "stable" }}
        >   
          <div className="grid grid-cols-4 gap-4 items-start">
            {ListAssessmentForm.map((item, idx) => {
              const label = item.label;
              const key = LABEL_TO_KEY[label];
              if (!key) return null;

              const isTextarea = TEXTAREA_LABELS.has(label);
              const isNumber = NUMERIC_FIELDS.has(key);

              if (isTextarea) {              
                return (
                  <div key={idx} className="col-span-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
                    <textarea
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-3 rounded resize-y min-h-[5rem] max-h-[14rem] border"
                    />
                  </div>
                );
              }             
              return (
                <React.Fragment key={idx}>
                  <div className="col-span-1 flex items-center">
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                  </div>

                  <div className="col-span-3">
                    <input
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-2 rounded h-10 border"
                      type={isNumber ? "number" : "text"}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="flex flex-row gap-6">
        <button
          onClick={onSave}
          disabled={loading}
          className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button onClick={onClose} className="bg-gray-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">
          Close
        </button>
      </div>
    </div>
  );
}


// HRD INPUT POP UP

import { useHrdStore } from "../utils/store";

export function NewHrdInput({ onClose }) {
  const createHrd = useHrdStore((s) => s.createHrd);

  const initialForm = Object.values(LABEL_TO_KEY).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const onSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { ...form };
      for (const nf of NUMERIC_FIELDS) {
        if (payload[nf] === "") payload[nf] = null;
        else payload[nf] = Number(payload[nf]);
      }

      await createHrd(payload);
      setLoading(false);
      onClose();
      setForm(initialForm);
    } catch (err) {
      setError(err?.message || "Gagal menyimpan data");
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
   
      <div className="bg-gray-50 w-full rounded-2xl p-6 h-[28rem] max-h-[28rem]">
        <div
          className="w-full h-full overflow-y-auto pr-2"
          style={{ scrollbarGutter: "stable" }}
        >   
          <div className="grid grid-cols-4 gap-4 items-start">
            {ListAssessmentForm.map((item, idx) => {
              const label = item.label;
              const key = LABEL_TO_KEY[label];
              if (!key) return null;

              const isTextarea = TEXTAREA_LABELS.has(label);
              const isNumber = NUMERIC_FIELDS.has(key);

              if (isTextarea) {              
                return (
                  <div key={idx} className="col-span-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
                    <textarea
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-3 rounded resize-y min-h-[5rem] max-h-[14rem] border"
                    />
                  </div>
                );
              }             
              return (
                <React.Fragment key={idx}>
                  <div className="col-span-1 flex items-center">
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                  </div>

                  <div className="col-span-3">
                    <input
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-2 rounded h-10 border"
                      type={isNumber ? "number" : "text"}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="flex flex-row gap-6">
        <button
          onClick={onSave}
          disabled={loading}
          className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button onClick={onClose} className="bg-gray-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">
          Close
        </button>
      </div>
    </div>
  );
}


// GENERAL AFFAIR POP UP

import { useGeneralAffairStore } from "../utils/store";

export function NewGeneralAffairInput({ onClose }) {
  const createGeneralAffair = useGeneralAffairStore((s) => s.createGeneralAffair);

  const initialForm = Object.values(LABEL_TO_KEY).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const onSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { ...form };
      for (const nf of NUMERIC_FIELDS) {
        if (payload[nf] === "") payload[nf] = null;
        else payload[nf] = Number(payload[nf]);
      }

      await createGeneralAffair(payload);
      setLoading(false);
      onClose();
      setForm(initialForm);
    } catch (err) {
      setError(err?.message || "Gagal menyimpan data");
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
   
      <div className="bg-gray-50 w-full rounded-2xl p-6 h-[28rem] max-h-[28rem]">
        <div
          className="w-full h-full overflow-y-auto pr-2"
          style={{ scrollbarGutter: "stable" }}
        >   
          <div className="grid grid-cols-4 gap-4 items-start">
            {ListAssessmentForm.map((item, idx) => {
              const label = item.label;
              const key = LABEL_TO_KEY[label];
              if (!key) return null;

              const isTextarea = TEXTAREA_LABELS.has(label);
              const isNumber = NUMERIC_FIELDS.has(key);

              if (isTextarea) {              
                return (
                  <div key={idx} className="col-span-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
                    <textarea
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-3 rounded resize-y min-h-[5rem] max-h-[14rem] border"
                    />
                  </div>
                );
              }             
              return (
                <React.Fragment key={idx}>
                  <div className="col-span-1 flex items-center">
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                  </div>

                  <div className="col-span-3">
                    <input
                      value={form[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full p-2 rounded h-10 border"
                      type={isNumber ? "number" : "text"}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="flex flex-row gap-6">
        <button
          onClick={onSave}
          disabled={loading}
          className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button onClick={onClose} className="bg-gray-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">
          Close
        </button>
      </div>
    </div>
  );
}

// STORE DESIGN & PLANNING POP UP

export function NewSDPInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          <h1>SDP</h1>
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}

// TAX POP UP

export function NewTaxInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          <h1>TAX</h1>
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}

// LOSS & PREVENTION POP UP

export function NewLpInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          <h1>LOSS PREVENTION</h1>
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}

// MIS POP UP

export function NewMisInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          <h1>Mis</h1>
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}

// MERCHANDISE POP UP

export function NewMerchandiseInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          <h1>Merchandise</h1>
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}


// OPERATIONAL POP UP

export function NewOperationalInput({onClose}){
  return(
    <div className="absolute z-999 bg-[#141D38] h-full w-full max-h-[40rem] max-w-[70rem] left-55 top-15 p-6 flex flex-col items-center gap-4 rounded-2xl">
      <h1 className="text-white font-bold text-4xl">New Data</h1>
      <div className="bg-gray-50 h-full w-full rounded-2xl flex flex-col p-6 items-center justify-center">
        <div className="w-full h-full grid grid-cols-4 gap-6">
          <h1>Operational</h1>
        </div>
      </div>
      <div className="flex flex-row gap-6">
          <button onClick={"#"} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Save</button>
          <button onClick={onClose} className="bg-green-400 h-fit w-fit py-2 px-6 rounded-xl cursor-pointer">Close</button>
        </div>
    </div>
  );
}


// WAREHOUSE POP UP

export function NewWarehouseInput({onClose}){
  return(
    <></>
  );
}
