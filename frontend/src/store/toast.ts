import { create } from "zustand";

export type ToastVariant = "error" | "info";

export interface Toast {
	id: number;
	message: string;
	variant: ToastVariant;
}

interface ToastStore {
	toasts: Toast[];
	// Counts error toasts only, so an info toast leaves a pending action alone.
	errorSeq: number;
	// While set, the next server error goes here instead of a toast.
	errorSink: ((message: string) => void) | null;
	setErrorSink: (fn: ((message: string) => void) | null) => void;
	addToast: (message: string, variant?: ToastVariant) => void;
	dismissToast: (id: number) => void;
	clearToasts: () => void;
}

let nextId = 1;
const MAX_TOASTS = 5;

export const useToastStore = create<ToastStore>((set) => ({
	toasts: [],
	errorSeq: 0,
	errorSink: null,
	setErrorSink: (fn) => set({ errorSink: fn }),
	addToast: (message, variant = "error") =>
		set((s) => ({
			toasts: [...s.toasts, { id: nextId++, message, variant }].slice(
				-MAX_TOASTS,
			),
			errorSeq: s.errorSeq + (variant === "error" ? 1 : 0),
		})),
	dismissToast: (id) =>
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
	clearToasts: () => set({ toasts: [] }),
}));
