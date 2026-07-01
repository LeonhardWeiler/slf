import { create } from "zustand";

export type ToastVariant = "error" | "info";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  // Monotonic count of *error* toasts ever shown (never decreases on dismiss).
  // The Home submit spinner keys off this so a real error stops it, while
  // neutral "info" toasts (e.g. "reconnected") leave a pending action alone.
  errorSeq: number;
  // Optional sink: while set, the next server error is delivered here (inline at
  // a form field) instead of shown as a toast. The join-name step uses it so its
  // error appears at the field — like the lobby-code step — rather than as a
  // transient toast.
  errorSink: ((message: string) => void) | null;
  setErrorSink: (fn: ((message: string) => void) | null) => void;
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
  errorSeq: 0,
  errorSink: null,
  setErrorSink: (fn) => set({ errorSink: fn }),
  addToast: (message, variant = "error") =>
    set((s) => ({
      toasts: [...s.toasts, { id: nextId++, message, variant }].slice(-MAX_TOASTS),
      errorSeq: s.errorSeq + (variant === "error" ? 1 : 0),
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));
