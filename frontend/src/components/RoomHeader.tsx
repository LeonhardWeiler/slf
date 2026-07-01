import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Copy } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { Button } from "@/components/ui/button";

export function RoomHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const navigate = useNavigate();
  const { reset, lobby } = useLobbyStore();
  const [copied, setCopied] = useState(false);

  const code = lobby?.lobbyCode ?? "";

  function copyCode() {
    if (!code) return;
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* clipboard unavailable (e.g. insecure context) — ignore */
      });
  }

  function handleLeave() {
    ws.send({ type: "leaveLobby", payload: {} });
    useGameStore.getState().resetGame();
    reset();
    void navigate("/");
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        {code && (
          // The lobby code stays visible and copyable on every in-game screen,
          // not just in the lobby, so latecomers can still be invited.
          <button
            type="button"
            onClick={copyCode}
            title="Lobbycode kopieren"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
          >
            <span className="font-mono font-medium tracking-wider">
              {code.replace(/(\d{3})(\d{3})/, "$1 $2")}
            </span>
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ConnectionBadge />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleLeave}>
          Verlassen
        </Button>
      </div>
    </div>
  );
}
