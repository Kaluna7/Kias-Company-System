// app/stores/AuditProgram/taxStore.js
import { create } from "zustand";

const API_BASE = "/api/AuditProgram/tax";

export const useTaxStore = create((set, get) => ({
  data: [],
  loading: false,
  error: null,
  meta: { total: 0, page: 1, pageSize: 50 },
  search: "",
  sortBy: "risk_id_no",
  sortDir: "asc",

  fetchTaxData: async ({ page = 1, pageSize = 50, q = "", status, year } = {}) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (year) params.set("year", String(year));

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
      console.error("Tax fetch error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },

  setSort: (sortBy, sortDir) => {
    set({
      sortBy,
      sortDir,
    });
  },

  setData: (data) => {
    set({ data, loading: false, error: null });
  },

  createTaxAp: async (payload) => {
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
      await get().fetchTaxData();
      set({ loading: false });
      return json;
    } catch (err) {
      console.error("Tax create error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },

  moveToDraft: async (risk_id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/${risk_id}/draft`, {
        method: "PUT",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
      const updated = await res.json();
      set((state) => ({
        data: (state.data || []).filter((row) => row.risk_id !== risk_id),
        loading: false,
      }));
      return updated;
    } catch (err) {
      console.error("Tax moveToDraft error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },

  moveToPublish: async (risk_id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/${risk_id}/publish`, {
        method: "PUT",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
      const updated = await res.json();
      // Hapus record yang sudah di-publish dari daftar draft
      set((state) => ({
        data: (state.data || []).filter((row) => row.risk_id !== risk_id),
        loading: false,
      }));
      return updated;
    } catch (err) {
      console.error("Tax moveToPublish error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },
}));

