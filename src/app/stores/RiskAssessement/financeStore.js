"use client";

import { create } from "zustand";


export const useFinanceStore = create((set , get) => ({
  finance: [],
  currentFilter: "published",

  loadFinance: async (status = "published") => {
    try {
      const res = await fetch(`/api/RiskAssessment/finance?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch finances");
      const data = await res.json();
      set({ finance: data, currentFilter: status });
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
      set((state) => ({ finance: [newItem, ...state.finance] }));
      return newItem;
    } catch (err) {
      console.error("createFinance error:", err);
      throw err;
    }
  },

  moveToDraft: async (id) => {
    try {
      const res = await fetch(`/api/RiskAssessment/finance/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to move to draft");
      const updated = await res.json();
      set((state) => ({
        finance: state.finance.filter((f) => f.risk_id !== id), 
      }));
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      throw err;
    }
  },

  updateStatus: async (id, newStatus) => {
    const prev = get().finance;

    set((state) => ({
      finance: state.finance.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/finance/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to update status");
      }
      const updated = await res.json();
      set((state) => ({
        finance: state.finance.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      set({ finance: prev });
      throw err;
    }
  },
}));
