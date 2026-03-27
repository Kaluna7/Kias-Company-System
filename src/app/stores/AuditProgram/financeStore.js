// app/stores/AuditProgram/financeStore.js
import { create } from "zustand";

const API_BASE = "/api/AuditProgram/finance";

export const useFinanceStore = create((set, get) => ({
  data: [],
  loading: false,
  error: null,
  meta: { total: 0, page: 1, pageSize: 50 },
  search: "",
  sortBy: "risk_id_no",
  sortDir: "asc",

  fetchFinanceData: async ({ page = 1, pageSize = 50, q = "", status, year } = {}) => {
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
      console.error("Finance fetch error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },

  // ubah parameter sort (hanya di frontend, tidak panggil API baru)
  setSort: (sortBy, sortDir) => {
    set({
      sortBy,
      sortDir,
    });
  },

  // set data langsung (untuk SSR initial data)
  setData: (data) => {
    set({ data, loading: false, error: null });
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

  // pindahkan parent risk finance ke draft (seperti di Risk Assessment)
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

      // hapus semua baris yang punya risk_id tsb dari tabel saat ini
      set((state) => ({
        data: (state.data || []).filter((row) => row.risk_id !== risk_id),
        loading: false,
      }));

      return updated;
    } catch (err) {
      console.error("Finance moveToDraft error:", err);
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
      console.error("Finance moveToPublish error:", err);
      set({ loading: false, error: err.message ?? String(err) });
      throw err;
    }
  },
}));
