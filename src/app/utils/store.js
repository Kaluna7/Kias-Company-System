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



// FINANCE NEW DATA POP UP

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



// ACCOUNTING NEW DATA POP UP

export const useAccountingStore = create((set) => ({
  accounting: [],

  loadAccounting: async () => {
    try {
      const res = await fetch("/api/accounting");
      if (!res.ok) throw new Error("Failed to fetch accounting");
      const data = await res.json();
      set({ accounting: data });
      return data;
    } catch (err) {
      console.error("loadAccounting error:", err);
      return [];
    }
  },

  createAccounting: async (payload) => {
    try {
      const res = await fetch("/api/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create accounting");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ accounting: [newItem, ...state.accounting] }));
      return newItem;
    } catch (err) {
      console.error("createAccounitng error:", err);
      throw err;
    }
  },
}));



// HRD NEW DATA POP UP

export const useHrdStore = create((set) => ({
  hrd: [],

  loadHrd: async () => {
    try {
      const res = await fetch("/api/hrd");
      if (!res.ok) throw new Error("Failed to fetch Hrd");
      const data = await res.json();
      set({ hrd: data });
      return data;
    } catch (err) {
      console.error("loadHrd error:", err);
      return [];
    }
  },

  createHrd: async (payload) => {
    try {
      const res = await fetch("/api/hrd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create hrd");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ hrd: [newItem, ...state.hrd] }));
      return newItem;
    } catch (err) {
      console.error("createHrd error:", err);
      throw err;
    }
  },
}));



// GENERAL AFFAIR NEW DATA POP UP

export const useGeneralAffairStore = create((set) => ({
  generalAffair: [],

  loadGeneralAffair: async () => {
    try {
      const res = await fetch("/api/g&a");
      if (!res.ok) throw new Error("Failed to fetch general affair");
      const data = await res.json();
      set({ generalAffair: data });
      return data;
    } catch (err) {
      console.error("loadGeneralAffair error:", err);
      return [];
    }
  },

  createGeneralAffair: async (payload) => {
    try {
      const res = await fetch("/api/g&a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create general affair");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ generalAffair: [newItem, ...state.generalAffair] }));
      return newItem;
    } catch (err) {
      console.error("createGeneralAffair error:", err);
      throw err;
    }
  },
}));



// STORE DESIGN & PLANNING NEW DATA POP UP

export const useStorePlanningStore = create((set) => ({
  sdp: [],

  loadStorePlanning: async () => {
    try {
      const res = await fetch("/api/sdp");
      if (!res.ok) throw new Error("Failed to fetch store planning");
      const data = await res.json();
      set({ sdp: data });
      return data;
    } catch (err) {
      console.error("loadStorePlanning error:", err);
      return [];
    }
  },

  createStorePlanning: async (payload) => {
    try {
      const res = await fetch("/api/sdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create store design planning");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ sdp: [newItem, ...state.sdp] }));
      return newItem;
    } catch (err) {
      console.error("createStorePlanning error:", err);
      throw err;
    }
  },
}));




// TAX NEW DATA POP UP

export const useTaxStore = create((set) => ({
  tax: [],

  loadTax: async () => {
    try {
      const res = await fetch("/api/tax");
      if (!res.ok) throw new Error("Failed to fetch tax");
      const data = await res.json();
      set({ tax: data });
      return data;
    } catch (err) {
      console.error("loadTax error:", err);
      return [];
    }
  },

  createTax: async (payload) => {
    try {
      const res = await fetch("/api/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create tax");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ tax: [newItem, ...state.tax] }));
      return newItem;
    } catch (err) {
      console.error("createTax error:", err);
      throw err;
    }
  },
}));



// LOSS PREVENTION NEW DATA POP UP

export const useLossPreventionStore = create((set) => ({
  lp: [],

  loadLossPrevention: async () => {
    try {
      const res = await fetch("/api/l&p");
      if (!res.ok) throw new Error("Failed to fetch loss prevention");
      const data = await res.json();
      set({ lp: data });
      return data;
    } catch (err) {
      console.error("loadLossPrevention error:", err);
      return [];
    }
  },

  createLossPrevention: async (payload) => {
    try {
      const res = await fetch("/api/l&p", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create loss prevention");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ lp: [newItem, ...state.lp] }));
      return newItem;
    } catch (err) {
      console.error("createLossPrevention error:", err);
      throw err;
    }
  },
}));



// MIS NEW DATA POP UP

export const useMisStore = create((set) => ({
  mis: [],

  loadMis: async () => {
    try {
      const res = await fetch("/api/mis");
      if (!res.ok) throw new Error("Failed to fetch mis");
      const data = await res.json();
      set({ mis: data });
      return data;
    } catch (err) {
      console.error("loadMis error:", err);
      return [];
    }
  },

  createMis: async (payload) => {
    try {
      const res = await fetch("/api/mis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to mis");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ mis: [newItem, ...state.mis] }));
      return newItem;
    } catch (err) {
      console.error("createGeneralAffair error:", err);
      throw err;
    }
  },
}));




// MERCHANDISE NEW DATA POP UP

export const useMerchandiseStore = create((set) => ({
  merchandise: [],

  loadMerchandise: async () => {
    try {
      const res = await fetch("/api/merch");
      if (!res.ok) throw new Error("Failed to fetch merchandise");
      const data = await res.json();
      set({ merchandise: data });
      return data;
    } catch (err) {
      console.error("loadMerchandise error:", err);
      return [];
    }
  },

  createMerchandise: async (payload) => {
    try {
      const res = await fetch("/api/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create merchandise");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ merchandise: [newItem, ...state.merchandise] }));
      return newItem;
    } catch (err) {
      console.error("createMerchandise error:", err);
      throw err;
    }
  },
}));



// OPERATIONAL NEW DATA POP UP

export const useOperationalStore = create((set) => ({
  operational: [],

  loadOperational: async () => {
    try {
      const res = await fetch("/api/ops");
      if (!res.ok) throw new Error("Failed to fetch operational");
      const data = await res.json();
      set({ operational: data });
      return data;
    } catch (err) {
      console.error("loadOperational error:", err);
      return [];
    }
  },

  createOperational: async (payload) => {
    try {
      const res = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create operational");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ operational: [newItem, ...state.operational] }));
      return newItem;
    } catch (err) {
      console.error("createOperational error:", err);
      throw err;
    }
  },
}));



// WAREHOUSE NEW DATA POP UP

export const useWarehouseStore = create((set) => ({
  warehouse: [],

  loadWarehouse: async () => {
    try {
      const res = await fetch("/api/whs");
      if (!res.ok) throw new Error("Failed to fetch warehouse");
      const data = await res.json();
      set({ generalAffair: data });
      return data;
    } catch (err) {
      console.error("loadWarehouse error:", err);
      return [];
    }
  },

  createWarehouse: async (payload) => {
    try {
      const res = await fetch("/api/whs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create warehouse");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ warehouse: [newItem, ...state.warehouse] }));
      return newItem;
    } catch (err) {
      console.error("createWarehouse error:", err);
      throw err;
    }
  },
}));
