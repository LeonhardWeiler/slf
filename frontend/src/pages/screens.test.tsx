import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	act,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { useGameStore } from "@/store/game";
import { useLobbyStore } from "@/store/lobby";
import type { LobbyStatePayload, Player } from "@/types/events";

const send = mock((_msg: unknown) => {});
mock.module("@/lib/ws", () => ({
	ws: {
		send,
		status: true,
		onStatusChange: () => () => {},
		on: () => {},
		off: () => {},
	},
}));
mock.module("@/lib/nav", () => ({
	navigate: () => {},
	usePath: () => "/join/abc123",
	joinCode: () => "abc123",
	Navigate: () => null,
}));

const { GameScreen } = await import("@/pages/game/GameScreen");
const { RoundResultScreen } = await import("@/pages/game/RoundResultScreen");
const { ReviewScreen } = await import("@/pages/game/ReviewScreen");
const { SoloReviewScreen } = await import("@/pages/game/SoloReviewScreen");
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
});

function setup(me: string, state: LobbyStatePayload["state"]) {
	useLobbyStore.setState({
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
				showLetterDuringCountdown: false,
				excludedLetters: [],
				hostPlays: true,
				lastLetterMode: false,
				flamesEnabled: false,
			},
			state,
			solo: false,
		},
	});
}

beforeEach(() => {
	send.mockClear();
	localStorage.clear();
	useGameStore.getState().resetGame();
});

describe("Room", () => {
	it("maps each lobby state to its screen", () => {
		expect(renderScreen("Lobby", false).type).toBe(Lobby);
		expect(renderScreen("Countdown", false).type).toBe(GameScreen);
		expect(renderScreen("Playing", false).type).toBe(GameScreen);
		expect(renderScreen("Reviewing", false).type).toBe(ReviewScreen);
		expect(renderScreen("Reviewing", true).type).toBe(SoloReviewScreen);
		expect(renderScreen("RoundResult", false).type).toBe(RoundResultScreen);
		expect(renderScreen("GameOver", false).type).toBe(GameOverScreen);
	});
});

