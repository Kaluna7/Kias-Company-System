"use client";

import { create } from "zustand";


export const useFinanceStore = create((set) => ({
  finance: [],

  loadFinance: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/finance");
      if (!res.ok) throw new Error("Failed to fetch finances");
      const data = await res.json();
      set({ finance: data });
      return data;
    } catch (err) {
      console.error("loadFinance error:", err);
      return [];
    }
  },

  createFinance: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create finance");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ finance: [newItem, ...state.finance] }));
      return newItem;
    } catch (err) {
      console.error("createFinance error:", err);
      throw err;
    }
  },
}));