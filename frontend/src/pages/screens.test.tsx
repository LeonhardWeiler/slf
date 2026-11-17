import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import {
	act,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { ws } from "@/lib/ws";
import { useRoomStore } from "@/store/room";
import type { LobbyStatePayload, Player } from "@/types/events";

const send = spyOn(ws, "send").mockImplementation(() => {});
afterAll(() => send.mockRestore());
mock.module("@/lib/nav", () => ({
	navigate: () => {},
	usePath: () => "/join/abc123",
	joinCode: () => "abc123",
	Navigate: () => null,
}));

const { GameScreen } = await import("@/pages/game/GameScreen");
const { RoundResultScreen } = await import("@/pages/game/RoundResultScreen");
const { ReviewScreen } = await import("@/pages/game/ReviewScreen");
const { GameOverScreen } = await import("@/pages/game/GameOverScreen");
const { Lobby } = await import("@/pages/Lobby");
const { renderScreen } = await import("@/pages/Room");
const { Home } = await import("@/pages/Home");

const render = (ui: ReactNode) => rtlRender(ui, { wrapper: ThemeProvider });

const player = (id: string, isHost: boolean): Player => ({
	id,
	name: id,
	isHost,
	connected: true,
	left: false,
	pending: false,
	score: 0,
	combo: 0,
});

function setup(me: string, state: LobbyStatePayload["state"]) {
	useRoomStore.setState({
		myPlayerId: me,
		lobby: {
			lobbyCode: "123456",
			hostId: "host",
			players: [player("host", true), player("guest", false)],
			categories: [
				{ id: "c1", name: "Stadt" },
				{ id: "c2", name: "Land" },
			],
			settings: {
				timeLimit: null,
				excludedLetters: [],
				hostPlays: true,
				lastLetterMode: false,
			},
			state,
			solo: false,
		},
	});
}

beforeEach(() => {
	send.mockClear();
	localStorage.clear();
});

describe("Room", () => {
	it("maps each lobby state to its screen", () => {
		expect(renderScreen("Lobby").type).toBe(Lobby);
		expect(renderScreen("Countdown").type).toBe(GameScreen);
		expect(renderScreen("Playing").type).toBe(GameScreen);
		expect(renderScreen("Reviewing").type).toBe(ReviewScreen);
		expect(renderScreen("RoundResult").type).toBe(RoundResultScreen);
		expect(renderScreen("GameOver").type).toBe(GameOverScreen);
	});
});

describe("RoundResultScreen", () => {
	beforeEach(() => {
		useRoomStore.getState().receive("roundResult", {
			letter: "A",
			scores: [],
			ranking: [
				{ playerId: "host", rank: 1, score: 10 },
				{ playerId: "guest", rank: 2, score: 5 },
			],
			usedLetters: ["A"],
			remainingLetters: ["B"],
			isGameOver: false,
		});
	});

	it("gives the host the next round and the kick", () => {
		setup("host", "RoundResult");
		render(<RoundResultScreen />);
		expect(screen.getByRole("button", { name: "Nächste Runde" })).toBeDefined();
		expect(screen.getByTitle("guest entfernen")).toBeDefined();
		expect(screen.getByText("Runde 1 · A")).toBeDefined();
		expect(screen.queryByText("Niemand hat etwas eingetragen.")).toBeNull();
	});

	it("leaves Enter on a focused button to that button", () => {
		setup("host", "RoundResult");
		render(<RoundResultScreen />);
		send.mockClear();
		screen.getByRole("button", { name: "Spiel beenden" }).focus();
		fireEvent.keyDown(window, { key: "Enter" });
		expect(send).not.toHaveBeenCalled();
		(document.activeElement as HTMLElement).blur();
		fireEvent.keyDown(window, { key: "Enter" });
		expect(send).toHaveBeenCalledWith({ type: "startNextRound", payload: {} });
	});

	it("gives a trophy only to a leader with points", () => {
		setup("guest", "RoundResult");
		const { container, unmount } = render(<RoundResultScreen />);
		expect(container.querySelectorAll(".lucide-trophy").length).toBe(1);
		unmount();
		const result = useRoomStore.getState().result!;
		useRoomStore.getState().receive("roundResult", {
			...result,
			ranking: [
				{ playerId: "host", rank: 1, score: 0 },
				{ playerId: "guest", rank: 1, score: 0 },
			],
		});
		const again = render(<RoundResultScreen />);
		expect(again.container.querySelectorAll(".lucide-trophy").length).toBe(0);
	});

	it("explains an empty round", () => {
		setup("guest", "RoundResult");
		const result = useRoomStore.getState().result!;
		useRoomStore.getState().receive("roundResult", { ...result, empty: true });
		render(<RoundResultScreen />);
		expect(screen.getByText("Niemand hat etwas eingetragen.")).toBeDefined();
	});

	it("leaves a guest waiting without host actions", () => {
		setup("guest", "RoundResult");
		render(<RoundResultScreen />);
		expect(screen.getByText("Warte auf den Host…")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Nächste Runde" })).toBeNull();
		expect(screen.queryByTitle("host entfernen")).toBeNull();
	});
});

describe("GameScreen", () => {
	it("gates the buzz on valid answers and shows it pending", () => {
		setup("guest", "Playing");
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Playing",
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		});
		render(<GameScreen />);
		expect(screen.queryByText("0/2")).toBeNull();
		const buzz = () =>
			screen.getByRole("button", {
				name: /STOPP|Gesendet/,
			}) as HTMLButtonElement;
		expect(buzz().disabled).toBe(true);

		fireEvent.change(document.getElementById("cat-c1") as Element, {
			target: { value: "Berlin" },
		});
		fireEvent.change(document.getElementById("cat-c2") as Element, {
			target: { value: "Ahaus" },
		});
		expect(buzz().disabled).toBe(true);

		fireEvent.change(document.getElementById("cat-c2") as Element, {
			target: { value: "Belgien" },
		});
		expect(buzz().disabled).toBe(false);

		fireEvent.click(buzz());
		expect(send).toHaveBeenCalledWith({
			type: "buzz",
			payload: { roundId: "r1" },
		});
		expect(buzz().disabled).toBe(true);
		expect(buzz().textContent).toBe("Gesendet…");
	});

	it("resends all answers when the session reconnects", () => {
		setup("guest", "Playing");
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Playing",
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		});
		render(<GameScreen />);
		fireEvent.change(document.getElementById("cat-c1") as Element, {
			target: { value: "Berlin" },
		});
		send.mockClear();
		act(() => useRoomStore.getState().setSession("s1", "guest"));
		expect(send).toHaveBeenCalledWith({
			type: "inputSync",
			payload: {
				roundId: "r1",
				answers: [{ categoryId: "c1", value: "Berlin" }],
			},
		});
	});

	it("drops the broken parts of a stored draft", () => {
		setup("guest", "Playing");
		localStorage.setItem("slf:answers:r2", '{"c1":"Bonn","c2":null}');
		useRoomStore.getState().receive("gameState", {
			roundId: "r2",
			state: "Playing",
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		});
		render(<GameScreen />);
		const field = (id: string) =>
			(document.getElementById(id) as HTMLInputElement).value;
		expect(field("cat-c1")).toBe("Bonn");
		expect(field("cat-c2")).toBe("");
	});
});

