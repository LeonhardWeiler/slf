import { useNavigate } from "react-router";
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
  const { reset } = useLobbyStore();

  function handleLeave() {
    ws.send({ type: "leaveLobby", payload: {} });
    useGameStore.getState().resetGame();
    reset();
    void navigate("/");
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <ConnectionBadge />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleLeave}>
          Verlassen
        </Button>
      </div>
    </div>
  );
}
