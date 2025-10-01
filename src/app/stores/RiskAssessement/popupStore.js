"use client";

import { create } from "zustand";

export const usePopUp = create((set) => ({
  isOpen: false,
  openPopUp: () => set({ isOpen: true }),
  closePopUp: () => set({ isOpen: false }),
}));

export const viewPopUp = create((set) => ({
  isViewOpen: false,
  openViewPopUp: () => set({ isViewOpen: true }),
  closeViewPopUp: () => set({ isViewOpen: false }),
}));
