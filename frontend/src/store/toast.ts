import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string) => void;
  dismissToast: (id: number) => void;
  clearToasts: () => void;
}

let nextId = 1;
// Cap the visible stack so a burst of errors can't fill the screen; keep newest.
const MAX_TOASTS = 5;

// Global, stackable toast notifications. Every addToast is a distinct entry (with
// its own id), so even identical consecutive messages stack and re-show.
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message) =>
    set((s) => ({
      toasts: [...s.toasts, { id: nextId++, message }].slice(-MAX_TOASTS),
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));
