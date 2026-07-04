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
  // Individual selectors instead of destructuring the whole store: otherwise
  // App (and with it the entire routed tree) re-renders on every unrelated
  // lobby-store change — e.g. the per-second hostGrace countdown.
  const setLobby = useLobbyStore((s) => s.setLobby);
  const setSession = useLobbyStore((s) => s.setSession);
  const setHostGrace = useLobbyStore((s) => s.setHostGrace);
  const reset = useLobbyStore((s) => s.reset);
  const lobby = useLobbyStore((s) => s.lobby);
  const pendingReconnect = useRef(false);

  // Toast on connection transitions. The very first successful connect stays
  // silent, and a "disconnected" status is only announced as a *loss* once a
  // connection was actually established before — so a cold start against an
  // unreachable server doesn't wrongly claim the connection was "lost" (it was
  // never there; the Home screen already shows a persistent "no connection"
  // banner for that). Only a real drop → reconnect surfaces the toast pair, and
  // flapping is ignored by reacting only to actual state changes.
  useEffect(() => {
    // Seed from the current socket so a connect that raced ahead of this
    // listener isn't mistaken for a fresh transition.
    let everConnected = ws.isOpen;
    let prevConnected = ws.isOpen;
    return ws.onStatusChange((connected) => {
      if (connected === prevConnected) return;
      const wasEverConnected = everConnected;
      prevConnected = connected;
      if (connected) everConnected = true;
      const addToast = useToastStore.getState().addToast;
      if (connected) {
        if (wasEverConnected) addToast("Verbindung wiederhergestellt.", "info");
      } else if (wasEverConnected) {
        addToast("Verbindung zum Server verloren…");
      }
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
      // If a form registered an inline error sink (e.g. the join-name step),
      // route the error there instead of showing a transient toast.
      const sink = useToastStore.getState().errorSink;
      if (sink) {
        sink(payload.message);
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
      // The host receives this echo too when they close the lobby by leaving —
      // but shouldn't be told it was closed when they did it themselves.
      const { selfLeaving, setSelfLeaving } = useLobbyStore.getState();
      reset();
      if (selfLeaving) {
        setSelfLeaving(false);
        return;
      }
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
      {/* Single <main> landmark around the routed content (the fixed overlays
          above stay outside it) so assistive tech can jump to the main content. */}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join/:code" element={<Home />} />
          <Route
            path="/lobby"
            element={lobby ? <Room /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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
