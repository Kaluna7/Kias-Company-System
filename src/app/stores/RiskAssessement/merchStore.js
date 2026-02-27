"use client";

import { create } from "zustand";

export const useMerchandiseStore = create((set, get) => ({
  merchandise: [],
  meta: null,
  currentFilter: "published",

  setMerchAndMeta: (data, meta) => set({ merchandise: data, meta: meta ?? null }),

  loadMerchandise: async (status = "published", page = 1, pageSize = 50) => {
    try {
      const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
      const res = await fetch(`/api/RiskAssessment/merch?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch merchandise");
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : json;
      set({ merchandise: list, meta: json?.meta ?? null, currentFilter: status });
      return list;
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


  moveToDraft: async (id) => {
    set((state) => ({
      merchandise: state.merchandise.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/merch/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ merchandise: [updated, ...state.merchandise] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadMerchandise(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().merchandise;

    // update direcly on state
    set((state) => ({
      merchandise: state.merchandise.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/merch/${id}/status`, {
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
        merchandise: state.merchandise.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ merchandise: prev });
      throw err;
    }
  },

}));

