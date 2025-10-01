"use client";

import { create } from "zustand";

export const useMisStore = create((set) => ({
  mis: [],

  loadMis: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/mis");
      if (!res.ok) throw new Error("Failed to fetch mis");
      const data = await res.json();
      set({ mis: data });
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
}));