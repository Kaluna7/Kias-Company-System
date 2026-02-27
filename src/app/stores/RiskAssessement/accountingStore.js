"use client";

import { create } from "zustand";

export const useAccountingStore = create((set, get) => ({
  accounting: [],
  meta: null,
  currentFilter: "published",

  setAccounting: (data) => set({ accounting: data }),
  setAccountingAndMeta: (data, meta) => set({ accounting: data, meta: meta ?? null }),

  loadAccounting: async (status = "published", page = 1, pageSize = 50) => {
    try {
      const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
      const res = await fetch(`/api/RiskAssessment/accounting?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch accounting");
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : json;
      set({ accounting: list, meta: json?.meta ?? null, currentFilter: status });
      return list;
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


  moveToDraft: async (id) => {
    set((state) => ({
      accounting: state.accounting.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/accounting/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ accounting: [updated, ...state.accounting] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadAccounting(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().accounting;

    // update direcly on state
    set((state) => ({
      accounting: state.accounting.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/accounting/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to update status");
      }
      const updated = await res.json();
     // replace with server version
      set((state) => ({
        accounting: state.accounting.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ accounting: prev });
      throw err;
    }
  },

}));

