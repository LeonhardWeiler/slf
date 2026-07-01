import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useLobbyStore } from "@/store/lobby";

// Shared, prominent countdown shown to everyone while the host is disconnected.
// The lobby closes when it reaches zero unless the host reconnects (SRS 4.6/8.5).
export function HostGraceBanner() {
  const hostGrace = useLobbyStore((s) => s.hostGrace);
  const [remaining, setRemaining] = useState<number | null>(hostGrace);

  useEffect(() => {
    if (hostGrace == null) {
      setRemaining(null);
      return;
    }
    setRemaining(hostGrace);
    const deadline = Date.now() + hostGrace * 1000;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [hostGrace]);

  if (remaining == null) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* The situation is announced once via a static live region; the ticking
          seconds are aria-hidden so screen readers aren't spammed every second. */}
      <span className="sr-only" role="alert">
        Host getrennt – die Lobby wird in Kürze geschlossen.
      </span>
      <div
        aria-hidden="true"
        className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-700 shadow-lg backdrop-blur dark:text-amber-300"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Host getrennt – Lobby schließt in{" "}
          <span className="tabular-nums font-bold">{remaining}s</span>
        </span>
      </div>
    </div>
  );
}
