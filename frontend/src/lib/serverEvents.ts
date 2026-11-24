import { z } from "zod/mini";
import type { ServerEvent } from "@/types/events";

// z.object() ignores unknown keys, so extra server fields are tolerated.

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
	// Lenient default: tolerate a message from an older server without the field.
	pending: z._default(z.optional(z.boolean()), false),
	plays: z.boolean(),
	score: z.number(),
	combo: z._default(z.optional(z.number()), 0),
});

const categorySchema = z.object({ id: z.string(), name: z.string() });

const settingsSchema = z.object({
	timeLimit: z.nullable(z.number()),
	excludedLetters: z.array(z.string()),
	hostPlays: z.boolean(),
	lastLetterMode: z.boolean(),
});

const lobbyStatePayload = z.object({
	lobbyCode: z.string(),
	hostId: z.string(),
	players: z.array(playerSchema),
	categories: z.array(categorySchema),
	settings: settingsSchema,
	state: gameStateEnum,
	hostGraceSeconds: z.nullish(z.number()),
	solo: z._default(z.optional(z.boolean()), false),
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
	endsAt: z.nullable(z.number()),
	serverNow: z.number(),
	countdownRemaining: z.nullable(z.number()),
	categoryCount: z.number(),
	letters: z._default(z.nullish(z.array(z.string())), null),
	sprintPos: z.optional(z.number()),
	sprintWords: z.optional(z.array(z.string())),
});

const reviewAnswerSchema = z.object({
	answerId: z.string(),
	playerId: z.string(),
	value: z.string(),
	valid: z.boolean(),
	mergedInto: z.string(),
	pointsPreview: z.number(),
	votes: z._default(z.nullish(z.record(z.string(), z.boolean())), null),
});

const reviewStatePayload = z.object({
	roundId: z.string(),
	letter: z.string(),
	categoryId: z.string(),
	categoryIndex: z.number(),
	categoryCount: z.number(),
	answers: z.array(reviewAnswerSchema),
	// Optional/lenient: an older server without this field must not drop the event.
	buzzedBy: z.optional(z.string()),
	endReason: z.optional(z.string()),
	ready: z._default(z.nullish(z.array(z.string())), null),
	voters: z._default(z.nullish(z.array(z.string())), null),
});

const commentatorPlayer = z.object({
	playerId: z.string(),
	filledCategoryIds: z.array(z.string()),
	complete: z.boolean(),
});

const commentatorStatePayload = z.object({
	roundId: z.string(),
	players: z.array(commentatorPlayer),
});

const roundResultPayload = z.object({
	letter: z.string(),
	scores: z.array(
		z.object({
			playerId: z.string(),
			roundPoints: z.number(),
			totalPoints: z.number(),
			points: z._default(z.optional(z.array(z.number())), []),
			buzz: z._default(z.optional(z.number()), 0),
			combo: z._default(z.optional(z.number()), 0),
		}),
	),
	ranking: z.array(
		z.object({
			playerId: z.string(),
			rank: z.number(),
			score: z.number(),
		}),
	),
	usedLetters: z.array(z.string()),
	remainingLetters: z.array(z.string()),
	isGameOver: z.boolean(),
	empty: z.optional(z.boolean()),
	// Lenient: an unknown reason must not cause a valid result to be dropped.
	reason: z.optional(z.string()),
});

// Lenient on the string enums so a newer server value does not drop the message.
const errorPayload = z.object({
	code: z.string(),
	message: z.string(),
	severity: z.string(),
});

const serverEventSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("lobbyState"), payload: lobbyStatePayload }),
	z.object({
		type: z.literal("lobbyPatch"),
		payload: z.extend(lobbyStatePayload, { removed: z.array(z.string()) }),
	}),
	z.object({
		type: z.literal("sessionCreated"),
		payload: sessionCreatedPayload,
	}),
	z.object({
		type: z.literal("lobbyCheck"),
		payload: z.object({
			lobbyCode: z.string(),
			available: z.boolean(),
			// Lenient: an unknown/forward-compatible reason must not drop the message.
			reason: z.optional(z.string()),
		}),
	}),
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
	z.object({
		type: z.literal("commentatorState"),
		payload: commentatorStatePayload,
	}),
	z.object({
		type: z.literal("commentatorUpdate"),
		payload: z.object({ roundId: z.string(), player: commentatorPlayer }),
	}),
	z.object({ type: z.literal("roundResult"), payload: roundResultPayload }),
	z.object({
		type: z.literal("buzzRejected"),
		payload: z.object({ reason: z.string() }),
	}),
	z.object({
		type: z.literal("hostDisconnected"),
		payload: z.object({ graceSeconds: z.number() }),
	}),
	z.object({
		type: z.literal("hostReconnected"),
		payload: z.object({}),
	}),
	z.object({ type: z.literal("pong"), payload: z.object({}) }),
	z.object({ type: z.literal("error"), payload: errorPayload }),
]);

// stateVersion is 0 when the server sent none.
export function parseServerEvent(
	raw: string,
): (ServerEvent & { stateVersion: number }) | null {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return null;
	}
	const result = serverEventSchema.safeParse(json);
	if (!result.success) {
		if (import.meta.env?.DEV) {
			console.warn("Discarded invalid server message:", result.error.issues);
		}
		return null;
	}
	const v = (json as { stateVersion?: unknown }).stateVersion;
	return {
		...(result.data as ServerEvent),
		stateVersion: typeof v === "number" ? v : 0,
	};
}
