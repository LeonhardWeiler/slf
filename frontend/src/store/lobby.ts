import { create } from "zustand";
import type { LobbyStatePayload } from "@/types/events";
import { setSessionId, clearSessionId } from "@/lib/session";

interface LobbyStore {
  lobby: LobbyStatePayload | null;
  myPlayerId: string | null;
  mySessionId: string | null;
  // Seconds left until the lobby closes because the host is disconnected; null
  // when the host is present (SRS 4.6/8.5). Shown as a shared countdown banner.
  hostGrace: number | null;

  setLobby: (lobby: LobbyStatePayload) => void;
  setSession: (sessionId: string, playerId: string) => void;
  setHostGrace: (seconds: number | null) => void;
  // Tear down the local session and return to the start screen (e.g. after
  // being kicked or when the host closes the lobby). The reason is surfaced to
  // the user via a toast at the call site.
  reset: () => void;
}

// Whether the current player is the host of the active lobby. Centralises the
// `players.find(p => p.id === myPlayerId)?.isHost` lookup used across screens.
export function useIsHost(): boolean {
  return useLobbyStore(
    (s) => s.lobby?.players.find((p) => p.id === s.myPlayerId)?.isHost ?? false
  );
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  lobby: null,
  myPlayerId: null,
  mySessionId: null,
  hostGrace: null,

  setLobby: (lobby) => set({ lobby }),
  setSession: (sessionId, playerId) => {
    setSessionId(sessionId);
    set({ mySessionId: sessionId, myPlayerId: playerId });
  },
  setHostGrace: (seconds) => set({ hostGrace: seconds }),
  reset: () => {
    clearSessionId();
    set({ lobby: null, myPlayerId: null, mySessionId: null, hostGrace: null });
  },
}));
