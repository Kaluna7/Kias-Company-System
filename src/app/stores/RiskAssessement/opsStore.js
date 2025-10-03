"use client";

import { create } from "zustand";


export const useOperationalStore = create((set) => ({
  operational: [],

  loadOperational: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/ops");
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
      const res = await fetch("/api/RiskAssessment/ops", {
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


  moveToDraft: async (id) => {
    set((state) => ({
      operational: state.operational.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/ops/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ operational: [updated, ...state.operational] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadOperational(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().operational;

    // update direcly on state
    set((state) => ({
      operational: state.operational.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/Ops/${id}/status`, {
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
        operational: state.operational.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ operational: prev });
      throw err;
    }
  },

}));

