import { useEffect } from "react";
import { Trophy } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { isTypingTarget } from "@/lib/utils";
import { RoomHeader } from "@/components/RoomHeader";
import { LetterOverview } from "@/components/LetterOverview";
import { useConfirm, isConfirmDialogOpen } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RoundResultScreen() {
  const lobby = useLobbyStore((s) => s.lobby);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);
  const result = useGameStore((s) => s.result);
  const isHost = useIsHost();
  const { confirm, dialog } = useConfirm();

  async function handleEndGame() {
    if (
      await confirm({
        title: "Spiel beenden?",
        description:
          "Das Spiel wird für alle beendet und der Endstand angezeigt.",
        confirmLabel: "Spiel beenden",
        destructive: true,
      })
    ) {
      ws.send({ type: "endGame", payload: {} });
    }
  }

  // Host can start the next round with Enter. Ending the game stays button-only.
  useEffect(() => {
    if (!isHost) return;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return;
      // Don't fire while a confirm dialog is up (e.g. "Spiel beenden?"), so the
      // Enter that confirms it doesn't also start the next round (UX-1).
      if (isConfirmDialogOpen()) return;
      // Ignore auto-repeat: holding Enter would send startNextRound many times.
      // The first advances the server past RoundResult, so the rest hit an
      // invalid state and surface a spurious "Aktion nicht erlaubt".
      if (e.repeat) return;
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
            {result.ranking.map((r) => {
              const roundPoints = roundPointsOf(r.playerId);
              return (
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
                  {/* Rundengewinn nur bei >0 in Erfolgs-Grün; ein Nullgewinn
                      wird neutral als „±0" gezeigt, nicht als grünes „+0". */}
                  <span
                    className={`text-xs font-medium ${
                      roundPoints === 0
                        ? "text-muted-foreground"
                        : "text-green-600"
                    }`}
                  >
                    {roundPoints === 0 ? "±0" : `+${roundPoints}`}
                  </span>
                  <span className="text-sm font-bold tabular-nums w-10 text-right">
                    {r.score}
                  </span>
                </div>
              </div>
              );
            })}
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
          // Nebeneinander ab sm; auf schmalen Screens gestapelt.
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="sm:flex-1"
              onClick={handleEndGame}
            >
              Spiel beenden
            </Button>
            <Button
              className="sm:flex-1"
              size="lg"
              onClick={() => ws.send({ type: "startNextRound", payload: {} })}
            >
              {lettersLeft > 0 ? "Nächste Runde (Enter)" : "Spiel abschließen (Enter)"}
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Warte auf den Host…
          </p>
        )}
      </div>
      {dialog}
    </div>
  );
}
