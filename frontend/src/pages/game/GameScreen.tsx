import { useEffect, useRef, useState } from "react";
import { ws } from "@/lib/ws";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { validateAnswers } from "@/lib/answerValidation";
import { RoomHeader } from "@/components/RoomHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// Local ticking timer that counts down from `seconds`, restarting whenever
// `resetKey` changes. The server stays authoritative for phase transitions.
function useCountdown(seconds: number | null, resetKey: string): number | null {
  const [value, setValue] = useState(seconds);
  useEffect(() => {
    setValue(seconds);
    if (seconds === null) return;
    const id = setInterval(() => {
      setValue((v) => (v === null ? null : Math.max(0, v - 1)));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return value;
}

// Count-up stopwatch starting from `start` seconds, restarting on resetKey.
function useStopwatch(start: number, resetKey: string): number {
  const [value, setValue] = useState(start);
  useEffect(() => {
    setValue(start);
    const id = setInterval(() => setValue((v) => v + 1), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return value;
}

const answersKey = (roundId: string) => `slf:answers:${roundId}`;

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GameScreen() {
  const { lobby } = useLobbyStore();
  const { game, buzzRejected, setBuzzRejected } = useGameStore();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const loadedRound = useRef<string>("");

  const roundId = game?.roundId ?? "";

  // Load saved draft answers for this round and push them to the server so a
  // reconnect mid-round restores progress (SRS 5.6 / 9.10).
  useEffect(() => {
    if (!roundId || loadedRound.current === roundId) return;
    loadedRound.current = roundId;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem(answersKey(roundId)) ?? "{}");
    } catch {
      saved = {};
    }
    setAnswers(saved);
    const entries = Object.entries(saved).filter(([, v]) => v.trim() !== "");
    if (entries.length > 0) {
      ws.send({
        type: "inputSync",
        payload: {
          roundId,
          answers: entries.map(([categoryId, value]) => ({ categoryId, value })),
        },
      });
    }
  }, [roundId]);

  const countdown = useCountdown(
    game?.countdownRemaining ?? null,
    `${roundId}:cd:${game?.countdownRemaining ?? ""}`
  );
  const timeLeft = useCountdown(
    game?.timeRemaining ?? null,
    `${roundId}:${game?.state ?? ""}:${game?.timeRemaining ?? ""}`
  );
  const elapsed = useStopwatch(
    game?.elapsed ?? 0,
    `${roundId}:${game?.state ?? ""}:${game?.elapsed ?? ""}`
  );

  // Validate once and reuse for both the buzz gate and the disabled-reason text.
  const validation =
    lobby && game
      ? validateAnswers(lobby.categories, answers, game.letter)
      : { valid: false as const };
  const canBuzz = lobby?.state === "Playing" && validation.valid;

  function handleBuzz() {
    setBuzzRejected(null);
    ws.send({ type: "buzz", payload: {} });
  }

  // Buzz with Enter (there's no form to submit). Only when an all-valid set
  // is ready and we are actually in the playing phase.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (!canBuzz) return;
      e.preventDefault();
      handleBuzz();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBuzz]);

  if (!lobby) return null;

  function updateAnswer(categoryId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [categoryId]: value };
      try {
        localStorage.setItem(answersKey(roundId), JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
    ws.send({ type: "answerUpdate", payload: { categoryId, value } });
  }

  // ---- Countdown phase ----
  // Phase is derived from the lobby state (single source of truth) so the
  // countdown screen shows immediately — even before the first gameState
  // arrives — instead of a blank frame or a flash of the Playing UI.
  if (lobby.state === "Countdown") {
    const display =
      countdown === null ? "" : countdown > 0 ? String(countdown) : "Los!";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center screen-pad gap-6 animate-fade-in">
        <p className="text-muted-foreground uppercase tracking-widest text-sm">
          Runde startet
        </p>
        <div
          key={display}
          className="text-8xl font-bold tabular-nums min-h-[1em] animate-countdown-pop"
        >
          {display}
        </div>
        {game?.letter && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Buchstabe</p>
            <p className="text-6xl font-black">{game.letter}</p>
          </div>
        )}
      </div>
    );
  }

  if (!game) return null;

  const categories = lobby.categories;
  const hasTimeLimit = lobby.settings.timeLimit !== null;

  // ---- Playing phase ----
  // Red border stays on through 0 and until the round actually ends.
  const dangerZone = hasTimeLimit && timeLeft !== null && timeLeft <= 5;

  return (
    <div className="min-h-screen bg-background screen-pad">
      {/* Red, pulsing screen border for the final 5 seconds (only when timed). */}
      {dangerZone && (
        <div className="pointer-events-none fixed inset-0 z-50 ring-4 ring-inset ring-destructive animate-pulse" />
      )}
      <div className="mx-auto w-full max-w-5xl space-y-4 animate-fade-in">
        <RoomHeader title="Runde läuft" />

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Buchstabe
              </p>
              <p className="text-6xl font-black leading-none">{game.letter}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Zeit
              </p>
              {hasTimeLimit ? (
                <p
                  className={`text-3xl font-mono font-bold tabular-nums ${
                    dangerZone ? "text-destructive" : ""
                  }`}
                >
                  {timeLeft === null ? "–" : `${timeLeft}s`}
                </p>
              ) : (
                <p className="text-3xl font-mono font-bold tabular-nums">
                  {formatClock(elapsed)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Screen-reader announcement for the final seconds. */}
        <span className="sr-only" aria-live="assertive">
          {dangerZone && timeLeft !== null ? `Noch ${timeLeft} Sekunden` : ""}
        </span>

        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="space-y-1">
              <label className="text-sm font-medium">{cat.name}</label>
              <Input
                value={answers[cat.id] ?? ""}
                onChange={(e) => updateAnswer(cat.id, e.target.value)}
                placeholder={`${game.letter}…`}
                maxLength={30}
                autoComplete="off"
                autoFocus={idx === 0}
              />
            </div>
          ))}
        </div>

        {(buzzRejected === "incompleteAnswers" ||
          buzzRejected === "invalidAnswers") && (
          <p className="text-sm text-destructive text-center">
            Du musst alle Kategorien gültig ausfüllen, bevor du buzzern kannst.
          </p>
        )}

        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleBuzz}
            disabled={!validation.valid}
          >
            STOPP — Fertig!{validation.valid ? " (Enter)" : ""}
          </Button>
          {!validation.valid && (
            <p className="text-center text-xs text-muted-foreground">
              {validation.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
