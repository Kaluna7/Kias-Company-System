"use client";

import { create } from "zustand";

export const useMerchandiseStore = create((set) => ({
  merchandise: [],

  loadMerchandise: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/merch");
      if (!res.ok) throw new Error("Failed to fetch merchandise");
      const data = await res.json();
      set({ merchandise: data });
      return data;
    } catch (err) {
      console.error("loadMerchandise error:", err);
      return [];
    }
  },

  createMerchandise: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create merchandise");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ merchandise: [newItem, ...state.merchandise] }));
      return newItem;
    } catch (err) {
      console.error("createMerchandise error:", err);
      throw err;
    }
  },
}));