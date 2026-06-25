import { create } from "zustand";

export interface ToastData {
  id: number;
  title: string;
  body?: string;
  icon?: string; // optional leading emoji
}

interface ToastState {
  toast: ToastData | null;
  show: (t: Omit<ToastData, "id">) => void;
  hide: () => void;
}

// Lightweight, app-wide in-app toast. Trigger from anywhere with
// `useToastStore.getState().show({ title, body })`; the <Toast/> host mounted
// in the (app) layout renders and auto-dismisses it.
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (t) => set({ toast: { ...t, id: Date.now() } }),
  hide: () => set({ toast: null }),
}));