describe("Lobby", () => {
	it("shows a guest only the settings that differ from the default", () => {
		setup("guest", "Lobby");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				settings: {
					...lobby.settings,
					timeLimit: 60,
					excludedLetters: ["Y", "Q"],
				},
			},
		});
		render(<Lobby />);
		expect(screen.getByText("60 s · ohne Q Y")).toBeDefined();
		expect(screen.queryByText("Einstellungen")).toBeNull();
	});

	it("names every host button", () => {
		setup("host", "Lobby");
		render(<Lobby />);
		expect(
			screen.getByRole("button", { name: "Kategorie hinzufügen" }),
		).toBeDefined();
		for (const b of screen.getAllByRole("button")) {
			const name =
				b.textContent?.trim() ||
				b.getAttribute("aria-label") ||
				b.getAttribute("title");
			expect(name).toBeTruthy();
		}
	});
});

describe("review validity", () => {
	it("toggles a multiplayer answer by tapping its row", () => {
		setup("host", "Reviewing");
		useRoomStore.getState().receive("reviewState", {
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			ready: null,
			voters: null,
			answers: [
				{
					answerId: "guest",
					playerId: "guest",
					value: "Berlin",
					valid: true,
					mergedInto: "",
					pointsPreview: 25,
					votes: null,
					ruled: false,
				},
				{
					answerId: "host",
					playerId: "host",
					value: "Xanten",
					valid: false,
					mergedInto: "",
					pointsPreview: 0,
					votes: null,
					ruled: false,
				},
			],
		});
		render(<ReviewScreen />);
		expect(screen.getByText("beginnt nicht mit B")).toBeDefined();
		const row = screen.getAllByRole("switch")[0];
		expect(row.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(row);
		expect(send).toHaveBeenCalledWith({
			type: "setAnswerValidity",
			payload: { answerId: "guest", valid: false },
		});
	});
});

describe("Lobby players", () => {
	it("lists you, then the host, then the rest alphabetically", () => {
		setup("guest", "Lobby");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				players: [
					{ ...player("zoe", false), connected: false },
					player("host", true),
					player("anna", false),
					player("guest", false),
				],
			},
		});
		render(<Lobby />);
		const names = screen
			.getAllByText(/^(zoe|host|anna|guest)$/)
			.map((el) => el.textContent);
		expect(names).toEqual(["guest", "host", "anna", "zoe"]);
		expect(screen.getAllByText("offline").length).toBe(1);
	});
});

