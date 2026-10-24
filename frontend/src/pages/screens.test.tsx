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
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
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
const { SoloReviewScreen } = await import("@/pages/game/SoloReviewScreen");
const { GameOverScreen } = await import("@/pages/game/GameOverScreen");
const { Lobby } = await import("@/pages/Lobby");
const { renderScreen } = await import("@/pages/Room");
const { Home } = await import("@/pages/Home");

const render = (ui: ReactNode) => rtlRender(ui);

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
				sprint: false,
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
		expect(
			screen.getByRole("button", { name: "guest entfernen" }),
		).toBeDefined();
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

	it("gives a crown only to a leader with points", async () => {
		setup("guest", "RoundResult");
		const { container, unmount } = render(<RoundResultScreen />);
		await waitFor(
			() =>
				expect(container.querySelectorAll(".pos .lucide-crown").length).toBe(1),
			{ timeout: 2000 },
		);
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
		expect(again.container.querySelectorAll(".pos .lucide-crown").length).toBe(
			0,
		);
	});

	it("shows a sad mascot after an empty round", () => {
		setup("guest", "RoundResult");
		const result = useRoomStore.getState().result!;
		useRoomStore.getState().receive("roundResult", { ...result, empty: true });
		const { container } = render(<RoundResultScreen />);
		expect(container.querySelector(".mascot")?.getAttribute("data-base")).toBe(
			"sad",
		);
	});

	it("leaves a guest waiting without host actions", () => {
		setup("guest", "RoundResult");
		render(<RoundResultScreen />);
		expect(document.querySelector(".waiting")).not.toBeNull();
		expect(screen.queryByRole("button", { name: "Nächste Runde" })).toBeNull();
		expect(screen.queryByRole("button", { name: "host entfernen" })).toBeNull();
	});
});

describe("GameScreen", () => {
	it("walks the sprint prompts and refuses a wrong word", () => {
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
			letters: ["B", "K"],
		});
		render(<GameScreen />);
		send.mockClear();
		const enter = (label: string, value: string) => {
			const input = screen.getByLabelText(label);
			fireEvent.change(input, { target: { value } });
			fireEvent.keyDown(input, { key: "Enter" });
		};
		enter("Stadt mit B", "Aachen");
		expect(send).not.toHaveBeenCalled();
		enter("Stadt mit B", "Berlin");
		enter("Land mit B", "");
		enter("Stadt mit K", "Köln");
		expect(send.mock.calls.map((c) => c[0])).toEqual([
			{
				type: "sprintWord",
				payload: { roundId: "r1", pos: 0, value: "Berlin" },
			},
			{ type: "sprintWord", payload: { roundId: "r1", pos: 1, value: "" } },
			{ type: "sprintWord", payload: { roundId: "r1", pos: 2, value: "Köln" } },
		]);
		expect(screen.getByLabelText("Land mit K")).not.toBeNull();
		expect(document.querySelector(".sprint-count")?.textContent).toBe("2");
	});

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
		const buzz = () => screen.getByRole("button", { name: /STOPP/ });
		const off = () => buzz().getAttribute("aria-disabled");
		expect(off()).toBe("true");

		fireEvent.change(document.getElementById("cat-c1") as Element, {
			target: { value: "Berlin" },
		});
		fireEvent.change(document.getElementById("cat-c2") as Element, {
			target: { value: "Ahaus" },
		});
		expect(off()).toBe("true");

		fireEvent.change(document.getElementById("cat-c2") as Element, {
			target: { value: "Belgien" },
		});
		expect(off()).toBe("false");

		fireEvent.click(buzz());
		expect(send).toHaveBeenCalledWith({
			type: "buzz",
			payload: { roundId: "r1" },
		});
		expect(off()).toBe("true");
		expect(buzz().querySelector(".spin")).not.toBeNull();
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
	it("shows a guest the settings read-only", () => {
		setup("guest", "Lobby");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				settings: {
					...lobby.settings,
					timeLimit: 60,
					lastLetterMode: true,
					excludedLetters: ["Y", "Q"],
				},
			},
		});
		const { container } = render(<Lobby />);
		expect(container.querySelector(".panel")?.hasAttribute("inert")).toBe(true);
		expect(
			screen
				.getByRole("button", {
					name: "Letzter Buchstabe: Antworten müssen mit dem Buchstaben enden statt beginnen",
				})
				.getAttribute("aria-pressed"),
		).toBe("true");
		expect(screen.queryByRole("button", { name: "Spiel starten" })).toBeNull();
	});

	it("names every host button", () => {
		setup("host", "Lobby");
		render(<Lobby />);
		expect(
			screen.getByRole("textbox", { name: "Neue Kategorie" }),
		).toBeDefined();
		for (const b of screen.getAllByRole("button")) {
			expect(
				b.textContent?.trim() || b.getAttribute("aria-label"),
			).toBeTruthy();
		}
	});
});

