"use client";

import { create } from "zustand";


export const useWarehouseStore = create((set, get) => ({
  warehouse: [],
  currentFilter: "published",

  loadWarehouse: async (status = "published") => {
    try {
      const res = await fetch(`/api/RiskAssessment/whs?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch warehouse");
      const data = await res.json();
      set({ warehouse: data, currentFilter: status });
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


  moveToDraft: async (id) => {
    set((state) => ({
      warehouse: state.warehouse.filter((f) => f.risk_id !== id),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/whs/${id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to move to draft");
      }
      const updated = await res.json();
// If look the draft, add get item to list
      if (get().currentFilter === "draft") {
        set((state) => ({ warehouse: [updated, ...state.warehouse] }));
      }
      return updated;
    } catch (err) {
      console.error("moveToDraft error:", err);
      // roll back to load for more consistant
      get().loadWarehouse(get().currentFilter);
      throw err;
    }
  },

  // make update more optimized
  updateStatus: async (id, newStatus) => {
    // simpan dulu state lama
    const prev = get().warehouse;

    // update direcly on state
    set((state) => ({
      warehouse: state.warehouse.map((f) =>
        f.risk_id === id ? { ...f, status: newStatus } : f
      ),
    }));

    try {
      const res = await fetch(`/api/RiskAssessment/whs/${id}/status`, {
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
        warehouse: state.warehouse.map((f) =>
          f.risk_id === id ? updated : f
        ),
      }));
      return updated;
    } catch (err) {
      console.error("updateStatus error:", err);
      // rollback server more long if fail
      set({ warehouse: prev });
      throw err;
    }
  },

}));