describe("Lobby time limit", () => {
	it("maps slider steps to server settings, including unlimited", () => {
		setup("host", "Lobby");
		render(<Lobby />);
		const slider = screen.getByRole("slider", { name: "Zeitlimit pro Runde" });
		for (const [step, timeLimit] of [30, 60, 90, 120, 180, null].entries()) {
			fireEvent.change(slider, { target: { value: String(step) } });
			expect(send).toHaveBeenLastCalledWith({
				type: "updateSettings",
				payload: { ...useRoomStore.getState().lobby!.settings, timeLimit },
			});
			act(() => {
				const lobby = useRoomStore.getState().lobby!;
				useRoomStore.setState({
					lobby: { ...lobby, settings: { ...lobby.settings, timeLimit } },
				});
			});
		}
	});
});

describe("Lobby letters", () => {
	it("keeps letters visible and exposes selection and reset", () => {
		setup("host", "Lobby");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				settings: { ...lobby.settings, excludedLetters: ["X", "Q"] },
			},
		});
		render(<Lobby />);
		expect(screen.getByText("24 von 26 aktiv")).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Q" }).getAttribute("aria-pressed"),
		).toBe("false");
		expect(
			screen.getByRole("button", { name: "A" }).getAttribute("aria-pressed"),
		).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "Q" }));
		expect(send).toHaveBeenLastCalledWith({
			type: "updateSettings",
			payload: { ...lobby.settings, excludedLetters: ["X"] },
		});
		fireEvent.click(screen.getByRole("button", { name: "Alle aktivieren" }));
		expect(send).toHaveBeenLastCalledWith({
			type: "updateSettings",
			payload: { ...lobby.settings, excludedLetters: [] },
		});
	});
});

describe("Lobby code card", () => {
	it("shares the join link when the browser can share", () => {
		const share = mock(async (_data: ShareData) => {});
		Object.defineProperty(navigator, "share", {
			value: share,
			configurable: true,
		});
		setup("host", "Lobby");
		render(<Lobby />);
		expect(screen.queryByText(/Strg\+C zum Kopieren/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Link teilen" }));
		expect(share).toHaveBeenCalledWith({
			url: `${window.location.origin}/join/123456`,
		});
		Reflect.deleteProperty(navigator, "share");
	});
});

describe("GameScreen timer", () => {
	it("shows a clock only with a time limit", () => {
		setup("guest", "Playing");
		const game = {
			roundId: "r1",
			state: "Playing" as const,
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		};
		useRoomStore.getState().receive("gameState", game);
		const { unmount } = render(<GameScreen />);
		expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
		unmount();
		useRoomStore.getState().receive("gameState", {
			...game,
			roundId: "r2",
			endsAt: Date.now() + 51_000,
		});
		render(<GameScreen />);
		expect(screen.getByText(/^0:5\d$/)).toBeDefined();
	});
});

describe("GameScreen field hint", () => {
	it("marks a wrong first letter at the field right away", () => {
		setup("guest", "Playing");
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Playing",
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		});
		render(<GameScreen />);
		const field = document.getElementById("cat-c1") as HTMLInputElement;
		fireEvent.change(field, { target: { value: "B" } });
		expect(field.getAttribute("aria-invalid")).toBeNull();
		fireEvent.blur(field);
		expect(screen.getByText("2-30 Buchstaben")).toBeDefined();
		fireEvent.change(field, { target: { value: "Xanten" } });
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText("beginnt nicht mit B")).toBeDefined();
	});
});