describe("review validity", () => {
	it("lets the host overrule an answer", () => {
		setup("host", "Reviewing");
		useRoomStore.getState().receive("reviewState", {
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
			solo: null,
			ready: null,
			voters: null,
			endsAt: null,
			serverNow: 0,
		});
		const { container } = render(<ReviewScreen />);
		expect(container.querySelectorAll(".ans.cracked").length).toBe(1);
		fireEvent.click(
			screen.getByRole("button", { name: "Als ungültig festlegen" }),
		);
		expect(send).toHaveBeenCalledWith({
			type: "setAnswerValidity",
			payload: { answerId: "guest", valid: false },
		});
	});

	it("toggles a solo answer by tapping its row", () => {
		setup("guest", "Reviewing");
		useRoomStore.getState().receive("reviewState", {
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			answers: [],
			solo: [
				{
					key: "c1",
					letter: "B",
					categoryId: "c1",
					value: "Bonn",
					valid: false,
					points: 0,
				},
				{
					key: "c2",
					letter: "B",
					categoryId: "c2",
					value: "",
					valid: false,
					points: 0,
				},
			],
			ready: null,
			voters: null,
			endsAt: null,
			serverNow: 0,
		});
		render(<SoloReviewScreen />);
		const rows = screen.getAllByRole("switch") as HTMLButtonElement[];
		expect(rows.map((r) => r.disabled)).toEqual([false, true]);
		fireEvent.click(rows[0]);
		expect(send).toHaveBeenCalledWith({
			type: "setAnswerValidity",
			payload: { answerId: "guest", valid: true, categoryId: "c1" },
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
		const names = [...document.querySelectorAll(".seat-name")].map(
			(el) => el.textContent,
		);
		expect(names).toEqual(["guest", "host", "anna", "zoe"]);
		expect(document.querySelectorAll(".seat.off").length).toBe(1);
	});
});

describe("Lobby time limit", () => {
	it("maps slider steps to server settings, including unlimited", () => {
		setup("host", "Lobby");
		render(<Lobby />);
		const slider = screen.getByRole("slider", { name: "Zeitlimit" });
		for (const [step, timeLimit] of [30, 60, 90, 120, 180, null].entries()) {
			fireEvent.change(slider, { target: { value: String(step) } });
			fireEvent.pointerUp(slider);
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
	it("opens a letter sheet with presets and single letters", () => {
		setup("host", "Lobby");
		const lobby = useRoomStore.getState().lobby!;
		useRoomStore.setState({
			lobby: {
				...lobby,
				settings: { ...lobby.settings, excludedLetters: ["X", "Q"] },
			},
		});
		render(<Lobby />);
		fireEvent.click(
			screen.getByRole("button", { name: "Buchstaben auswählen" }),
		);
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
		fireEvent.click(
			screen.getByRole("button", {
				name: "Ohne seltene Buchstaben C, J, Q, X, Y",
			}),
		);
		expect(send).toHaveBeenLastCalledWith({
			type: "updateSettings",
			payload: {
				...lobby.settings,
				excludedLetters: ["C", "J", "Q", "X", "Y"],
			},
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
		fireEvent.click(screen.getByRole("button", { name: "QR-Code" }));
		fireEvent.click(screen.getByRole("button", { name: "Teilen" }));
		expect(share).toHaveBeenCalledWith({
			url: `${window.location.origin}/join/123456`,
		});
		Reflect.deleteProperty(navigator, "share");
	});
});

describe("GameScreen timer", () => {
	it("burns a fuse only with a time limit", () => {
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
		expect(screen.queryByRole("timer")).toBeNull();
		unmount();
		useRoomStore.getState().receive("gameState", {
			...game,
			roundId: "r2",
			endsAt: Date.now() + 51_000,
		});
		render(<GameScreen />);
		expect(screen.getByRole("timer").getAttribute("aria-label")).toMatch(
			/^5\d Sekunden$/,
		);
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
		expect(screen.getByText("2-30 Zeichen")).toBeDefined();
		fireEvent.change(field, { target: { value: "Xanten" } });
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText("beginnt nicht mit B")).toBeDefined();
	});
});

describe("GameScreen solo", () => {
	it("lets a solo player stop with empty fields and hides the end button", () => {
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
		});
		render(<GameScreen />);
		const buzz = screen.getByRole("button", { name: /STOPP/ });
		expect(buzz.getAttribute("aria-disabled")).toBe("false");
		expect(screen.queryByRole("button", { name: "Runde beenden" })).toBeNull();
	});
});

describe("last-letter mode", () => {
	it("ghosts the letter at the end", () => {
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
		expect(screen.getAllByText("…S").length).toBeGreaterThan(0);
	});
});

describe("GameScreen countdown", () => {
	it("shows the letter on the mascot above the count", () => {
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
		expect(screen.getByText("K").className).toBe("m-letter");
		expect(document.querySelector(".count")?.textContent).toBe("3");
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
			document.querySelector(
				'[data-tip="Du spielst ab der nächsten Runde mit"]',
			),
		).not.toBeNull();
		expect(document.getElementById("cat-c1")).toBeNull();
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
		answers: [answer("host", a), answer("guest", b)],
		solo: null,
		ready: null,
		voters: null,
		endsAt: null,
		serverNow: 0,
	});

	it("offers merging only for 2 different valid answers", () => {
		setup("host", "Reviewing");
		useRoomStore.getState().receive("reviewState", review("Tahn", "tahn "));
		const { unmount } = render(<ReviewScreen />);
		expect(screen.queryByRole("button", { name: "Zusammenführen" })).toBeNull();
		unmount();

		useRoomStore.getState().receive("reviewState", review("Tahn", "Tan"));
		render(<ReviewScreen />);
		fireEvent.click(
			screen.getAllByRole("button", { name: "Zusammenführen" })[0],
		);
		expect(
			screen.getByRole("button", { name: "Verbinden abbrechen" }),
		).toBeDefined();
	});

	it("merges the picked answer into the anchor", () => {
		setup("host", "Reviewing");
		useRoomStore.getState().receive("reviewState", review("Tahn", "Tan"));
		const { container } = render(<ReviewScreen />);
		fireEvent.click(
			screen.getAllByRole("button", { name: "Zusammenführen" })[0],
		);
		fireEvent.click(container.querySelectorAll(".ans")[1]);
		expect(send).toHaveBeenCalledWith({
			type: "mergeAnswers",
			payload: { targetAnswerId: "host", sourceAnswerId: "guest" },
		});
	});
});

describe("review end reason", () => {
	it("marks a timeout", () => {
		setup("guest", "Reviewing");
		useRoomStore.getState().receive("reviewState", {
			roundId: "r1",
			letter: "B",
			categoryId: "c1",
			categoryIndex: 0,
			categoryCount: 2,
			answers: [],
			endReason: "timeout",
			solo: null,
			ready: null,
			voters: null,
			endsAt: null,
			serverNow: 0,
		});
		render(<ReviewScreen />);
		expect(
			document.querySelector('[data-tip="Zeit abgelaufen"]'),
		).not.toBeNull();
	});
});

describe("host grace banner", () => {
	it("alerts everyone while the host is gone", () => {
		setup("guest", "Lobby");
		useRoomStore.setState({ hostGrace: 30 });
		render(<Lobby />);
		expect(screen.getByRole("alert").textContent).toContain("Host getrennt");
		useRoomStore.setState({ hostGrace: null });
	});
});

describe("Home join code", () => {
	it("opens the code step on a join link", () => {
		useRoomStore.setState({ lobby: null });
		render(<Home />);
		expect(screen.getByRole("textbox", { name: "Lobbycode" })).toBeDefined();
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
	expect(document.querySelector(".fuse .sr-only")?.textContent).toBe("4");
});
