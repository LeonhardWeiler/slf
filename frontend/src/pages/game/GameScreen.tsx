import { useEffect, useRef, useState } from "react";
import { ws } from "@/lib/ws";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { RoomHeader } from "@/components/RoomHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// Local ticking timer that counts down from `seconds`, restarting whenever
// `resetKey` changes. The server stays authoritative for phase transitions.
function useTicker(seconds: number | null, resetKey: string): number | null {
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

const answersKey = (roundId: string) => `slf:answers:${roundId}`;

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

  const countdown = useTicker(game?.countdownRemaining ?? null, roundId + ":cd");
  const timeLeft = useTicker(game?.timeRemaining ?? null, roundId + ":play");

  if (!lobby || !game) return null;

  const categories = lobby.categories;

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

  const allFilled = categories.every((c) => (answers[c.id] ?? "").trim() !== "");

  function handleBuzz() {
    setBuzzRejected(null);
    ws.send({ type: "buzz", payload: {} });
  }

  // ---- Countdown phase ----
  if (game.state === "Countdown") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-6">
        <p className="text-muted-foreground uppercase tracking-widest text-sm">
          Runde startet
        </p>
        <div className="text-8xl font-bold tabular-nums">
          {countdown !== null && countdown > 0 ? countdown : "Los!"}
        </div>
        {game.letter && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Buchstabe</p>
            <p className="text-6xl font-black">{game.letter}</p>
          </div>
        )}
      </div>
    );
  }

  // ---- Playing phase ----
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
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
              <p className="text-3xl font-mono font-bold tabular-nums">
                {timeLeft === null ? "∞" : `${timeLeft}s`}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <label className="text-sm font-medium">{cat.name}</label>
              <Input
                value={answers[cat.id] ?? ""}
                onChange={(e) => updateAnswer(cat.id, e.target.value)}
                placeholder={`${game.letter}…`}
                maxLength={30}
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        {buzzRejected === "incompleteAnswers" && (
          <p className="text-sm text-destructive text-center">
            Du musst alle Kategorien ausfüllen, bevor du buzzern kannst.
          </p>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleBuzz}
          disabled={!allFilled}
        >
          STOPP — Fertig!
        </Button>
        {!allFilled && (
          <p className="text-center text-xs text-muted-foreground">
            Fülle alle Kategorien aus, um zu buzzern.
          </p>
        )}
      </div>
    </div>
  );
}
