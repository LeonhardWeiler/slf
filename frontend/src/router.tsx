import { useEffect, useRef, lazy, Suspense } from "react";
import { joinCode, Navigate, navigate, usePath } from "@/lib/nav";
import { ws } from "@/lib/ws";
import type { LobbyStatePayload } from "@/types/events";
import { getSessionId } from "@/lib/session";
import { markForcedLeave } from "@/lib/forcedLeave";
import { applyLobbyPatch, useLobbyStore } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { useToastStore } from "@/store/toast";
import { Home } from "@/pages/Home";
import { Toaster } from "@/components/Toaster";

// The lobby/game view (Room + all in-game screens) is only needed once the
// player is actually in a lobby. Splitting it out of the initial bundle keeps
// the Home/start screen payload small (no unused in-game JS on first load).
const loadRoom = () => import("@/pages/Room");
if (getSessionId()) void loadRoom();
const Room = lazy(() => loadRoom().then((m) => ({ default: m.Room })));

export function Router() {
	// Individual selectors instead of destructuring the whole store: otherwise
	// the root layout (and with it the entire routed tree) re-renders on every
	// unrelated lobby-store change - e.g. the per-second hostGrace countdown.
	const setLobby = useLobbyStore((s) => s.setLobby);
	const setSession = useLobbyStore((s) => s.setSession);
	const setHostGrace = useLobbyStore((s) => s.setHostGrace);
	const reset = useLobbyStore((s) => s.reset);
	const pendingReconnect = useRef(getSessionId() !== null);

	// Toast on connection transitions. The very first successful connect stays
	// silent, and a "disconnected" status is only announced as a *loss* once a
	// connection was actually established before - so a cold start against an
	// unreachable server doesn't wrongly claim the connection was "lost" (it was
	// never there; the Home screen already shows a persistent "no connection"
	// banner for that). Only a real drop -> reconnect surfaces the toast pair, and
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
				addToast(
					ws.replaced
						? "In einem anderen Tab geöffnet."
						: "Verbindung zum Server verloren…",
				);
			}
		});
	}, []);

	useEffect(() => {
		ws.onStatusChange((connected) => {
			if (connected && getSessionId()) pendingReconnect.current = true;
		});

		ws.on("sessionCreated", (payload) => {
			setSession(payload.sessionId, payload.playerId);
		});

		const onLobby = (payload: LobbyStatePayload) => {
			pendingReconnect.current = false;
			setLobby(payload);
			// Snapshot also carries the host-grace countdown, so a client that joins or
			// reconnects mid-grace sees the shared banner too (not just via the event).
			setHostGrace(payload.hostGraceSeconds ?? null);
		};
		ws.on("lobbyState", onLobby);
		ws.on("lobbyPatch", (payload) => {
			const lobby = applyLobbyPatch(useLobbyStore.getState().lobby, payload);
			if (lobby) onLobby(lobby);
		});

		ws.on("error", (payload) => {
			// A failed reconnect whose cause is a stale session/lobby means the stored
			// session no longer exists -> clear it so the user starts fresh. Unrelated
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
				markForcedLeave();
				reset();
				// The lobby lives at /join/:code; back to the start screen since the
				// stored session is gone (otherwise we'd land on that code's join flow).
				navigate("/");
				useToastStore
					.getState()
					.addToast("Verbindung zum Spiel verloren - bitte neu beitreten.");
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
				markForcedLeave();
				reset();
				// Leave the lobby's /join/:code URL for the start screen.
				navigate("/");
				useToastStore.getState().addToast("Du wurdest aus der Lobby entfernt.");
			}
		});

		ws.on("lobbyClosed", (payload) => {
			useGameStore.getState().resetGame();
			// The host receives this echo too when they close the lobby by leaving -
			// but shouldn't be told it was closed when they did it themselves.
			const { selfLeaving, setSelfLeaving } = useLobbyStore.getState();
			reset();
			// The host who left already navigated away themselves; everyone else is
			// pulled off the lobby's /join/:code URL back to the start screen.
			if (selfLeaving) {
				setSelfLeaving(false);
				return;
			}
			markForcedLeave();
			navigate("/");
			useToastStore
				.getState()
				.addToast(
					payload.reason === "hostDisconnected"
						? "Der Host hat die Verbindung verloren - die Lobby wurde geschlossen."
						: "Die Lobby wurde vom Host geschlossen.",
				);
		});

		// Shared host-grace countdown (host dropped -> 15s to reconnect, else close).
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
		ws.on("commentatorUpdate", (payload) => {
			useGameStore.getState().updateCommentator(payload);
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
			<Toaster />
			{/* Single <main> landmark around the routed content (the fixed overlay
          above stay outside it) so assistive tech can jump to the main content. */}
			<main>
				<Routes />
			</main>
		</>
	);
}

// `/` renders the Home join/create flow. The active lobby *lives* at
// `/join/:code` so the address bar always equals the shareable join link. The
// same path serves the join flow (Home reads the code as a deep link) for
// anyone not yet in a lobby. Any other path bounces back to `/`.
function Routes() {
	const path = usePath();
	const inLobby = useLobbyStore((s) => s.lobby != null);
	if (path === "/") return <Home key="index" />;
	if (joinCode(path) === null) return <Navigate to="/" />;
	if (!inLobby) return <Home key="join" />;
	return (
		<Suspense fallback={null}>
			<Room />
		</Suspense>
	);
}
