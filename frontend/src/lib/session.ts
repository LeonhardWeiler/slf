import { storage } from "./storage";

// localStorage, not sessionStorage: the identity survives closing the tab, and all tabs share it.
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
