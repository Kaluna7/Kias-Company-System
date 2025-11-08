import { create } from "zustand";
const useUserStore = create((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  clearUser: () => set({ user: null }),
}));
export default useUserStore;
