"use client";

import { create } from "zustand";


export const useWarehouseStore = create((set) => ({
  warehouse: [],

  loadWarehouse: async () => {
    try {
      const res = await fetch("/api/RiskAssessment/whs");
      if (!res.ok) throw new Error("Failed to fetch warehouse");
      const data = await res.json();
      set({ warehouse: data });
      return data;
    } catch (err) {
      console.error("loadWarehouse error:", err);
      return [];
    }
  },

  createWarehouse: async (payload) => {
    try {
      const res = await fetch("/api/RiskAssessment/whs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to create warehouse");
      }
      const newItem = await res.json();
      // newItem already contains risk_code from server
      set((state) => ({ warehouse: [newItem, ...state.warehouse] }));
      return newItem;
    } catch (err) {
      console.error("createWarehouse error:", err);
      throw err;
    }
  },
}));
