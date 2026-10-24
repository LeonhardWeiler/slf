import { create } from "zustand";
import type {
	BuzzRejectReason,
	CommentatorStatePayload,
	GameStatePayload,
	LobbyPatchPayload,
	LobbyStatePayload,
	ReviewStatePayload,
	RoundResultPayload,
	ServerEvent,
} from "@/types/events";
import { clearDrafts, clearSessionId, setSessionId } from "@/lib/session";

// Everything the server tells us about the room, updated only by reduceRoom so
// the phase and its data change together.
export interface Room {
	lobby: LobbyStatePayload | null;
	game: GameStatePayload | null;
	review: ReviewStatePayload | null;
	result: RoundResultPayload | null;
	commentator: CommentatorStatePayload | null;
	roundId: string;
	version: number;
}

export type RoomEvent = Extract<
	ServerEvent,
	{
		type:
			| "lobbyState"
			| "lobbyPatch"
			| "gameState"
			| "reviewState"
			| "roundResult"
			| "commentatorState"
			| "commentatorUpdate";
	}
>;

const noRound = {
	game: null,
	review: null,
	result: null,
	commentator: null,
	roundId: "",
};

export const emptyRoom: Room = { lobby: null, ...noRound, version: 0 };

// applyLobbyPatch merges a lobbyPatch into the current lobby, sorted like the
// server sorts. Null when there is no lobby of that code to patch.
export function applyLobbyPatch(
	lobby: LobbyStatePayload | null,
	{ removed, ...patch }: LobbyPatchPayload,
): LobbyStatePayload | null {
	if (lobby?.lobbyCode !== patch.lobbyCode) return null;
	const byId = new Map(lobby.players.map((p) => [p.id, p]));
	for (const p of patch.players) byId.set(p.id, p);
	for (const id of removed) byId.delete(id);
	const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
	const players = [...byId.values()].sort(
		(a, b) =>
			cmp(a.name.toLowerCase(), b.name.toLowerCase()) || cmp(a.id, b.id),
	);
	return { ...patch, players };
}

// A phase change drops the data the new phase is about to receive, so a screen
// never shows the previous round's letter, review or result.
function enterLobby(room: Room, lobby: LobbyStatePayload): Room {
	if (room.lobby?.lobbyCode !== lobby.lobbyCode) {
		room = { ...emptyRoom, version: room.version };
	}
	if (room.lobby?.state === lobby.state) return { ...room, lobby };
	switch (lobby.state) {
		case "Lobby":
		case "Countdown":
			return { ...room, ...noRound, lobby };
		case "Reviewing":
			return { ...room, review: null, lobby };
		case "RoundResult":
		case "GameOver":
			return { ...room, result: null, lobby };
		default:
			return { ...room, lobby };
	}
}

// Data of another round than the current one is dropped.
function forRound(room: Room, roundId: string): Room {
	return room.roundId === roundId ? room : { ...room, ...noRound, roundId };
}

// reduceRoom applies one server message. A full lobbyState is always taken (a
// restarted server counts versions from 0 again); anything older than the
// last applied version is stale and ignored; version 0 is unversioned.
export function reduceRoom(
	room: Room,
	event: RoomEvent,
	version: number,
): Room {
	if (event.type !== "lobbyState" && version > 0 && version < room.version)
		return room;
	room = {
		...room,
		version:
			event.type === "lobbyState" ? version : Math.max(room.version, version),
	};
	switch (event.type) {
		case "lobbyState":
			return enterLobby(room, event.payload);
		case "lobbyPatch": {
			const lobby = applyLobbyPatch(room.lobby, event.payload);
			return lobby ? enterLobby(room, lobby) : room;
		}
		case "gameState": {
			const game = event.payload;
			// endsAt moves onto the local clock, so timers compare it with Date.now().
			const endsAt =
				game.endsAt === null ? null : game.endsAt - game.serverNow + Date.now();
			return { ...forRound(room, game.roundId), game: { ...game, endsAt } };
		}
		case "reviewState": {
			const review = event.payload;
			const endsAt =
				review.endsAt === null
					? null
					: review.endsAt - review.serverNow + Date.now();
			return {
				...forRound(room, review.roundId),
				review: { ...review, endsAt },
			};
		}
		case "commentatorState":
			return {
				...forRound(room, event.payload.roundId),
				commentator: event.payload,
			};
		case "commentatorUpdate": {
			const { roundId, player } = event.payload;
			const c = room.commentator;
			if (c?.roundId !== roundId) return room;
			const players = c.players.filter((p) => p.playerId !== player.playerId);
			return {
				...room,
				commentator: { roundId, players: [...players, player] },
			};
		}
		case "roundResult":
			return { ...room, result: event.payload };
	}
}

