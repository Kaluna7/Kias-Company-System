"use client";

import { create } from "zustand";

export const useStorePlanningStore = create((set, get) => ({
  sdp: [],
  currentFilter: "published",

  loadStorePlanning: async (status = "published") => {
    try {
      const res = await fetch(`/api/RiskAssessment/sdp?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch store planning");
      const data = await res.json();
      set({ sdp: data, currentFilter: status });
      return data;
    } catch (err) {
      console.error("loadStorePlanning error:", err);
      return [];
    }
  },

  createStorePlanning: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/sdp", {
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


  moveToDraft: async (id) => {
    set((state) => ({
      sdp: state.sdp.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/sdp/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ sdp: [updated, ...state.sdp] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadStorePlanning(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().sdp;

    // update direcly on state
    set((state) => ({
      sdp: state.sdp.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/sdp/${id}/status`, {
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
        sdp: state.sdp.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ sdp: prev });
      throw err;
    }
  },

}));


