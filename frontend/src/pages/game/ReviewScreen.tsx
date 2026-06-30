import { useEffect, useState } from "react";
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

  // The answer picked as the merge target ("group anchor"). The next answer the
  // host clicks is merged into it.
  const [mergeAnchor, setMergeAnchor] = useState<string | null>(null);

  const isHost =
    lobby?.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
  const isFirst = (review?.categoryIndex ?? 0) <= 0;
  const isLast = review
    ? review.categoryIndex >= review.categoryCount - 1
    : false;

  // Reset the pending merge selection whenever the reviewed category changes.
  useEffect(() => {
    setMergeAnchor(null);
  }, [review?.categoryIndex]);

  // Host can page through categories with the arrow keys (when not typing).
  useEffect(() => {
    if (!isHost) return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && !isFirst) {
        ws.send({ type: "previousCategory", payload: {} });
      } else if (e.key === "ArrowRight" && !isLast) {
        ws.send({ type: "nextCategory", payload: {} });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHost, isFirst, isLast]);

  if (!lobby || !review) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Bewertung wird geladen…</p>
      </div>
    );
  }

  const playerName = (id: string) =>
    lobby.players.find((p) => p.id === id)?.name ?? "?";
  const categoryName =
    lobby.categories[review.categoryIndex]?.name ?? "Kategorie";

  function setValid(answerId: string, valid: boolean) {
    ws.send({ type: "setAnswerValidity", payload: { answerId, valid } });
  }
  function unmerge(answerId: string) {
    ws.send({ type: "unmergeAnswers", payload: { answerId } });
  }

  // Click handling for the merge button on a single answer.
  function onMergeClick(answerId: string) {
    if (mergeAnchor === null) {
      setMergeAnchor(answerId); // first click picks the target group
    } else if (mergeAnchor === answerId) {
      setMergeAnchor(null); // clicking the anchor again cancels
    } else {
      ws.send({
        type: "mergeAnswers",
        payload: { targetAnswerId: mergeAnchor, sourceAnswerId: answerId },
      });
      setMergeAnchor(null);
    }
  }

  const mergeableCount = review.answers.filter((a) => a.mergedInto === "").length;

  return (
    <div className="min-h-screen bg-background p-4 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-4">
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
              const isAnchor = mergeAnchor === a.answerId;
              return (
                <div
                  key={a.answerId}
                  className={`rounded-md px-3 py-2 space-y-1 transition-colors ${
                    isAnchor
                      ? "bg-primary/10 ring-1 ring-primary"
                      : a.valid
                      ? "bg-green-500/10"
                      : "bg-muted/50"
                  }`}
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
                        // Action semantics: a valid answer shows an X (click to
                        // mark it invalid); an invalid one shows a check (click
                        // to accept it).
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-7 w-7 ${
                            a.valid
                              ? "text-destructive hover:text-destructive"
                              : "text-green-600 hover:text-green-600"
                          }`}
                          title={
                            a.valid
                              ? "Als ungültig markieren"
                              : "Als gültig akzeptieren"
                          }
                          onClick={() => setValid(a.answerId, !a.valid)}
                        >
                          {a.valid ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
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
                      ) : mergeableCount > 1 ? (
                        <Button
                          variant={isAnchor ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onMergeClick(a.answerId)}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                          {mergeAnchor === null
                            ? "Zusammenführen"
                            : isAnchor
                            ? "Abbrechen"
                            : "Hierher zusammenführen"}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
            {isHost && mergeAnchor !== null && (
              <p className="text-xs text-muted-foreground px-1">
                Wähle eine weitere Antwort, um sie mit „{playerName(
                  review.answers.find((a) => a.answerId === mergeAnchor)
                    ?.playerId ?? ""
                )}" zusammenzuführen.
              </p>
            )}
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
