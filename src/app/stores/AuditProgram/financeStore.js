// app/stores/AuditProgram/financeStore.js
import { create } from "zustand";

const API_BASE = "/api/AuditProgram/finance";

export const useFinanceStore = create((set, get) => ({
  data: [],
  loading: false,
  error: null,
  meta: { total: 0, page: 1, pageSize: 50 },
  search: "",

  fetchFinanceData: async ({ page = 1, pageSize = 50, q = "" } = {}) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q) params.set("q", q);

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
      const json = await res.json();
      set({
        data: json.data || [],
        meta: json.meta || { total: 0, page, pageSize },
        loading: false,
      });
      return json;
    } catch (err) {
      console.error("Finance fetch error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },

  createFinanceAp: async (payload) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
      const json = await res.json();
      // refresh after create
      await get().fetchFinanceData();
      set({ loading: false });
      return json;
    } catch (err) {
      console.error("Finance create error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },
}));
