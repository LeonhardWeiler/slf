import { useEffect } from "react";
import { Trophy } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { isTypingTarget } from "@/lib/utils";
import { RoomHeader } from "@/components/RoomHeader";
import { LetterOverview } from "@/components/LetterOverview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RoundResultScreen() {
  const { lobby, myPlayerId } = useLobbyStore();
  const { result } = useGameStore();
  const isHost = useIsHost();

  // Host can start the next round with Enter. Ending the game stays button-only.
  useEffect(() => {
    if (!isHost) return;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return;
      if (e.key === "Enter") {
        ws.send({ type: "startNextRound", payload: {} });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHost]);

  if (!lobby || !result) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ergebnis wird geladen…</p>
      </div>
    );
  }

  const playerName = (id: string) =>
    lobby.players.find((p) => p.id === id)?.name ?? "?";
  const hasLeft = (id: string) =>
    lobby.players.find((p) => p.id === id)?.left ?? false;
  const roundPointsOf = (id: string) =>
    result.scores.find((s) => s.playerId === id)?.roundPoints ?? 0;

  const lettersLeft = result.remainingLetters.length;
  const usedLetters = new Set(result.usedLetters);
  const excludedLetters = new Set(lobby.settings.excludedLetters);

  return (
    <div className="min-h-svh bg-background screen-pad">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <RoomHeader title="Rundenergebnis" subtitle={`Buchstabe ${result.letter}`} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zwischenstand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.ranking.map((r) => (
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
                    <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium">
                    {playerName(r.playerId)}
                    {r.playerId === myPlayerId && (
                      <span className="text-xs text-muted-foreground"> (du)</span>
                    )}
                    {hasLeft(r.playerId) && (
                      <span className="text-xs text-muted-foreground"> (verlassen)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium">
                    +{roundPointsOf(r.playerId)}
                  </span>
                  <span className="text-sm font-bold tabular-nums w-10 text-right">
                    {r.score}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Buchstaben</CardTitle>
          </CardHeader>
          <CardContent>
            <LetterOverview used={usedLetters} excluded={excludedLetters} />
          </CardContent>
        </Card>

        {isHost ? (
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => ws.send({ type: "startNextRound", payload: {} })}
            >
              {lettersLeft > 0 ? "Nächste Runde (Enter)" : "Spiel abschließen (Enter)"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => ws.send({ type: "endGame", payload: {} })}
            >
              Spiel beenden
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Warte auf den Host…
          </p>
        )}
      </div>
    </div>
  );
}
