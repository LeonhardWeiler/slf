import { ws } from "@/lib/ws";
import { Check, X, ChevronLeft, ChevronRight, Link2, Link2Off } from "lucide-react";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { RoomHeader } from "@/components/RoomHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReviewScreen() {
  const { lobby, myPlayerId } = useLobbyStore();
  const { review } = useGameStore();

  if (!lobby || !review) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Bewertung wird geladen…</p>
      </div>
    );
  }

  const isHost = lobby.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
  const playerName = (id: string) =>
    lobby.players.find((p) => p.id === id)?.name ?? "?";
  const categoryName =
    lobby.categories[review.categoryIndex]?.name ?? "Kategorie";

  const isLast = review.categoryIndex >= review.categoryCount - 1;
  const isFirst = review.categoryIndex <= 0;

  function setValid(answerId: string, valid: boolean) {
    ws.send({ type: "setAnswerValidity", payload: { answerId, valid } });
  }
  function merge(sourceAnswerId: string, targetAnswerId: string) {
    if (targetAnswerId)
      ws.send({ type: "mergeAnswers", payload: { sourceAnswerId, targetAnswerId } });
  }
  function unmerge(answerId: string) {
    ws.send({ type: "unmergeAnswers", payload: { answerId } });
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <RoomHeader
          title="Bewertung"
          subtitle={isHost ? "Bewerte die Antworten" : "Der Host bewertet…"}
        />

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black">{review.letter}</span>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Kategorie {review.categoryIndex + 1}/{review.categoryCount}
                </p>
                <p className="text-lg font-semibold">{categoryName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Antworten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {review.answers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Keine Antworten in dieser Kategorie.
              </p>
            )}
            {review.answers.map((a) => {
              const merged = a.mergedInto !== "";
              return (
                <div
                  key={a.answerId}
                  className="rounded-md bg-muted/50 px-3 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        {playerName(a.playerId)}
                      </span>
                      <p
                        className={`font-medium truncate ${
                          a.valid ? "" : "line-through text-muted-foreground"
                        }`}
                      >
                        {a.value || "—"}
                      </p>
                      {merged && (
                        <p className="text-xs text-muted-foreground">
                          ↳ zusammengeführt mit {playerName(a.mergedInto)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold tabular-nums w-8 text-right">
                        {a.pointsPreview}
                      </span>
                      {isHost ? (
                        <Button
                          variant={a.valid ? "default" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          title={a.valid ? "Als ungültig markieren" : "Als gültig markieren"}
                          onClick={() => setValid(a.answerId, !a.valid)}
                        >
                          {a.valid ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <span
                          className={`text-xs ${
                            a.valid ? "text-green-600" : "text-muted-foreground"
                          }`}
                        >
                          {a.valid ? "gültig" : "ungültig"}
                        </span>
                      )}
                    </div>
                  </div>

                  {isHost && (
                    <div className="flex items-center gap-2 pt-1">
                      {merged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => unmerge(a.answerId)}
                        >
                          <Link2Off className="h-3.5 w-3.5 mr-1" />
                          Trennen
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Link2 className="h-3.5 w-3.5" />
                          <select
                            className="bg-background border border-border rounded px-1 py-0.5 text-xs"
                            value=""
                            onChange={(e) => merge(a.answerId, e.target.value)}
                          >
                            <option value="">zusammenführen mit…</option>
                            {review.answers
                              .filter(
                                (o) => o.answerId !== a.answerId && o.mergedInto === ""
                              )
                              .map((o) => (
                                <option key={o.answerId} value={o.answerId}>
                                  {playerName(o.playerId)}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {isHost ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => ws.send({ type: "previousCategory", payload: {} })}
              disabled={isFirst}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            {isLast ? (
              <Button
                className="flex-1"
                onClick={() => ws.send({ type: "finishReview", payload: {} })}
              >
                Bewertung abschließen
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={() => ws.send({ type: "nextCategory", payload: {} })}
              >
                Weiter
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
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
