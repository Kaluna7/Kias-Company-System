"use client";


import { create } from "zustand";

export const usePopUp = create((set) => ({
    isOpen : false,
    openPopUp : () => set({isOpen : true}),
    closePopUp : () => set({isOpen : false})
}));

export const viewPopUp = create((set) => ({
    isViewOpen : false,
    openViewPopUp : () => set({isViewOpen : true}),
    closeViewPopUp : () => set({isViewOpen : false})
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
