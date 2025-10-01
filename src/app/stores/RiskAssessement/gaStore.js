"use client";

import { create } from "zustand";

export const useGeneralAffairStore = create((set) => ({
  generalAffair: [],

  loadGeneralAffair: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/g&a");
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
}));
