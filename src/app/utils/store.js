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



//NOTEPAD

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

  loadFinance: async () => {
    try {
      const res = await fetch("/api/finance");
      if (!res.ok) throw new Error("Failed to fetch finances");
      const data = await res.json();
      set({ finance: data });
      return data;
    } catch (err) {
      console.error("loadFinance error:", err);
      return [];
    }
  },

  createFinance: async (payload) => {
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create finance");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ finance: [newItem, ...state.finance] }));
      return newItem;
    } catch (err) {
      console.error("createFinance error:", err);
      throw err;
    }
  },
}));
