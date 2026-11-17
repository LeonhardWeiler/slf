import { useEffect, useRef, lazy, Suspense } from "react";
import { joinCode, Navigate, navigate, usePath } from "@/lib/nav";
import { ws } from "@/lib/ws";
import { getSessionId } from "@/lib/session";
import { markForcedLeave } from "@/lib/forcedLeave";
import { useRoomStore } from "@/store/room";
import { useToastStore } from "@/store/toast";
import { Home } from "@/pages/Home";
import { Toaster } from "@/components/Toaster";

const loadRoom = () => import("@/pages/Room");
if (getSessionId()) void loadRoom();
const Room = lazy(() => loadRoom().then((m) => ({ default: m.Room })));

export function Router() {
	// Individual selectors so the root does not re-render on every store change (e.g. the hostGrace countdown).
	const setSession = useRoomStore((s) => s.setSession);
	const setHostGrace = useRoomStore((s) => s.setHostGrace);
	const reset = useRoomStore((s) => s.reset);
	const pendingReconnect = useRef(getSessionId() !== null);

	// A disconnect is announced as a loss only after a connection existed; the first connect stays silent.
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
		const offStatus = ws.onStatusChange((connected) => {
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
			const staleSession =
				payload.code === "SESSION_NOT_FOUND" ||
				payload.code === "INVALID_SESSION" ||
				payload.code === "LOBBY_NOT_FOUND" ||
				payload.code === "PLAYER_NOT_FOUND";
			if (pendingReconnect.current && staleSession) {
				pendingReconnect.current = false;
				markForcedLeave();
				reset();
				navigate("/");
				useToastStore
					.getState()
					.addToast("Verbindung zum Spiel verloren - bitte neu beitreten.");
				return;
			}
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
				navigate("/");
				useToastStore.getState().addToast("Du wurdest aus der Lobby entfernt.");
			}
		});

		ws.on("lobbyClosed", (payload) => {
			const { selfLeaving, setSelfLeaving } = useRoomStore.getState();
			reset();
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

		ws.on("hostDisconnected", (payload) => {
			setHostGrace(payload.graceSeconds);
		});
		ws.on("hostReconnected", () => {
			setHostGrace(null);
		});

		ws.on("buzzRejected", (payload) => {
			useRoomStore.getState().setBuzzRejected(payload.reason);
		});

		return offStatus;
	}, [setSession, setHostGrace, reset]);

	return (
		<>
			<Toaster />
			<main>
				<Routes />
			</main>
		</>
	);
}

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
