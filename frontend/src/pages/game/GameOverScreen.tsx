import { Trophy } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { RoomHeader } from "@/components/RoomHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GameOverScreen() {
  const { lobby, myPlayerId } = useLobbyStore();
  const { result } = useGameStore();

  if (!lobby) return null;

  const isHost = lobby.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
  const playerName = (id: string) =>
    lobby.players.find((p) => p.id === id)?.name ?? "?";
  const ranking = result?.ranking ?? [];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <RoomHeader title="Spiel beendet" />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Endstand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((r) => (
              <div
                key={r.playerId}
                className={`flex items-center justify-between py-2 px-3 rounded-md ${
                  r.rank === 1
                    ? "bg-amber-500/15 border border-amber-500/40"
                    : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5">
                    {r.rank}.
                  </span>
                  {r.rank === 1 && (
                    <Trophy className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-sm font-medium">
                    {playerName(r.playerId)}
                    {r.playerId === myPlayerId && (
                      <span className="text-xs text-muted-foreground"> (du)</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums">{r.score}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {isHost ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => ws.send({ type: "startGame", payload: {} })}
          >
            Neues Spiel
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Warte auf den Host für ein neues Spiel…
          </p>
        )}
      </div>
    </div>
  );
}
