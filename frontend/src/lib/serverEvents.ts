import { z } from "zod";
import type { ServerEvent } from "@/types/events";

// Runtime validation of every incoming server→client message (SRS 9.3, 9.12,
// 13.5.3: "Alle Nachrichten werden im Frontend mittels Zod validiert"). The
// server is authoritative, so a message that does not match the expected shape
// is dropped rather than fed into the store as malformed state.
//
// Note: z.object() ignores unknown keys, so the top-level `stateVersion`
// envelope field (and any extra server fields) are tolerated and simply not
// surfaced to the handlers.

const gameStateEnum = z.enum([
  "Lobby",
  "Countdown",
  "Playing",
  "Reviewing",
  "RoundResult",
  "GameOver",
]);

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  connected: z.boolean(),
  left: z.boolean(),
  score: z.number(),
});

const categorySchema = z.object({ id: z.string(), name: z.string() });

const settingsSchema = z.object({
  timeLimit: z.number().nullable(),
  showLetterDuringCountdown: z.boolean(),
  excludedLetters: z.array(z.string()),
});

const lobbyStatePayload = z.object({
  lobbyCode: z.string(),
  hostId: z.string(),
  players: z.array(playerSchema),
  categories: z.array(categorySchema),
  settings: settingsSchema,
  state: gameStateEnum,
});

const sessionCreatedPayload = z.object({
  sessionId: z.string(),
  playerId: z.string(),
});

const gameStatePayload = z.object({
  roundId: z.string(),
  state: z.enum(["Countdown", "Playing"]),
  letter: z.string(),
  usedLetters: z.array(z.string()),
  remainingLetters: z.array(z.string()),
  timeRemaining: z.number().nullable(),
  countdownRemaining: z.number().nullable(),
  elapsed: z.number().nullable(),
  categoryCount: z.number(),
});

const reviewAnswerSchema = z.object({
  answerId: z.string(),
  playerId: z.string(),
  value: z.string(),
  valid: z.boolean(),
  mergedInto: z.string(),
  pointsPreview: z.number(),
});

const reviewStatePayload = z.object({
  roundId: z.string(),
  letter: z.string(),
  categoryId: z.string(),
  categoryIndex: z.number(),
  categoryCount: z.number(),
  answers: z.array(reviewAnswerSchema),
});

const roundResultPayload = z.object({
  letter: z.string(),
  scores: z.array(
    z.object({
      playerId: z.string(),
      roundPoints: z.number(),
      totalPoints: z.number(),
    })
  ),
  ranking: z.array(
    z.object({
      playerId: z.string(),
      rank: z.number(),
      score: z.number(),
    })
  ),
  isGameOver: z.boolean(),
  // Lenient: an unknown reason must not cause a valid result to be dropped.
  reason: z.string().optional(),
});

// Lenient on the string enums (code / reason) so a forward-compatible server
// value never causes an otherwise-valid message to be discarded — the client
// only needs to display the message / react to known values.
const errorPayload = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.string(),
});

const serverEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("lobbyState"), payload: lobbyStatePayload }),
  z.object({ type: z.literal("sessionCreated"), payload: sessionCreatedPayload }),
  z.object({
    type: z.literal("playerKicked"),
    payload: z.object({ playerId: z.string() }),
  }),
  z.object({
    type: z.literal("lobbyClosed"),
    payload: z.object({ reason: z.string() }),
  }),
  z.object({ type: z.literal("gameState"), payload: gameStatePayload }),
  z.object({ type: z.literal("reviewState"), payload: reviewStatePayload }),
  z.object({ type: z.literal("roundResult"), payload: roundResultPayload }),
  z.object({
    type: z.literal("buzzRejected"),
    payload: z.object({ reason: z.string() }),
  }),
  z.object({ type: z.literal("error"), payload: errorPayload }),
]);

// Parses and validates a raw server message. Returns the typed event, or null
// if the JSON is malformed or does not match any known event schema.
export function parseServerEvent(raw: string): ServerEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = serverEventSchema.safeParse(json);
  if (!result.success) {
    if (import.meta.env?.DEV) {
      console.warn("Ungültige Server-Nachricht verworfen:", result.error.issues);
    }
    return null;
  }
  return result.data as ServerEvent;
}
