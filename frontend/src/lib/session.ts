// Session storage for the player's reconnect identity.
//
// We deliberately use sessionStorage (per-tab) instead of localStorage
// (per-origin, shared across all tabs). With localStorage every new tab in the
// same browser would auto-reconnect into the *same* session, making it
// impossible to be a second, independent player from another tab. sessionStorage
// still survives a page reload (F5), which covers the SRS reconnect requirement,
// while giving each tab its own identity.
const KEY = "sessionId";

export function getSessionId(): string | null {
  return sessionStorage.getItem(KEY);
}

export function setSessionId(id: string): void {
  sessionStorage.setItem(KEY, id);
}

export function clearSessionId(): void {
  sessionStorage.removeItem(KEY);
}
