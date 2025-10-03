"use client";

import { create } from "zustand";

export const useHrdStore = create((set) => ({
  hrd: [],

  loadHrd: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/hrd");
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
      const res = await fetch("/api/RiskAssessment/hrd", {
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



  moveToDraft: async (id) => {
    set((state) => ({
      hrd: state.hrd.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/hrd/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ hrd: [updated, ...state.hrd] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadHrd(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().hrd;

    // update direcly on state
    set((state) => ({
      hrd: state.hrd.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/hrd/${id}/status`, {
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
        hrd: state.hrd.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ hrd: prev });
      throw err;
    }
  },

}));

