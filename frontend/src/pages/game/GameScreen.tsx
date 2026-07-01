import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { ws } from "@/lib/ws";
import { cn } from "@/lib/utils";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { validateAnswers, isFieldInvalid } from "@/lib/answerValidation";
import { RoomHeader } from "@/components/RoomHeader";
import { CommentatorBoard } from "@/components/CommentatorBoard";
import { useConfirm, isConfirmDialogOpen } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// Local ticking timer that counts down from `seconds`, restarting whenever
// `resetKey` changes. The server stays authoritative for phase transitions.
function useCountdown(seconds: number | null, resetKey: string): number | null {
  const [value, setValue] = useState(seconds);
  // resetKey is the intended restart trigger; `seconds` is re-read each run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only on resetKey
  useEffect(() => {
    setValue(seconds);
    if (seconds === null) return;
    const id = setInterval(() => {
      setValue((v) => (v === null ? null : Math.max(0, v - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [resetKey]);
  return value;
}

// Count-up stopwatch starting from `start` seconds, restarting on resetKey.
function useStopwatch(start: number, resetKey: string): number {
  const [value, setValue] = useState(start);
  // resetKey is the intended restart trigger; `start` is re-read each run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only on resetKey
  useEffect(() => {
    setValue(start);
    const id = setInterval(() => setValue((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [resetKey]);
  return value;
}

const answersKey = (roundId: string) => `slf:answers:${roundId}`;
const flameKey = (roundId: string) => `slf:flame:${roundId}`;

// Draft answers/flames are stored per round. Drop every round's drafts except the
// current one so localStorage doesn't grow unbounded across many games.
function purgeOtherRoundDrafts(keepRoundId: string) {
  try {
    const keep = new Set([answersKey(keepRoundId), flameKey(keepRoundId)]);
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        (k.startsWith("slf:answers:") || k.startsWith("slf:flame:")) &&
        !keep.has(k)
      ) {
        stale.push(k);
      }
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch {
    /* ignore storage errors */
  }
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GameScreen() {
  const { lobby } = useLobbyStore();
  const { game, buzzRejected, setBuzzRejected, commentator } = useGameStore();
  const isHost = useIsHost();
  const { confirm, dialog } = useConfirm();

  // A commentator host does not play: it fills nothing and instead watches the
  // per-player fill overview.
  const isSpectator = isHost && lobby?.settings.hostPlays === false;
  const lastLetterMode = lobby?.settings.lastLetterMode ?? false;
  const flamesEnabled = lobby?.settings.flamesEnabled ?? false;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Categories the player has blurred at least once — a field only shows a red
  // "invalid" border after it was left, not while still being typed in.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // The single category this player has "flamed" this round ("" = none).
  const [flamed, setFlamed] = useState<string>("");
  const loadedRound = useRef<string>("");
  // Debounce buffer: latest value per category not yet sent to the server.
  const pendingAnswers = useRef<Record<string, string>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roundId = game?.roundId ?? "";

  // Send all buffered answer changes now (also used before buzzing and on unmount
  // so no keystrokes are lost).
  function flushAnswers() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const pending = pendingAnswers.current;
    pendingAnswers.current = {};
    for (const [categoryId, value] of Object.entries(pending)) {
      ws.send({ type: "answerUpdate", payload: { categoryId, value } });
    }
  }

  // Load saved draft answers (and flame) for this round and push them to the
  // server so a reconnect mid-round restores progress (SRS 5.6 / 9.10).
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only when roundId changes
  useEffect(() => {
    if (!roundId || loadedRound.current === roundId) return;
    loadedRound.current = roundId;
    // Clear out drafts from earlier rounds so localStorage stays bounded.
    purgeOtherRoundDrafts(roundId);
    // Drop any buffered answers from the previous round.
    pendingAnswers.current = {};
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem(answersKey(roundId)) ?? "{}");
    } catch {
      saved = {};
    }
    setAnswers(saved);
    setTouched({});

    const savedFlame = localStorage.getItem(flameKey(roundId)) ?? "";
    setFlamed(savedFlame);

    if (isSpectator) return; // the commentator host submits nothing

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
    if (savedFlame) {
      ws.send({ type: "setFlame", payload: { categoryId: savedFlame } });
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
      ? validateAnswers(lobby.categories, answers, game.letter, lastLetterMode)
      : { valid: false as const };
  const canBuzz = !isSpectator && lobby?.state === "Playing" && validation.valid;

  function handleBuzz() {
    flushAnswers(); // server must have the latest answers before the buzz check
    setBuzzRejected(null);
    ws.send({ type: "buzz", payload: {} });
  }

  async function handleEndRound() {
    if (
      await confirm({
        title: "Runde beenden?",
        description:
          "Die laufende Runde wird für alle sofort beendet und zur Bewertung gebracht.",
        confirmLabel: "Runde beenden",
        destructive: true,
      })
    ) {
      ws.send({ type: "endRound", payload: {} });
    }
  }

  // Flush any buffered answers when leaving the screen (e.g. round ended on
  // timeout) so the last keystrokes still reach the server.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on unmount
  useEffect(() => {
    return () => flushAnswers();
  }, []);

  // Buzz with Enter (there's no form to submit). Only when an all-valid set
  // is ready and we are actually in the playing phase.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-bind only on canBuzz
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (!canBuzz) return;
      // Pause while a confirm dialog is up (e.g. "Runde beenden?") so its Enter
      // doesn't also buzz (UX-1).
      if (isConfirmDialogOpen()) return;
      e.preventDefault();
      handleBuzz();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    // Debounce the server sync: batch keystrokes into at most one answerUpdate
    // per ~250ms instead of one message per keystroke.
    pendingAnswers.current[categoryId] = value;
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(flushAnswers, 250);
    }
  }

  // Toggle the flame on a category. Only one flame per round, so flaming another
  // category moves it. The server is authoritative and enforces the same limit.
  function toggleFlame(categoryId: string) {
    const next = flamed === categoryId ? "" : categoryId;
    setFlamed(next);
    try {
      if (next) localStorage.setItem(flameKey(roundId), next);
      else localStorage.removeItem(flameKey(roundId));
    } catch {
      /* ignore quota errors */
    }
    ws.send({ type: "setFlame", payload: { categoryId: next } });
  }

  // ---- Countdown phase ----
  // Phase is derived from the lobby state (single source of truth) so the
  // countdown screen shows immediately — even before the first gameState
  // arrives — instead of a blank frame or a flash of the Playing UI.
  if (lobby.state === "Countdown") {
    const display =
      countdown === null ? "" : countdown > 0 ? String(countdown) : "Los!";
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center screen-pad gap-6 animate-fade-in">
        <p className="text-muted-foreground uppercase tracking-widest text-sm">
          Runde startet
        </p>
        <div
          key={display}
          aria-live="assertive"
          aria-atomic="true"
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
  const placeholder = lastLetterMode ? `…${game.letter}` : `${game.letter}…`;

  // ---- Playing phase ----
  // Red border stays on through 0 and until the round actually ends.
  const dangerZone = hasTimeLimit && timeLeft !== null && timeLeft <= 5;

  // Non-host players who are actually playing (for the commentator overview).
  const playingPlayers = lobby.players.filter((p) => !p.left && !p.isHost);

  return (
    <div className="min-h-svh bg-background screen-pad">
      {/* Red, pulsing screen border for the final 5 seconds (only when timed). */}
      {dangerZone && (
        <div className="pointer-events-none fixed inset-0 z-50 ring-4 ring-inset ring-destructive animate-pulse" />
      )}
      <div className="mx-auto w-full max-w-5xl space-y-4 animate-fade-in">
        <RoomHeader
          title={isSpectator ? "Kommentator" : "Runde läuft"}
          subtitle={
            isSpectator ? "Wer hat schon ausgefüllt?" : undefined
          }
        />

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Buchstabe{lastLetterMode ? " (am Ende)" : ""}
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

        {isSpectator ? (
          <Card>
            <CardContent className="pt-6">
              <CommentatorBoard
                categories={categories}
                players={playingPlayers}
                commentator={commentator}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {categories.map((cat, idx) => {
                const isFlamed = flamed === cat.id;
                const showInvalid =
                  touched[cat.id] &&
                  isFieldInvalid(answers[cat.id] ?? "", game.letter, lastLetterMode);
                return (
                  <div key={cat.id} className="space-y-1">
                    <label htmlFor={`cat-${cat.id}`} className="text-sm font-medium">
                      {cat.name}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`cat-${cat.id}`}
                        value={answers[cat.id] ?? ""}
                        onChange={(e) => updateAnswer(cat.id, e.target.value)}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, [cat.id]: true }))
                        }
                        placeholder={placeholder}
                        maxLength={30}
                        autoComplete="off"
                        autoFocus={idx === 0}
                        aria-invalid={showInvalid || undefined}
                        className={cn(
                          showInvalid &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                        // With flames on, Tab walks all inputs first (1..n), then
                        // all flame buttons (n+1..2n), instead of input→flame.
                        tabIndex={flamesEnabled ? idx + 1 : undefined}
                      />
                      {flamesEnabled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-pressed={isFlamed}
                          tabIndex={categories.length + idx + 1}
                          title={
                            isFlamed
                              ? "Flamme entfernen"
                              : "Flamme setzen: Wette, dass du die einzige Antwort hast (+5 / 0)"
                          }
                          onClick={() => toggleFlame(cat.id)}
                          className={cn(
                            "shrink-0",
                            isFlamed &&
                              "border-orange-500 text-orange-500 bg-orange-500/10 hover:text-orange-500"
                          )}
                        >
                          <Flame
                            className={cn("h-4 w-4", isFlamed && "fill-orange-500")}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {flamesEnabled && (
              <p className="text-center text-xs text-muted-foreground">
                🔥 = du wettest, die einzige Antwort zu haben (richtig +5, falsch 0).
                Eine Flamme pro Runde.
              </p>
            )}

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
          </>
        )}

        {/* Host can end a stuck round early (hard letter, or a commentator host
            who never buzzes) → everyone moves to review. */}
        {isHost && (
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleEndRound}
            >
              Runde beenden
            </Button>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
