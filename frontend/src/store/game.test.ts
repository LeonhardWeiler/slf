import { describe, expect, it } from "bun:test";
import { useGameStore } from "@/store/game";
import type { GameStatePayload } from "@/types/events";

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
		useGameStore
			.getState()
			.setGame(payload(before + skew + 60_000, before + skew));
		const endsAt = useGameStore.getState().game?.endsAt ?? 0;
		expect(endsAt - before).toBeGreaterThanOrEqual(60_000);
		expect(endsAt - Date.now()).toBeLessThanOrEqual(60_000);
	});

	it("keeps an unlimited round unlimited", () => {
		useGameStore.getState().setGame(payload(null, 0));
		expect(useGameStore.getState().game?.endsAt).toBeNull();
	});

	it("clears the pending buzz on a rejection or a new game state", () => {
		const s = useGameStore.getState();
		s.buzz();
		expect(useGameStore.getState().buzzing).toBe(true);
		s.setBuzzRejected("invalidAnswers");
		expect(useGameStore.getState().buzzing).toBe(false);
		s.buzz();
		s.setGame(payload(null, 0));
		expect(useGameStore.getState().buzzing).toBe(false);
	});
});
