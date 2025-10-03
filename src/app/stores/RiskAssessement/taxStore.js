"use client";

import { create } from "zustand";


export const useTaxStore = create((set) => ({
  tax: [],

  loadTax: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/tax");
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
      const res = await fetch("/api/RiskAssessment/tax", {
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


  moveToDraft: async (id) => {
    set((state) => ({
      tax: state.tax.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/tax/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ tax: [updated, ...state.tax] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadTax(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().tax;

    // update direcly on state
    set((state) => ({
      tax: state.tax.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/tax/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to update status");
      }
      const updated = await res.json();
     // replace with server version
      set((state) => ({
        tax: state.tax.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ tax: prev });
      throw err;
    }
  },

}));

