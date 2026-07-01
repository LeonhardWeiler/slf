import { create } from "zustand";

export type ToastVariant = "error" | "info";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  // Monotonic count of toasts ever added (never decreases on dismiss). Lets
  // consumers react to "a new toast appeared" without being fooled by removals.
  seq: number;
  addToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: number) => void;
  clearToasts: () => void;
}

let nextId = 1;
// Cap the visible stack so a burst of errors can't fill the screen; keep newest.
const MAX_TOASTS = 5;

// Global, stackable toast notifications. Every addToast is a distinct entry (with
// its own id), so even identical consecutive messages stack and re-show. Errors
// use the default "error" variant; neutral status updates pass "info".
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  seq: 0,
  addToast: (message, variant = "error") =>
    set((s) => ({
      toasts: [...s.toasts, { id: nextId++, message, variant }].slice(-MAX_TOASTS),
      seq: s.seq + 1,
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));
