"use client";

import { create } from "zustand";


export const useTaxStore = create((set) => ({
  tax: [],

  loadTax: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/tax");
      if (!res.ok) throw new Error("Failed to fetch tax");
      const data = await res.json();
      set({ tax: data });
      return data;
    } catch (err) {
      console.error("loadTax error:", err);
      return [];
    }
  },

  createTax: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create tax");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ tax: [newItem, ...state.tax] }));
      return newItem;
    } catch (err) {
      console.error("createTax error:", err);
      throw err;
    }
  },
}));