describe("RoundResultScreen", () => {
	beforeEach(() => {
		useGameStore.getState().setResult({
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

	it("gives a trophy only to a leader with points", () => {
		setup("guest", "RoundResult");
		const { container, unmount } = render(<RoundResultScreen />);
		expect(container.querySelectorAll(".lucide-trophy").length).toBe(1);
		unmount();
		const result = useGameStore.getState().result!;
		useGameStore.getState().setResult({
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
		const result = useGameStore.getState().result!;
		useGameStore.getState().setResult({ ...result, empty: true });
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
		useGameStore.getState().setGame({
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
		useGameStore.getState().setGame({
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
		act(() => useLobbyStore.getState().setSession("s1", "guest"));
		expect(send).toHaveBeenCalledWith({
			type: "inputSync",
			payload: {
				roundId: "r1",
				answers: [{ categoryId: "c1", value: "Berlin" }],
			},
		});
	});
});

describe("Lobby", () => {
	it("shows a guest only the settings that differ from the default", () => {
		setup("guest", "Lobby");
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
			lobby: {
				...lobby,
				settings: {
					...lobby.settings,
					timeLimit: 60,
					flamesEnabled: true,
					excludedLetters: ["Y", "Q"],
				},
			},
		});
		render(<Lobby />);
		expect(screen.getByText("60 s · Flammen · ohne Q Y")).toBeDefined();
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
		useGameStore.getState().setReview({
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			answers: [
				{
					answerId: "guest",
					playerId: "guest",
					value: "Berlin",
					valid: true,
					mergedInto: "",
					pointsPreview: 25,
					flamed: true,
				},
				{
					answerId: "host",
					playerId: "host",
					value: "Xanten",
					valid: false,
					mergedInto: "",
					pointsPreview: 0,
					flamed: false,
				},
			],
			solo: null,
		});
		render(<ReviewScreen />);
		expect(screen.getByText("Flamme +5")).toBeDefined();
		expect(screen.getByText("beginnt nicht mit B")).toBeDefined();
		const row = screen.getAllByRole("switch")[0];
		expect(row.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(row);
		expect(send).toHaveBeenCalledWith({
			type: "setAnswerValidity",
			payload: { answerId: "guest", valid: false },
		});
	});

	it("toggles a solo answer by tapping its row", () => {
		setup("guest", "Reviewing");
		useGameStore.getState().setReview({
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			answers: [],
			solo: [
				{ categoryId: "c1", value: "Bonn", valid: false, points: 0 },
				{ categoryId: "c2", value: "", valid: false, points: 0 },
			],
		});
		render(<SoloReviewScreen />);
		const rows = screen.getAllByRole("switch");
		expect(rows.length).toBe(1);
		fireEvent.keyDown(rows[0], { key: " " });
		expect(send).toHaveBeenCalledWith({
			type: "setAnswerValidity",
			payload: { answerId: "guest", valid: true, categoryId: "c1" },
		});
	});
});

describe("Lobby players", () => {
	it("lists you, then the host, then the rest alphabetically", () => {
		setup("guest", "Lobby");
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
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

describe("Lobby letters", () => {
	it("folds the letter grid behind a summary of the excluded letters", () => {
		setup("host", "Lobby");
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
			lobby: {
				...lobby,
				settings: { ...lobby.settings, excludedLetters: ["X", "Q"] },
			},
		});
		const { container } = render(<Lobby />);
		expect(container.querySelector("summary")?.textContent).toBe(
			"Buchstaben: ohne Q X▸",
		);
		expect(container.querySelector("details")?.open).toBe(false);
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
		useGameStore.getState().setGame(game);
		const { unmount } = render(<GameScreen />);
		expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
		unmount();
		useGameStore
			.getState()
			.setGame({ ...game, roundId: "r2", endsAt: Date.now() + 51_000 });
		render(<GameScreen />);
		expect(screen.getByText(/^0:5\d$/)).toBeDefined();
	});
});

describe("GameScreen field hint", () => {
	it("marks a wrong first letter at the field right away", () => {
		setup("guest", "Playing");
		useGameStore.getState().setGame({
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
		expect(screen.getByText("2-30 Zeichen")).toBeDefined();
		fireEvent.change(field, { target: { value: "Xanten" } });
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText("beginnt nicht mit B")).toBeDefined();
	});
});

describe("GameScreen solo", () => {
	it("lets a solo player stop with empty fields and hides the end button", () => {
		setup("host", "Playing");
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
			lobby: { ...lobby, solo: true, players: [player("host", true)] },
		});
		useGameStore.getState().setGame({
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
		const buzz = screen.getByRole("button", { name: /STOPP/ });
		expect((buzz as HTMLButtonElement).disabled).toBe(false);
		expect(screen.queryByRole("button", { name: "Runde beenden" })).toBeNull();
	});
});

describe("GameScreen flames", () => {
	it("explains the flame bet only in the first round with flames", () => {
		setup("guest", "Playing");
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
			lobby: { ...lobby, settings: { ...lobby.settings, flamesEnabled: true } },
		});
		useGameStore.getState().setGame({
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
		const hint = "🔥 Wette: einzige Antwort +5, sonst 0";
		const { unmount } = render(<GameScreen />);
		expect(screen.getByText(hint)).toBeDefined();
		expect(
			screen.getAllByRole("button", { name: "Flamme setzen" }).length,
		).toBe(2);
		unmount();
		render(<GameScreen />);
		expect(screen.queryByText(hint)).toBeNull();
	});
});

describe("last-letter mode", () => {
	it("says the answer ends on the letter", () => {
		setup("guest", "Playing");
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
			lobby: {
				...lobby,
				settings: { ...lobby.settings, lastLetterMode: true },
			},
		});
		useGameStore.getState().setGame({
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
		useGameStore.getState().setGame({
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
		const lobby = useLobbyStore.getState().lobby!;
		useLobbyStore.setState({
			lobby: {
				...lobby,
				players: [
					player("host", true),
					{ ...player("guest", false), pending: true },
				],
			},
		});
		useGameStore.getState().setGame({
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
		flamed: false,
	});
	const review = (a: string, b: string) => ({
		roundId: "r1",
		letter: "T",
		categoryId: "c1",
		categoryIndex: 0,
		categoryCount: 2,
		answers: [answer("host", a), answer("guest", b)],
		solo: null,
	});

	it("offers merging only for 2 different valid answers", () => {
		setup("host", "Reviewing");
		useGameStore.getState().setReview(review("Tahn", "tahn "));
		const { unmount } = render(<ReviewScreen />);
		expect(screen.queryByText("Zusammenführen")).toBeNull();
		unmount();

		useGameStore.getState().setReview(review("Tahn", "Tan"));
		render(<ReviewScreen />);
		fireEvent.click(screen.getAllByText("Zusammenführen")[0]);
		expect(
			screen.getByText("Antwort antippen, die gleich „Tahn“ ist"),
		).toBeDefined();
	});

	it("keeps the merge buttons out of the validity switch", () => {
		setup("host", "Reviewing");
		useGameStore.getState().setReview(review("Tahn", "Tan"));
		render(<ReviewScreen />);
		for (const sw of screen.getAllByRole("switch")) {
			expect(sw.querySelector("button")).toBeNull();
		}
		expect(screen.getAllByText("Zusammenführen")).toHaveLength(2);
	});
});

describe("review end reason", () => {
	it("says the time ran out", () => {
		setup("guest", "Reviewing");
		useGameStore.getState().setReview({
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			answers: [],
			endReason: "timeout",
			solo: null,
		});
		render(<ReviewScreen />);
		expect(screen.getByText("Zeit abgelaufen")).toBeDefined();
	});
});

describe("host grace banner", () => {
	it("sits in the screen flow under the header", () => {
		setup("guest", "Lobby");
		useLobbyStore.setState({ hostGrace: 30 });
		render(<Lobby />);
		const banner = screen.getByText(/Host getrennt - Lobby schließt in/);
		expect(banner.closest(".fixed")).toBeNull();
		useLobbyStore.setState({ hostGrace: null });
	});
});

describe("Home join code", () => {
	it("uses a descriptive placeholder instead of a sample code", () => {
		useLobbyStore.setState({ lobby: null });
		render(<Home />);
		expect(screen.getByPlaceholderText("6-stelliger Code")).toBeDefined();
	});
});
