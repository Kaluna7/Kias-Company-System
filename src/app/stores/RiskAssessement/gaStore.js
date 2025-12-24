"use client";

import { create } from "zustand";

export const useGeneralAffairStore = create((set, get) => ({
  generalAffair: [],
  currentFilter: "published",

  loadGeneralAffair: async (status = "published") => {
    try {
      const res = await fetch(`/api/RiskAssessment/g&a?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch general affair");
      const data = await res.json();
      set({ generalAffair: data, currentFilter: status });
      return data;
    } catch (err) {
      console.error("loadGeneralAffair error:", err);
      return [];
    }
  },

  createGeneralAffair: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/g&a", {
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



  moveToDraft: async (id) => {
    set((state) => ({
      generalAffaair: state.generalAffaair.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/g&a/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ generalAffaair: [updated, ...state.generalAffaair] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadGeneralAffair(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().generalAffaair;

    // update direcly on state
    set((state) => ({
      generalAffaair: state.generalAffaair.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/g&a/${id}/status`, {
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
        generalAffaair: state.generalAffaair.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ generalAffaair: prev });
      throw err;
    }
  },

}));

