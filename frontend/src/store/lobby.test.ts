import { describe, expect, it } from "bun:test";
import { applyLobbyPatch, useLobbyStore } from "@/store/lobby";
import type { LobbyStatePayload, Player } from "@/types/events";

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
		showLetterDuringCountdown: false,
		excludedLetters: [],
		hostPlays: true,
		lastLetterMode: false,
		flamesEnabled: false,
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
		const { setLobby, reset } = useLobbyStore.getState();
		setLobby({ ...lobby([]), state: "Playing" });
		expect(draft()).not.toBeNull();
		setLobby({ ...lobby([]), state: "Reviewing" });
		expect(draft()).toBeNull();

		localStorage.setItem("slf:answers:r1", '{"c1":"Bonn"}');
		reset();
		expect(draft()).toBeNull();
	});
});
