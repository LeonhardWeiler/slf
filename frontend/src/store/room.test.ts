import { describe, expect, it } from "bun:test";
import {
	applyLobbyPatch,
	emptyRoom,
	phaseReady,
	reduceRoom,
	useRoomStore,
} from "@/store/room";
import type {
	GameStatePayload,
	LobbyStatePayload,
	Player,
} from "@/types/events";

const player = (id: string, name: string, score = 0): Player => ({
	id,
	name,
	isHost: false,
	connected: true,
	left: false,
	pending: false,
	score,
});

const lobby = (players: Player[]): LobbyStatePayload => ({
	lobbyCode: "123456",
	hostId: "a",
	players,
	categories: [],
	settings: {
		timeLimit: null,
		excludedLetters: [],
		hostPlays: true,
		lastLetterMode: false,
		sprint: false,
	},
	state: "Lobby",
	solo: false,
});

describe("applyLobbyPatch", () => {
	it("updates, adds, removes and sorts players", () => {
		const base = lobby([
			player("a", "anna"),
			player("b", "Bert"),
			player("c", "Cleo"),
		]);
		const next = applyLobbyPatch(base, {
			...lobby([player("b", "Bert", 5), player("d", "Ben")]),
			state: "Playing",
			removed: ["c"],
		});
		expect(next?.state).toBe("Playing");
		expect(next?.players.map((p) => [p.id, p.score])).toEqual([
			["a", 0],
			["d", 0],
			["b", 5],
		]);
	});

	it("ignores a patch for another or no lobby", () => {
		const patch = { ...lobby([]), removed: [] };
		expect(applyLobbyPatch(null, patch)).toBeNull();
		expect(
			applyLobbyPatch({ ...lobby([]), lobbyCode: "999999" }, patch),
		).toBeNull();
	});
});

describe("drafts", () => {
	it("keeps them only while a round runs and drops them on leave", () => {
		const draft = () => localStorage.getItem("slf:answers:r1");
		localStorage.setItem("slf:answers:r1", '{"c1":"Bonn"}');
		const { receive, reset } = useRoomStore.getState();
		receive("lobbyState", { ...lobby([]), state: "Playing" });
		expect(draft()).not.toBeNull();
		receive("lobbyState", { ...lobby([]), state: "Reviewing" });
		expect(draft()).toBeNull();

		localStorage.setItem("slf:answers:r1", '{"c1":"Bonn"}');
		reset();
		expect(draft()).toBeNull();
	});
});

const payload = (
	endsAt: number | null,
	serverNow: number,
): GameStatePayload => ({
	roundId: "r",
	state: "Playing",
	letter: "A",
	usedLetters: [],
	remainingLetters: [],
	endsAt,
	serverNow,
	countdownRemaining: null,
	categoryCount: 1,
});

describe("game store", () => {
	it("moves the deadline onto the local clock", () => {
		const skew = 3_600_000;
		const before = Date.now();
		useRoomStore
			.getState()
			.receive("gameState", payload(before + skew + 60_000, before + skew));
		const endsAt = useRoomStore.getState().game?.endsAt ?? 0;
		expect(endsAt - before).toBeGreaterThanOrEqual(60_000);
		expect(endsAt - Date.now()).toBeLessThanOrEqual(60_000);
	});

	it("keeps an unlimited round unlimited", () => {
		useRoomStore.getState().receive("gameState", payload(null, 0));
		expect(useRoomStore.getState().game?.endsAt).toBeNull();
	});

	it("clears the pending buzz on a rejection or a new game state", () => {
		const s = useRoomStore.getState();
		s.buzz();
		expect(useRoomStore.getState().buzzing).toBe(true);
		s.setBuzzRejected("invalidAnswers");
		expect(useRoomStore.getState().buzzing).toBe(false);
		s.buzz();
		s.receive("gameState", payload(null, 0));
		expect(useRoomStore.getState().buzzing).toBe(false);
	});

	it("merges a commentator row into the board of the same round", () => {
		const s = useRoomStore.getState();
		const row = (playerId: string, filled: string[]) => ({
			playerId,
			filledCategoryIds: filled,
			complete: false,
		});
		s.receive("commentatorState", {
			roundId: "r1",
			players: [row("a", []), row("b", [])],
		});
		s.receive("commentatorUpdate", { roundId: "r1", player: row("a", ["c1"]) });
		s.receive("commentatorUpdate", { roundId: "r0", player: row("b", ["c1"]) });
		const players = useRoomStore.getState().commentator?.players ?? [];
		expect(players.find((p) => p.playerId === "a")?.filledCategoryIds).toEqual([
			"c1",
		]);
		expect(players.find((p) => p.playerId === "b")?.filledCategoryIds).toEqual(
			[],
		);
	});
});

describe("reduceRoom", () => {
	const at = (state: LobbyStatePayload["state"]) => ({
		type: "lobbyState" as const,
		payload: { ...lobby([]), state },
	});
	const review = (roundId: string) => ({
		type: "reviewState" as const,
		payload: {
			roundId,
			letter: "A",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 1,
			answers: [],
			solo: null,
			ready: null,
			voters: null,
		},
	});

	it("drops a message older than the last one", () => {
		const room = reduceRoom(emptyRoom, at("Playing"), 5);
		const game = { type: "gameState" as const, payload: payload(null, 0) };
		expect(reduceRoom(room, game, 4)).toBe(room);
		expect(reduceRoom(room, game, 0).game?.roundId).toBe("r");
		expect(reduceRoom(room, at("Lobby"), 1).lobby?.state).toBe("Lobby");
	});

	it("waits for the data of the new phase", () => {
		let room = reduceRoom(emptyRoom, at("Playing"), 1);
		room = reduceRoom(
			room,
			{ type: "gameState", payload: payload(null, 0) },
			2,
		);
		room = reduceRoom(room, at("Reviewing"), 3);
		expect(phaseReady(room)).toBe(false);
		room = reduceRoom(room, review("r"), 4);
		expect(phaseReady(room)).toBe(true);
		room = reduceRoom(room, at("RoundResult"), 5);
		expect(phaseReady(room)).toBe(false);
	});

	it("drops the data of the previous round", () => {
		let room = reduceRoom(emptyRoom, at("Reviewing"), 1);
		room = reduceRoom(room, review("r1"), 2);
		room = reduceRoom(room, review("r2"), 3);
		expect(room.review?.roundId).toBe("r2");
		room = reduceRoom(room, at("Countdown"), 4);
		expect(room.review).toBeNull();
		expect(room.roundId).toBe("");
	});
});
