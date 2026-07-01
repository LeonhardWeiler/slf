import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLobbyStore } from "@/store/lobby";

// Dismissable error banner for the Lobby and in-game screens. Server "error"
// events land in store.error but only Home renders them inline; this surfaces
// them everywhere else (rejected host actions, validation, category minimum …).
export function ErrorToast() {
  const { error, errorSeq, setError } = useLobbyStore();

  // Auto-dismiss after a while so a stale error does not linger forever. Keyed on
  // errorSeq so an identical consecutive error restarts the timer (bug-2).
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error, errorSeq, setError]);

  if (!error) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-lg backdrop-blur"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1">{error}</span>
        <button
          type="button"
          aria-label="Fehler schließen"
          onClick={() => setError(null)}
          className="-mr-1 rounded p-0.5 hover:bg-destructive/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