describe("GameScreen sprint", () => {
	it("takes a word per prompt and skips an empty one", () => {
		setup("host", "Playing");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: { ...lobby, solo: true, players: [player("host", true)] },
		});
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Playing",
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
			letters: ["B", "K"],
		});
		render(<GameScreen />);
		expect(screen.getByText("Stadt")).toBeDefined();
		const field = () => document.getElementById("sprint") as HTMLInputElement;
		fireEvent.change(field(), { target: { value: "Berlin" } });
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(send).toHaveBeenCalledWith({
			type: "sprintWord",
			payload: { roundId: "r1", pos: 0, value: "Berlin" },
		});
		expect(screen.getByText("Land")).toBeDefined();
		fireEvent.keyDown(field(), { key: "Enter" });
		expect(send).toHaveBeenCalledWith({
			type: "sprintWord",
			payload: { roundId: "r1", pos: 1, value: "" },
		});
		expect(field().placeholder).toBe("K…");
		expect(screen.getByRole("button", { name: /STOPP/ })).toBeDefined();
	});
});

describe("last-letter mode", () => {
	it("says the answer ends on the letter", () => {
		setup("guest", "Playing");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				settings: { ...lobby.settings, lastLetterMode: true },
			},
		});
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Playing",
			letter: "S",
			usedLetters: ["S"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		});
		render(<GameScreen />);
		expect(screen.getByText("endet auf S")).toBeDefined();
	});
});

describe("GameScreen countdown", () => {
	it("puts a shown letter big above a small count", () => {
		setup("guest", "Countdown");
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Countdown",
			letter: "K",
			usedLetters: ["K"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: 3,
			categoryCount: 2,
		});
		render(<GameScreen />);
		expect(screen.getByText("K").className).toContain("text-9xl");
		expect(screen.getByText("3").className).toContain("text-4xl");
	});
});

describe("GameScreen pending joiner", () => {
	it("tells a mid-game joiner when they play", () => {
		setup("guest", "Playing");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				players: [
					player("host", true),
					{ ...player("guest", false), pending: true },
				],
			},
		});
		useRoomStore.getState().receive("gameState", {
			roundId: "r1",
			state: "Playing",
			letter: "B",
			usedLetters: ["B"],
			remainingLetters: [],
			endsAt: null,
			serverNow: Date.now(),
			countdownRemaining: null,
			categoryCount: 2,
		});
		render(<GameScreen />);
		expect(
			screen.getByText("Du spielst ab der nächsten Runde mit."),
		).toBeDefined();
	});
});

describe("review merge", () => {
	const answer = (id: string, value: string) => ({
		answerId: id,
		playerId: id,
		value,
		valid: true,
		mergedInto: "",
		pointsPreview: 10,
		votes: null,
		ruled: false,
	});
	const review = (a: string, b: string) => ({
		roundId: "r1",
		letter: "T",
		categoryId: "c1",
		categoryIndex: 0,
		categoryCount: 2,
		ready: null,
		voters: null,
		answers: [answer("host", a), answer("guest", b)],
	});

	it("offers merging only for 2 different valid answers", () => {
		setup("host", "Reviewing");
		useRoomStore.getState().receive("reviewState", review("Tahn", "tahn "));
		const { unmount } = render(<ReviewScreen />);
		expect(screen.queryByText("Zusammenführen")).toBeNull();
		unmount();

		useRoomStore.getState().receive("reviewState", review("Tahn", "Tan"));
		render(<ReviewScreen />);
		fireEvent.click(screen.getAllByText("Zusammenführen")[0]);
		expect(
			screen.getByText("Antwort antippen, die gleich „Tahn“ ist"),
		).toBeDefined();
	});

	it("keeps the merge buttons out of the validity switch", () => {
		setup("host", "Reviewing");
		useRoomStore.getState().receive("reviewState", review("Tahn", "Tan"));
		render(<ReviewScreen />);
		for (const sw of screen.getAllByRole("switch")) {
			expect(sw.querySelector("button")).toBeNull();
		}
		expect(screen.getAllByText("Zusammenführen")).toHaveLength(2);
	});
});

