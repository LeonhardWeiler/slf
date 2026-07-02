// Session storage for the player's reconnect identity.
//
// We use localStorage (per-origin) rather than sessionStorage (per-tab) so the
// identity survives closing and reopening the browser tab: on the next visit the
// stored sessionId is replayed and — if the lobby still exists — the player
// rejoins as the same person with the same name, score and settings (a host
// keeps their role within the 15s grace window). The trade-off is that all tabs
// of the same browser share one identity; opening a second tab reconnects into
// the same session rather than acting as an independent player. An explicit
// "Verlassen" clears the stored id (see lobby store reset), so that is a
// deliberate, final exit — only a tab close / connection drop stays rejoinable.
const KEY = "sessionId";

export function getSessionId(): string | null {
  return localStorage.getItem(KEY);
}

export function setSessionId(id: string): void {
  localStorage.setItem(KEY, id);
}

export function clearSessionId(): void {
  localStorage.removeItem(KEY);
}
