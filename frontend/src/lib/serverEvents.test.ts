import { describe, expect, it } from "vitest";
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
    expect(parseServerEvent(JSON.stringify({ type: "nope", payload: {} }))).toBeNull();
  });

  it("parses a valid lobbyCheck event", () => {
    const ev = parseServerEvent(
      JSON.stringify({
        type: "lobbyCheck",
        payload: { lobbyCode: "abc123", available: false, reason: "inProgress" },
      })
    );
    expect(ev).not.toBeNull();
    expect(ev?.type).toBe("lobbyCheck");
    if (ev?.type === "lobbyCheck") {
      expect(ev.payload.available).toBe(false);
      expect(ev.payload.reason).toBe("inProgress");
    }
  });

  it("stays lenient about an unknown lobbyCheck reason", () => {
    const ev = parseServerEvent(
      JSON.stringify({
        type: "lobbyCheck",
        payload: { lobbyCode: "abc123", available: false, reason: "somethingNew" },
      })
    );
    expect(ev?.type).toBe("lobbyCheck");
  });

  it("parses a valid error event", () => {
    const ev = parseServerEvent(
      JSON.stringify({
        type: "error",
        payload: { code: "LOBBY_NOT_FOUND", message: "Lobby nicht gefunden", severity: "warn" },
      })
    );
    expect(ev?.type).toBe("error");
  });

  it("rejects an error event missing required fields", () => {
    expect(
      parseServerEvent(JSON.stringify({ type: "error", payload: { code: "X" } }))
    ).toBeNull();
  });

  it("tolerates an extra top-level envelope field (stateVersion)", () => {
    const ev = parseServerEvent(
      JSON.stringify({
        type: "lobbyCheck",
        payload: { lobbyCode: "abc123", available: true },
        stateVersion: 7,
      })
    );
    expect(ev?.type).toBe("lobbyCheck");
  });
});
