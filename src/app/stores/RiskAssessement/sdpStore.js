"use client";

import { create } from "zustand";

export const useStorePlanningStore = create((set) => ({
  sdp: [],

  loadStorePlanning: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/sdp");
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
}));
