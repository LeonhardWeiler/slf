// Set when the player is pulled out of or leaves a lobby: the URL is still /join/:code,
// and Home must not treat it as a deep link.
let forcedLeave = false;

export function markForcedLeave(): void {
	forcedLeave = true;
}

export function consumeForcedLeave(): boolean {
	const value = forcedLeave;
	forcedLeave = false;
	return value;
}
