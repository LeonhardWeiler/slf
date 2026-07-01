import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useLobbyStore } from "@/store/lobby";

// Shared, prominent countdown shown to everyone while the host is disconnected.
// The lobby closes when it reaches zero unless the host reconnects (SRS 4.6/8.5).
export function HostGraceBanner() {
  const hostGrace = useLobbyStore((s) => s.hostGrace);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Absolute local deadline we tick down to. Kept in a ref so an interim
  // lobbyState broadcast that re-sends hostGrace can't reset our smooth
  // countdown on every arrival.
  const deadlineRef = useRef<number | null>(null);

  // Adopt the server's remaining time on first sight or when it diverges by
  // more than a second from what we're already showing; ignore sub-second
  // re-syncs so the visible number never jumps back a second (former UX-2).
  useEffect(() => {
    if (hostGrace == null) {
      deadlineRef.current = null;
      setRemaining(null);
      return;
    }
    const candidate = Date.now() + hostGrace * 1000;
    if (deadlineRef.current == null || Math.abs(candidate - deadlineRef.current) > 1000) {
      deadlineRef.current = candidate;
    }
    setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
  }, [hostGrace]);

  // Single, stable ticker independent of hostGrace changes.
  useEffect(() => {
    const id = setInterval(() => {
      if (deadlineRef.current == null) return;
      setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, []);

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
        className="flex items-center gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-5 py-2.5 text-base font-medium text-amber-700 shadow-lg backdrop-blur dark:text-amber-300"
      >
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>
          Host getrennt – Lobby schließt in{" "}
          <span className="tabular-nums font-bold">{remaining}s</span>
        </span>
      </div>
    </div>
  );
}
