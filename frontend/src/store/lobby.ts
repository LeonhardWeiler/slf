import { create } from "zustand";
import type { LobbyStatePayload } from "@/types/events";
import { setSessionId, clearSessionId } from "@/lib/session";

interface LobbyStore {
  lobby: LobbyStatePayload | null;
  myPlayerId: string | null;
  mySessionId: string | null;
  error: string | null;
  notice: string | null;

  setLobby: (lobby: LobbyStatePayload) => void;
  setSession: (sessionId: string, playerId: string) => void;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  reset: () => void;
  // Tear down the local session and return to the start screen with a message
  // (e.g. after being kicked or when the host closes the lobby).
  closeWithNotice: (notice: string) => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  lobby: null,
  myPlayerId: null,
  mySessionId: null,
  error: null,
  notice: null,

  setLobby: (lobby) => set({ lobby, error: null }),
  setSession: (sessionId, playerId) => {
    setSessionId(sessionId);
    set({ mySessionId: sessionId, myPlayerId: playerId });
  },
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  reset: () => {
    clearSessionId();
    set({ lobby: null, myPlayerId: null, mySessionId: null, error: null });
  },
  closeWithNotice: (notice) => {
    clearSessionId();
    set({
      lobby: null,
      myPlayerId: null,
      mySessionId: null,
      error: null,
      notice,
    });
  },
}));
