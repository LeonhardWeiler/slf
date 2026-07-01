import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useToastStore, type Toast } from "@/store/toast";

const AUTO_DISMISS_MS = 3000;

// How many toasts behind the front one peek out to signal "there are more".
const MAX_PEEK = 3;

// The front (newest) toast: fully readable, clickable to dismiss, and it runs the
// auto-dismiss timer. Once it goes, the next toast slides to the front and starts
// its own timer — so a stack drains one readable card at a time.
function FrontToast({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismissToast);
  // Pause the auto-dismiss while the user hovers or focuses, so a long message
  // can be read (or reached with the keyboard) without it vanishing.
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
      className="pointer-events-auto relative flex w-full items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive shadow-lg backdrop-blur transition-colors hover:bg-destructive/20 animate-fade-in"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{toast.message}</span>
    </button>
  );
}

// Stacking toast notifications, bottom-left. The newest sits in front and is the
// only readable one; older toasts fan out behind it (offset up + scaled + dimmed)
// so the user can tell several are queued without reading them. Clicking the
// front toast dismisses it; a "clear all" control appears only when >1 is stacked.
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const clearToasts = useToastStore((s) => s.clearToasts);

  if (toasts.length === 0) return null;

  const front = toasts[toasts.length - 1];
  // Toasts directly behind the front, nearest first, capped to a few peeks.
  const behind = toasts.slice(Math.max(0, toasts.length - 1 - MAX_PEEK), toasts.length - 1).reverse();

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex w-full max-w-sm flex-col items-start gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {toasts.length > 1 && (
        <button
          type="button"
          onClick={clearToasts}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Alle schließen ({toasts.length}) <X className="h-3 w-3" />
        </button>
      )}

      {/* The front toast defines the box size; the peeking cards are absolutely
          positioned to fill it and shifted up/back, so they poke out at the top. */}
      <div className="relative w-full">
        {behind.map((t, i) => {
          const depth = i + 1;
          return (
            <div
              key={t.id}
              aria-hidden="true"
              className="absolute inset-0 rounded-lg border border-destructive/40 bg-destructive/10 shadow-lg backdrop-blur"
              style={{
                transform: `translateY(-${depth * 7}px) scale(${1 - depth * 0.05})`,
                transformOrigin: "bottom center",
                opacity: 1 - depth * 0.2,
                zIndex: -depth,
              }}
            />
          );
        })}
        <FrontToast key={front.id} toast={front} />
      </div>
    </div>
  );
}
