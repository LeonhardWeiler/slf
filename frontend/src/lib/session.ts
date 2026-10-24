import { storage } from "./storage";

// Session storage for the player's reconnect identity.
//
// We use localStorage (per-origin) rather than sessionStorage (per-tab) so the
// identity survives closing and reopening the browser tab: on the next visit the
// stored sessionId is replayed and - if the lobby still exists - the player
// rejoins as the same person with the same name, score and settings (a host
// keeps their role within the 15s grace window). The trade-off is that all tabs
// of the same browser share one identity; opening a second tab reconnects into
// the same session rather than acting as an independent player. An explicit
// "Verlassen" clears the stored id (see lobby store reset), so that is a
// deliberate, final exit - only a tab close / connection drop stays rejoinable.
const KEY = "sessionId";

export function getSessionId(): string | null {
	return storage.get(KEY);
}

export function setSessionId(id: string): void {
	storage.set(KEY, id);
}

export function clearSessionId(): void {
	storage.remove(KEY);
	clearDrafts();
}

// Draft answers of a round, kept so a reload mid-round restores
// them. They are only needed while that round runs.
export const answersKey = (roundId: string) => `slf:answers:${roundId}`;

export function clearDrafts(keepRoundId = ""): void {
	const keep = answersKey(keepRoundId);
	for (const k of storage.keys()) {
		if (k.startsWith("slf:answers:") && k !== keep) storage.remove(k);
	}
}
