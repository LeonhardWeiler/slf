import { useEffect, useState } from "react";
import { ws } from "@/lib/ws";
import { Check, X, ChevronLeft, ChevronRight, Link2, Link2Off } from "lucide-react";
import { cn, isTypingTarget } from "@/lib/utils";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { RoomHeader } from "@/components/RoomHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReviewScreen() {
  const { lobby } = useLobbyStore();
  const { review } = useGameStore();

  // The answer picked as the merge target ("group anchor"). While set, the
  // host merges by clicking another answer's row directly (no second button).
  const [mergeAnchor, setMergeAnchor] = useState<string | null>(null);

  const isHost = useIsHost();
  const isFirst = (review?.categoryIndex ?? 0) <= 0;
  const isLast = review
    ? review.categoryIndex >= review.categoryCount - 1
    : false;

  // Reset the pending merge selection whenever the reviewed category changes.
  useEffect(() => {
    setMergeAnchor(null);
  }, [review?.categoryIndex]);

  // Host keyboard controls: arrows page through categories; Enter finishes the
  // review on the last category (otherwise advances), and cancels a pending
  // merge. Ending the game stays button-only.
  useEffect(() => {
    if (!isHost) return;
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return;
      if (e.key === "ArrowLeft" && !isFirst) {
        ws.send({ type: "previousCategory", payload: {} });
      } else if (e.key === "ArrowRight" && !isLast) {
        ws.send({ type: "nextCategory", payload: {} });
      } else if (e.key === "Enter") {
        if (mergeAnchor !== null) {
          setMergeAnchor(null);
        } else if (isLast) {
          ws.send({ type: "finishReview", payload: {} });
        } else {
          ws.send({ type: "nextCategory", payload: {} });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHost, isFirst, isLast, mergeAnchor]);

  if (!lobby || !review) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center">
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
  function mergeInto(sourceAnswerId: string) {
    if (mergeAnchor === null || mergeAnchor === sourceAnswerId) return;
    ws.send({
      type: "mergeAnswers",
      payload: { targetAnswerId: mergeAnchor, sourceAnswerId },
    });
    setMergeAnchor(null);
  }

  const mergeableCount = review.answers.filter((a) => a.mergedInto === "").length;
  const mergeMode = mergeAnchor !== null;

  return (
    <div className="min-h-svh bg-background screen-pad">
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
              const clickable = mergeMode && !isAnchor && !merged;
              return (
                <div
                  key={a.answerId}
                  onClick={clickable ? () => mergeInto(a.answerId) : undefined}
                  className={cn(
                    "rounded-md px-3 py-2.5 transition-colors",
                    isAnchor
                      ? "bg-primary/10 ring-2 ring-primary"
                      : a.valid
                      ? "bg-green-500/10"
                      : "bg-muted/50",
                    clickable &&
                      "cursor-pointer ring-1 ring-primary/40 hover:ring-2 hover:ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        {playerName(a.playerId)}
                      </span>
                      <p
                        className={cn(
                          "text-lg font-medium truncate",
                          a.valid
                            ? "text-foreground"
                            : "line-through text-muted-foreground"
                        )}
                      >
                        {a.value || "—"}
                      </p>
                      {merged && (
                        <p className="text-xs text-muted-foreground">
                          ↳ zusammengeführt mit {playerName(a.mergedInto)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={cn(
                          "text-lg font-bold tabular-nums w-8 text-right",
                          a.valid ? "" : "text-muted-foreground"
                        )}
                      >
                        {a.pointsPreview}
                      </span>
                      {isHost && (
                        // Action semantics: valid -> X (click to reject),
                        // invalid -> check (click to accept).
                        <Button
                          variant="outline"
                          size="icon"
                          className={cn(
                            "h-8 w-8",
                            a.valid
                              ? "text-destructive hover:text-destructive"
                              : "text-green-600 dark:text-green-500 hover:text-green-600"
                          )}
                          title={
                            a.valid
                              ? "Als ungültig markieren"
                              : "Als gültig akzeptieren"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setValid(a.answerId, !a.valid);
                          }}
                        >
                          {a.valid ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isHost && (merged || (!mergeMode && mergeableCount > 1) || isAnchor) && (
                    <div className="mt-1.5">
                      {merged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            unmerge(a.answerId);
                          }}
                        >
                          <Link2Off className="h-3.5 w-3.5 mr-1" />
                          Trennen
                        </Button>
                      ) : isAnchor ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMergeAnchor(null);
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Abbrechen
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMergeAnchor(a.answerId);
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                          Zusammenführen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {isHost && mergeMode && (
              <p className="text-xs text-muted-foreground px-1">
                Klicke eine Antwort, um sie mit „{playerName(
                  review.answers.find((a) => a.answerId === mergeAnchor)
                    ?.playerId ?? ""
                )}" zusammenzuführen.
              </p>
            )}
          </CardContent>
        </Card>

        {isHost ? (
          <div className="space-y-2">
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
                  Bewertung abschließen (Enter)
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
            <p className="text-center text-xs text-muted-foreground">
              ← → Kategorie wechseln · Enter = abschließen
            </p>
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
