"use client";

import { create } from "zustand";


export const useLossPreventionStore = create((set, get) => ({
  lp: [],
  currentFilter: "published",

  loadLossPrevention: async (status = "published") => {
    try {
      const res = await fetch(`/api/RiskAssessment/l&p?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch loss prevention");
      const data = await res.json();
      set({ lp: data, currentFilter: status });
      return data;
    } catch (err) {
      console.error("loadLossPrevention error:", err);
      return [];
    }
  },

  createLossPrevention: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/l&p", {
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




  moveToDraft: async (id) => {
    set((state) => ({
      lp: state.lp.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/l&p/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ lp: [updated, ...state.lp] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadLossPrevention(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().lp;

    // update direcly on state
    set((state) => ({
      lp: state.lp.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/l&p/${id}/status`, {
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
        lp: state.lp.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ lp: prev });
      throw err;
    }
  },

}));

