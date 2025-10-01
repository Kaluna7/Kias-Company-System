"use client";

import { create } from "zustand";


export const useLossPreventionStore = create((set) => ({
  lp: [],

  loadLossPrevention: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/l&p");
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
}));