describe("review voting", () => {
	it("lets a voter doubt another answer and say done", () => {
		setup("guest", "Reviewing");
		useRoomStore.getState().receive("reviewState", {
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			ready: ["host"],
			voters: ["host", "guest"],
			answers: [
				{
					answerId: "host",
					playerId: "host",
					value: "Bonn",
					valid: true,
					mergedInto: "",
					pointsPreview: 10,
					votes: null,
					ruled: false,
				},
				{
					answerId: "guest",
					playerId: "guest",
					value: "Berlin",
					valid: true,
					mergedInto: "",
					pointsPreview: 10,
					votes: { host: false },
					ruled: false,
				},
			],
		});
		render(<ReviewScreen />);
		const rows = screen.getAllByRole("switch");
		expect(rows).toHaveLength(1);
		fireEvent.click(rows[0]);
		expect(send).toHaveBeenCalledWith({
			type: "voteAnswer",
			payload: { answerId: "host", vote: -1 },
		});
		expect(screen.getByTitle("1 dagegen")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: /Fertig/ }));
		expect(send).toHaveBeenCalledWith({ type: "reviewReady", payload: {} });
	});
});

describe("review end reason", () => {
	it("says the time ran out", () => {
		setup("guest", "Reviewing");
		useRoomStore.getState().receive("reviewState", {
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			ready: null,
			voters: null,
			answers: [],
			endReason: "timeout",
		});
		render(<ReviewScreen />);
		expect(screen.getByText("Zeit abgelaufen")).toBeDefined();
	});
});

describe("host grace banner", () => {
	it("sits in the screen flow under the header", () => {
		setup("guest", "Lobby");
		useRoomStore.setState({ hostGrace: 30 });
		render(<Lobby />);
		const banner = screen.getByText(/Host getrennt - Lobby schließt in/);
		expect(banner.closest(".fixed")).toBeNull();
		useRoomStore.setState({ hostGrace: null });
	});
});

describe("Home join code", () => {
	it("uses a descriptive placeholder instead of a sample code", () => {
		useRoomStore.setState({ lobby: null });
		render(<Home />);
		expect(screen.getByPlaceholderText("6-stelliger Code")).toBeDefined();
	});

	it("keeps the field focusable while the code is checked", () => {
		useRoomStore.setState({ lobby: null });
		render(<Home />);
		expect(screen.getByText("Prüfe…")).toBeDefined();
		const field = screen.getByLabelText("Lobbycode") as HTMLInputElement;
		expect(field.disabled).toBe(false);
		expect(field.readOnly).toBe(true);
	});
});
it("announces the final seconds", () => {
	setup("guest", "Playing");
	useRoomStore.getState().receive("gameState", {
		roundId: "r3",
		state: "Playing",
		letter: "B",
		usedLetters: ["B"],
		remainingLetters: [],
		endsAt: Date.now() + 3_500,
		serverNow: Date.now(),
		countdownRemaining: null,
		categoryCount: 2,
	});
	render(<GameScreen />);
	expect(screen.getByText("Noch 4 Sekunden")).toBeDefined();
});

describe("GameOverScreen stats", () => {
	const gameOver = (me: string) => {
		setup(me, "GameOver");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				players: lobby.players.map((p) => ({ ...p, score: 10 })),
			},
		});
		useRoomStore.getState().receive("roundResult", {
			letter: "A",
			scores: [],
			ranking: [{ playerId: "host", rank: 1, score: 10 }],
			usedLetters: ["A"],
			remainingLetters: [],
			isGameOver: true,
		});
	};

	it("leaves a spectator's records untouched", () => {
		gameOver("guest");
		render(<GameOverScreen />);
		expect(localStorage.getItem("slf:stats")).toBeNull();
	});

	it("records a ranked player once, even on a remount", () => {
		gameOver("host");
		render(<GameOverScreen />).unmount();
		const saved = localStorage.getItem("slf:stats");
		expect(JSON.parse(saved ?? "{}").best["multi-classic"]).toBe(10);
		render(<GameOverScreen />);
		expect(localStorage.getItem("slf:stats")).toBe(saved);
	});
});
