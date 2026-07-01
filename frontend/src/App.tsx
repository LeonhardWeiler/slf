import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { ws } from "@/lib/ws";
import { getSessionId } from "@/lib/session";
import { useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { Home } from "@/pages/Home";
import { Room } from "@/pages/Room";
import { HostGraceBanner } from "@/components/HostGraceBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/Toaster";
import { useToastStore } from "@/store/toast";

function AppRoutes() {
  const { setLobby, setSession, setHostGrace, reset, lobby } = useLobbyStore();
  const pendingReconnect = useRef(false);

  // Toast on connection transitions. Starts "connected" so the initial connect
  // is a no-op; only a real drop → reconnect surfaces a pair of toasts (and it
  // ignores flapping by reacting only to actual state changes).
  useEffect(() => {
    let prevConnected = true;
    return ws.onStatusChange((connected) => {
      if (connected === prevConnected) return;
      prevConnected = connected;
      const addToast = useToastStore.getState().addToast;
      if (connected) addToast("Verbindung wiederhergestellt.", "info");
      else addToast("Verbindung zum Server verloren…");
    });
  }, []);

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
      // Snapshot also carries the host-grace countdown, so a client that joins or
      // reconnects mid-grace sees the shared banner too (not just via the event).
      setHostGrace(payload.hostGraceSeconds ?? null);
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
        // The stored session no longer exists on the server (e.g. it was
        // restarted and all in-RAM state is gone). Clear the session and
        // explain it instead of silently bouncing back to the start screen.
        pendingReconnect.current = false;
        reset();
        useToastStore
          .getState()
          .addToast("Verbindung zum Spiel verloren – bitte neu beitreten.");
        return;
      }
      useToastStore.getState().addToast(payload.message);
    });

    ws.on("playerKicked", (payload) => {
      // Only react if *we* were the one kicked (the host also receives a
      // fresh lobbyState without the kicked player).
      if (payload.playerId === useLobbyStore.getState().myPlayerId) {
        useGameStore.getState().resetGame();
        reset();
        useToastStore.getState().addToast("Du wurdest aus der Lobby entfernt.");
      }
    });

    ws.on("lobbyClosed", (payload) => {
      useGameStore.getState().resetGame();
      reset();
      useToastStore
        .getState()
        .addToast(
          payload.reason === "hostDisconnected"
            ? "Der Host hat die Verbindung verloren – die Lobby wurde geschlossen."
            : "Die Lobby wurde vom Host geschlossen."
        );
    });

    // Shared host-grace countdown (host dropped → 15s to reconnect, else close).
    ws.on("hostDisconnected", (payload) => {
      setHostGrace(payload.graceSeconds);
    });
    ws.on("hostReconnected", () => {
      setHostGrace(null);
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
  }, [setLobby, setSession, setHostGrace, reset]);

  return (
    <>
      <HostGraceBanner />
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Home />} />
        <Route
          path="/lobby"
          element={lobby ? <Room /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
