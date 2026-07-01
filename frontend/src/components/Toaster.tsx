import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useToastStore, type Toast } from "@/store/toast";

const AUTO_DISMISS_MS = 3000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismissToast);
  // Pause the auto-dismiss while the user hovers or focuses the toast, so a long
  // message can be read (or reached with the keyboard) without it vanishing.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast.id, dismiss, paused]);

  return (
    <button
      type="button"
      onClick={() => dismiss(toast.id)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      title="Schließen"
      className="pointer-events-auto flex w-full items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive shadow-lg backdrop-blur transition-colors hover:bg-destructive/20 animate-fade-in"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <X className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
    </button>
  );
}

// Stacking toast notifications, top-right. Each toast auto-dismisses after a few
// seconds or on click; when several are stacked, a "clear all" control appears.
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const clearToasts = useToastStore((s) => s.clearToasts);

  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col items-end gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      {toasts.length > 1 && (
        <button
          type="button"
          onClick={clearToasts}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Alle schließen <X className="h-3 w-3" />
        </button>
      )}
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
