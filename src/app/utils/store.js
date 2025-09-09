"use client";

import { create } from "zustand";

// ADD NEW NOTE POP-UP
export const usePopUp = create((set) => ({
  isOpen: false,
  openPopUp: () => set({ isOpen: true }),
  closePopUp: () => set({ isOpen: false }),
}));

// VIEW NOTE POP-UP
export const viewPopUp = create((set) => ({
  isViewOpen: false,
  openViewPopUp: () => set({ isViewOpen: true }),
  closeViewPopUp: () => set({ isViewOpen: false }),
}));

//NEW FINANCE DATA POP UP
export const newFinanceDataPopUp = create((set) => ({
  isNewFinanceOpen: false,
  openNewFinance: () => set({ isNewFinanceOpen: true }),
  closeNewFinance: () => set({ isNewFinanceOpen: false }),
}));

// store/useNoteStore.js

export const useNoteStore = create((set) => ({
  notes: [],

  fetchNotes: async () => {
    const res = await fetch("/api/notes");
    const data = await res.json();
    set({ notes: data });
  },

  addNote: async (title, description) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const newNote = await res.json();
    set((state) => ({ notes: [...state.notes, newNote] }));
    return newNote;
  },

  // sekarang menerima title & description
  updateNote: async (id, title, description) => {
    const res = await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({ id, title, description }),
    });
    const updated = await res.json();
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? updated : n)),
    }));
    return updated;
  },

  deleteNote: async (id) => {
    await fetch("/api/notes", {
      method: "DELETE",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
  },
}));

// FINANCE
export const useFinanceStore = create((set) => ({
  finance: [],

  fetchFinance: async () => {
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        risk_id,
        category,
        sub_department,
        risk_description,
        sop_related,
        risk_details,
        impact_description,
        impact_level,
        probability_level,
        priority_level,
        mitigation_strategy,
        owners,
        root_cause_category,
        onset_timeframe,
      }),
    });
    const newFinance = await res.json();
    set((state) => ({ finance: [...state.finance, newFinance] }));
    return newFinance;
  },
}));
