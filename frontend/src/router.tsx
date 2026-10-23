import { useEffect, useRef, lazy, Suspense } from "react";
import { joinCode, Navigate, navigate, usePath } from "@/lib/nav";
import { ws } from "@/lib/ws";
import { getSessionId } from "@/lib/session";
import { markForcedLeave } from "@/lib/forcedLeave";
import { useRoomStore } from "@/store/room";
import { useToastStore } from "@/store/toast";
import { Home } from "@/pages/Home";
import { Toaster } from "@/components/Toaster";
import { Shell } from "@/components/Shell";

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
	const setSession = useRoomStore((s) => s.setSession);
	const setHostGrace = useRoomStore((s) => s.setHostGrace);
	const reset = useRoomStore((s) => s.reset);
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

		const roomEvents = [
			"lobbyState",
			"lobbyPatch",
			"gameState",
			"reviewState",
			"roundResult",
			"commentatorState",
			"commentatorUpdate",
		] as const;
		for (const type of roomEvents) {
			ws.on(type, (payload, version) => {
				if (type === "lobbyState" || type === "lobbyPatch")
					pendingReconnect.current = false;
				useRoomStore.getState().receive(type, payload, version);
			});
		}

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
			if (payload.playerId === useRoomStore.getState().myPlayerId) {
				markForcedLeave();
				reset();
				// Leave the lobby's /join/:code URL for the start screen.
				navigate("/");
				useToastStore.getState().addToast("Du wurdest aus der Lobby entfernt.");
			}
		});

		ws.on("lobbyClosed", (payload) => {
			// The host receives this echo too when they close the lobby by leaving -
			// but shouldn't be told it was closed when they did it themselves.
			const { selfLeaving, setSelfLeaving } = useRoomStore.getState();
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

		ws.on("buzzRejected", (payload) => {
			useRoomStore.getState().setBuzzRejected(payload.reason);
		});
	}, [setSession, setHostGrace, reset]);

	return (
		<Shell>
			<Routes />
			<Toaster />
		</Shell>
	);
}

// `/` renders the Home join/create flow. The active lobby *lives* at
// `/join/:code` so the address bar always equals the shareable join link. The
// same path serves the join flow (Home reads the code as a deep link) for
// anyone not yet in a lobby. Any other path bounces back to `/`.
function Routes() {
	const path = usePath();
	const inLobby = useRoomStore((s) => s.lobby != null);
	if (path === "/") return <Home key="index" />;
	if (joinCode(path) === null) return <Navigate to="/" />;
	if (!inLobby) return <Home key="join" />;
	return (
		<Suspense fallback={null}>
			<Room />
		</Suspense>
	);
}
