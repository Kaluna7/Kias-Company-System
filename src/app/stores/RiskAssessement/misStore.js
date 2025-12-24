"use client";

import { create } from "zustand";

export const useMisStore = create((set, get) => ({
  mis: [],
  currentFilter: "published",

  loadMis: async (status = "published") => {
    try {
      const res = await fetch(`/api/RiskAssessment/mis?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch mis");
      const data = await res.json();
      set({ mis: data, currentFilter: status });
      return data;
    } catch (err) {
      console.error("loadMis error:", err);
      return [];
    }
  },

  createMis: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/mis", {
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


  moveToDraft: async (id) => {
    set((state) => ({
      mis: state.mis.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/mis/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ mis: [updated, ...state.mis] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadMis(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().mis;

    // update direcly on state
    set((state) => ({
      mis: state.mis.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/mis/${id}/status`, {
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
        mis: state.mis.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ mis: prev });
      throw err;
    }
  },

}));