// Whether the data for the lobby's phase has arrived.
export function phaseReady(room: Room): boolean {
	switch (room.lobby?.state) {
		case "Reviewing":
			return room.review !== null;
		case "RoundResult":
			return room.result?.isGameOver === false;
		case "GameOver":
			return room.result?.isGameOver === true;
		default:
			return true;
	}
}

interface RoomStore extends Room {
	myPlayerId: string | null;
	mySessionId: string | null;
	// Seconds left until the lobby closes because the host is disconnected; null
	// when the host is present (SRS 4.6/8.5). Shown as a shared countdown banner.
	hostGrace: number | null;
	// True between the moment we click "Verlassen" and the server's lobbyClosed
	// echo. The host also receives that echo, but shouldn't be told the lobby was
	// closed when they closed it themselves.
	selfLeaving: boolean;
	// Counts sessionCreated messages, i.e. every (re)connect of this session.
	sessionEpoch: number;
	buzzRejected: BuzzRejectReason | null;
	buzzing: boolean;

	receive: <T extends RoomEvent["type"]>(
		type: T,
		payload: Extract<RoomEvent, { type: T }>["payload"],
		version?: number,
	) => void;
	setSession: (sessionId: string, playerId: string) => void;
	setHostGrace: (seconds: number | null) => void;
	setSelfLeaving: (v: boolean) => void;
	setBuzzRejected: (reason: BuzzRejectReason | null) => void;
	buzz: () => void;
	// Tear down the local session and return to the start screen (e.g. after
	// being kicked or when the host closes the lobby). The reason is surfaced to
	// the user via a toast at the call site.
	reset: () => void;
}

// Whether the current player is the host of the active lobby.
export function useIsHost(): boolean {
	return useRoomStore(
		(s) => s.lobby?.players.find((p) => p.id === s.myPlayerId)?.isHost ?? false,
	);
}

export const useRoomStore = create<RoomStore>((set, get) => ({
	...emptyRoom,
	myPlayerId: null,
	mySessionId: null,
	hostGrace: null,
	selfLeaving: false,
	sessionEpoch: 0,
	buzzRejected: null,
	buzzing: false,

	receive: (type, payload, version = 0) => {
		const s = get();
		const next = reduceRoom(s, { type, payload } as RoomEvent, version);
		if (next === s) return;
		const extra: Partial<RoomStore> = {};
		if (next.game !== s.game) {
			extra.buzzRejected = null;
			extra.buzzing = false;
		}
		if (next.lobby !== s.lobby && next.lobby) {
			extra.selfLeaving = false;
			extra.hostGrace = next.lobby.hostGraceSeconds ?? null;
			const st = next.lobby.state;
			if (st !== "Countdown" && st !== "Playing") clearDrafts();
		}
		set({ ...next, ...extra });
	},
	setSession: (sessionId, playerId) => {
		setSessionId(sessionId);
		set((s) => ({
			mySessionId: sessionId,
			myPlayerId: playerId,
			sessionEpoch: s.sessionEpoch + 1,
		}));
	},
	setHostGrace: (seconds) => set({ hostGrace: seconds }),
	setSelfLeaving: (v) => set({ selfLeaving: v }),
	setBuzzRejected: (reason) => set({ buzzRejected: reason, buzzing: false }),
	buzz: () => set({ buzzRejected: null, buzzing: true }),
	reset: () => {
		clearSessionId();
		set({
			...emptyRoom,
			myPlayerId: null,
			mySessionId: null,
			hostGrace: null,
			buzzRejected: null,
			buzzing: false,
		});
	},
}));
