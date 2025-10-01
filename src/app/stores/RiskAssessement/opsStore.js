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
}));