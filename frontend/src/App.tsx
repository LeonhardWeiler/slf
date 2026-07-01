import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { ws } from "@/lib/ws";
import { getSessionId } from "@/lib/session";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { Home } from "@/pages/Home";
import { Room } from "@/pages/Room";

function AppRoutes() {
  const { setLobby, setSession, setError, reset, closeWithNotice, lobby } =
    useLobbyStore();
  const pendingReconnect = useRef(false);

  useEffect(() => {
    void ws.connect().then(() => {
      if (getSessionId()) {
        pendingReconnect.current = true;
        ws.send({ type: "reconnect", payload: {} });
      }
    });

    ws.on("sessionCreated", (payload) => {
      setSession(payload.sessionId, payload.playerId);
    });

    ws.on("lobbyState", (payload) => {
      pendingReconnect.current = false;
      setLobby(payload);
    });

    ws.on("error", (payload) => {
      // A failed reconnect whose cause is a stale session/lobby means the stored
      // session no longer exists → clear it so the user starts fresh. Unrelated
      // errors during a pending reconnect are shown normally.
      const staleSession =
        payload.code === "SESSION_NOT_FOUND" ||
        payload.code === "INVALID_SESSION" ||
        payload.code === "LOBBY_NOT_FOUND" ||
        payload.code === "PLAYER_NOT_FOUND";
      if (pendingReconnect.current && staleSession) {
        pendingReconnect.current = false;
        reset();
        return;
      }
      setError(payload.message);
    });

    ws.on("playerKicked", (payload) => {
      // Only react if *we* were the one kicked (the host also receives a
      // fresh lobbyState without the kicked player).
      if (payload.playerId === useLobbyStore.getState().myPlayerId) {
        useGameStore.getState().resetGame();
        closeWithNotice("Du wurdest aus der Lobby entfernt.");
      }
    });

    ws.on("lobbyClosed", () => {
      useGameStore.getState().resetGame();
      closeWithNotice("Die Lobby wurde vom Host geschlossen.");
    });

    ws.on("gameState", (payload) => {
      useGameStore.getState().setGame(payload);
    });
    ws.on("reviewState", (payload) => {
      useGameStore.getState().setReview(payload);
    });
    ws.on("commentatorState", (payload) => {
      useGameStore.getState().setCommentator(payload);
    });
    ws.on("roundResult", (payload) => {
      useGameStore.getState().setResult(payload);
    });
    ws.on("buzzRejected", (payload) => {
      useGameStore.getState().setBuzzRejected(payload.reason);
    });
  }, [setLobby, setSession, setError, reset, closeWithNotice]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join/:code" element={<Home />} />
      <Route
        path="/lobby"
        element={lobby ? <Room /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
