import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { ws } from "@/lib/ws";

// Small badge that appears only while the WebSocket is disconnected, so players
// get a clear signal if the connection drops mid-game (it auto-reconnects).
export function ConnectionBadge() {
  const [connected, setConnected] = useState(ws.status);
  useEffect(() => ws.onStatusChange(setConnected), []);

  if (connected) return null;
  return (
    <span
      role="status"
      className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">Verbindung getrennt…</span>
    </span>
  );
}
