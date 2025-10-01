"use client";

import { create } from "zustand";

export const useAccountingStore = create((set) => ({
  accounting: [],

  loadAccounting: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/accounting");
      if (!res.ok) throw new Error("Failed to fetch accounting");
      const data = await res.json();
      set({ accounting: data });
      return data;
    } catch (err) {
      console.error("loadAccounting error:", err);
      return [];
    }
  },

  createAccounting: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create accounting");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ accounting: [newItem, ...state.accounting] }));
      return newItem;
    } catch (err) {
      console.error("createAccounitng error:", err);
      throw err;
    }
  },
}));
