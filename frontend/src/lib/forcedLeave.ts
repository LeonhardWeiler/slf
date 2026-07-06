// One-shot flag set when the player is pulled out of a lobby (kicked, lobby
// closed, stale session) or leaves themselves. All these paths navigate to "/"
// while the URL is still the lobby's /join/:code — without this flag the Home
// screen would treat that code as a deep link and re-run the join check, briefly
// flashing "Diese Lobby gibt es nicht." instead of showing the start screen.
let forcedLeave = false;

export function markForcedLeave(): void {
  forcedLeave = true;
}

// Reads and clears the flag. Home consumes it on mount to decide whether to skip
// the deep-link auto-join for this navigation.
export function consumeForcedLeave(): boolean {
  const value = forcedLeave;
  forcedLeave = false;
  return value;
}
