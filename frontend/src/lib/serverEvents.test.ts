import { describe, expect, it } from "bun:test";
import { parseServerEvent } from "./serverEvents";

// parseServerEvent is the trust boundary for every incoming server message: it
// must reject malformed / unexpected shapes (returning null) and accept valid
// ones as typed events.

describe("parseServerEvent", () => {
	it("returns null for non-JSON input", () => {
		expect(parseServerEvent("not json")).toBeNull();
		expect(parseServerEvent("")).toBeNull();
	});

	it("returns null for an unknown event type", () => {
		expect(
			parseServerEvent(JSON.stringify({ type: "nope", payload: {} })),
		).toBeNull();
	});

	it("parses a valid lobbyCheck event", () => {
		const ev = parseServerEvent(
			JSON.stringify({
				type: "lobbyCheck",
				payload: { lobbyCode: "abc123", available: false, reason: "full" },
			}),
		);
		expect(ev).not.toBeNull();
		expect(ev?.type).toBe("lobbyCheck");
		if (ev?.type === "lobbyCheck") {
			expect(ev.payload.available).toBe(false);
			expect(ev.payload.reason).toBe("full");
		}
	});

	it("stays lenient about an unknown lobbyCheck reason", () => {
		const ev = parseServerEvent(
			JSON.stringify({
				type: "lobbyCheck",
				payload: {
					lobbyCode: "abc123",
					available: false,
					reason: "somethingNew",
				},
			}),
		);
		expect(ev?.type).toBe("lobbyCheck");
	});

	it("parses a valid error event", () => {
		const ev = parseServerEvent(
			JSON.stringify({
				type: "error",
				payload: {
					code: "LOBBY_NOT_FOUND",
					message: "Lobby nicht gefunden",
					severity: "warn",
				},
			}),
		);
		expect(ev?.type).toBe("error");
	});

	it("rejects an error event missing required fields", () => {
		expect(
			parseServerEvent(
				JSON.stringify({ type: "error", payload: { code: "X" } }),
			),
		).toBeNull();
	});

	it("parses a reviewState carrying buzzedBy", () => {
		const ev = parseServerEvent(
			JSON.stringify({
				type: "reviewState",
				payload: {
					roundId: "r1",
					letter: "A",
					categoryId: "c1",
					categoryIndex: 0,
					categoryCount: 3,
					answers: [],
					buzzedBy: "p42",
				},
			}),
		);
		expect(ev?.type).toBe("reviewState");
		if (ev?.type === "reviewState") {
			expect(ev.payload.buzzedBy).toBe("p42");
		}
	});

	it("accepts a reviewState without buzzedBy (timeout / older server)", () => {
		const ev = parseServerEvent(
			JSON.stringify({
				type: "reviewState",
				payload: {
					roundId: "r1",
					letter: "A",
					categoryId: "c1",
					categoryIndex: 0,
					categoryCount: 3,
					answers: [],
				},
			}),
		);
		expect(ev?.type).toBe("reviewState");
		if (ev?.type === "reviewState") {
			expect(ev.payload.buzzedBy).toBeUndefined();
		}
	});

	it("tolerates an extra top-level envelope field (stateVersion)", () => {
		const ev = parseServerEvent(
			JSON.stringify({
				type: "lobbyCheck",
				payload: { lobbyCode: "abc123", available: true },
				stateVersion: 7,
			}),
		);
		expect(ev?.type).toBe("lobbyCheck");
	});
});
