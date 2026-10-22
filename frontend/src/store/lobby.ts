import { create } from "zustand";
import type { LobbyPatchPayload, LobbyStatePayload } from "@/types/events";
import { setSessionId, clearSessionId } from "@/lib/session";

interface LobbyStore {
	lobby: LobbyStatePayload | null;
	myPlayerId: string | null;
	mySessionId: string | null;
	// Seconds left until the lobby closes because the host is disconnected; null
	// when the host is present (SRS 4.6/8.5). Shown as a shared countdown banner.
	hostGrace: number | null;
	// True between the moment we click "Verlassen" and the server's lobbyClosed
	// echo. The host also receives that echo, but shouldn't be told the lobby was
	// closed when they closed it themselves.
	selfLeaving: boolean;
	// Counts sessionCreated messages, i.e. every (re)connect of this session.
	sessionEpoch: number;

	setLobby: (lobby: LobbyStatePayload) => void;
	setSession: (sessionId: string, playerId: string) => void;
	setHostGrace: (seconds: number | null) => void;
	setSelfLeaving: (v: boolean) => void;
	// Tear down the local session and return to the start screen (e.g. after
	// being kicked or when the host closes the lobby). The reason is surfaced to
	// the user via a toast at the call site.
	reset: () => void;
}

// Whether the current player is the host of the active lobby. Centralises the
// `players.find(p => p.id === myPlayerId)?.isHost` lookup used across screens.
export function useIsHost(): boolean {
	return useLobbyStore(
		(s) => s.lobby?.players.find((p) => p.id === s.myPlayerId)?.isHost ?? false,
	);
}

// applyLobbyPatch merges a lobbyPatch into the current lobby, sorted like the
// server sorts. Null when there is no lobby of that code to patch.
export function applyLobbyPatch(
	lobby: LobbyStatePayload | null,
	{ removed, ...patch }: LobbyPatchPayload,
): LobbyStatePayload | null {
	if (lobby?.lobbyCode !== patch.lobbyCode) return null;
	const byId = new Map(lobby.players.map((p) => [p.id, p]));
	for (const p of patch.players) byId.set(p.id, p);
	for (const id of removed) byId.delete(id);
	const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
	const players = [...byId.values()].sort(
		(a, b) =>
			cmp(a.name.toLowerCase(), b.name.toLowerCase()) || cmp(a.id, b.id),
	);
	return { ...patch, players };
}

export const useLobbyStore = create<LobbyStore>((set) => ({
	lobby: null,
	myPlayerId: null,
	mySessionId: null,
	hostGrace: null,
	selfLeaving: false,
	sessionEpoch: 0,

	// A fresh lobbyState means we're (back) in a lobby -> clear any stale
	// self-leaving flag left over from a previous departure.
	setLobby: (lobby) => set({ lobby, selfLeaving: false }),
	setSession: (sessionId, playerId) => {
		setSessionId(sessionId);
		set((s) => ({
			mySessionId: sessionId,
			myPlayerId: playerId,
			sessionEpoch: s.sessionEpoch + 1,
		}));
	},
	setHostGrace: (seconds) => set({ hostGrace: seconds }),
	setSelfLeaving: (v) => set({ selfLeaving: v }),
	reset: () => {
		clearSessionId();
		set({ lobby: null, myPlayerId: null, mySessionId: null, hostGrace: null });
	},
}));
