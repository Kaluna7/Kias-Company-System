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
}));