import { useToastStore } from "@/store/toast";
import type { ClientEvent, ServerEvent } from "@/types/events";
import { getSessionId } from "./session";
import { parseServerEvent } from "./serverEvents";

const queued = new Set<ClientEvent["type"]>([
	"createLobby",
	"joinLobby",
	"checkLobby",
]);
const silent = new Set<ClientEvent["type"]>(["answerUpdate", "leaveLobby"]);

type EventHandler<T extends ServerEvent["type"]> = (
	payload: Extract<ServerEvent, { type: T }>["payload"],
	version: number,
) => void;

type HandlerMap = {
	[T in ServerEvent["type"]]?: EventHandler<T>;
};

type StatusListener = (connected: boolean) => void;

class WSClient {
	private ws: WebSocket | null = null;
	private connecting: Promise<void> | null = null;
	private handlers: HandlerMap = {};
	private statusListeners = new Set<StatusListener>();
	private outbox: ClientEvent[] = [];
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private opened = false;
	// Closed by the server because another tab took over this session: stay
	// offline until this tab is focused again.
	replaced = false;
	private url: string;
	// Starts true so a cold load does not flash the offline banner before the first open.
	private lastStatus = true;

	constructor(url: string) {
		this.url = url;
		// Back online or refocused: reconnect now instead of waiting out a pending backoff (up to 30 s).
		if (typeof window !== "undefined") {
			window.addEventListener("online", this.ensureConnected);
			window.addEventListener("focus", this.ensureConnected);
			if (typeof document !== "undefined") {
				document.addEventListener("visibilitychange", this.ensureConnected);
			}
		}
	}

	private ensureConnected = () => {
		if (
			typeof document !== "undefined" &&
			document.visibilityState === "hidden"
		) {
			return; // a tab going hidden is not a reason to reconnect
		}
		if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
		if (this.connecting) return;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.reconnectAttempts = 0;
		this.replaced = false;
		void this.connect();
	};

	// Idempotent, so StrictMode's double effect reuses the socket.
	connect(): Promise<void> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return Promise.resolve();
		}
		if (this.connecting) {
			return this.connecting;
		}

		this.connecting = new Promise((resolve, reject) => {
			const socket = new WebSocket(this.url);
			// A handshake that hangs counts as a failure, so the status turns offline.
			const handshake = setTimeout(() => socket.close(), 5000);
			this.ws = socket;
			// Heartbeat: a half-open socket stays OPEN here while nothing arrives,
			// so a ping without any reply in 3 s counts as a lost connection.
			let beat: ReturnType<typeof setInterval> | undefined;
			let pong: ReturnType<typeof setTimeout> | undefined;
			const lost = () => {
				clearInterval(beat);
				clearTimeout(pong);
				if (this.ws === socket) {
					this.ws = null;
				}
				this.connecting = null;
				this.notifyStatus(false);
				if (!this.replaced) this.scheduleReconnect();
			};

			socket.onopen = () => {
				clearTimeout(handshake);
				this.connecting = null;
				if (this.opened) void reloadIfUpdated();
				this.opened = true;
				this.reconnectAttempts = 0; // reset backoff after a successful connect
				this.notifyStatus(true);
				// Bind the session before replaying the outbox: the server rejects
				// actions on a socket that is not bound yet.
				if (getSessionId()) {
					this.outbox.unshift({ type: "reconnect", payload: {} });
				}
				this.flush();
				beat = setInterval(() => {
					socket.send(JSON.stringify({ type: "ping", payload: {} }));
					pong ??= setTimeout(() => {
						socket.onclose = null;
						socket.onmessage = null;
						socket.close();
						lost();
					}, 10_000);
				}, 10_000);
				resolve();
			};

			socket.onerror = () => {
				this.connecting = null;
				// onclose fires right after and drives the retry loop.
				reject(new Error("WebSocket-Verbindung fehlgeschlagen"));
			};

			socket.onmessage = (event) => {
				clearTimeout(pong);
				pong = undefined;
				const msg = parseServerEvent(event.data as string);
				if (!msg) return;
				const handler = this.handlers[msg.type];
				if (handler) {
					// @ts-expect-error dynamic dispatch
					handler(msg.payload, msg.stateVersion);
				}
			};

			socket.onclose = (event) => {
				this.replaced = event.code === 4000;
				lost();
			};
		});

		return this.connecting.catch(() => undefined);
	}

	on<T extends ServerEvent["type"]>(type: T, handler: EventHandler<T>) {
		this.handlers[type] = handler as HandlerMap[T];
	}

	off(type: ServerEvent["type"]) {
		delete this.handlers[type];
	}

	onStatusChange(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	// Deliver the message, connecting first if needed. Only the Home actions
	// that create a session wait in the outbox; an action in a room is dropped
	// while offline (with a toast) so it can't fire later in another phase.
	// Answers need no toast (the reconnect resends them), nor does leaving.
	send(event: ClientEvent) {
		const open = this.ws?.readyState === WebSocket.OPEN;
		if (open || queued.has(event.type)) {
			if (!open) this.drop(event.type);
			this.outbox.push(event);
		} else if (!silent.has(event.type)) {
			useToastStore.getState().addToast("Offline - Aktion nicht gesendet.");
		}
		if (open) {
			this.flush();
		} else if (!this.replaced) {
			void this.connect();
		}
	}

	drop(type: ClientEvent["type"]) {
		this.outbox = this.outbox.filter((e) => e.type !== type);
	}

	private flush() {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		const sessionId = getSessionId() ?? "";
		const pending = this.outbox;
		this.outbox = [];
		for (const event of pending) {
			this.ws.send(JSON.stringify({ ...event, sessionId }));
		}
	}

	private notifyStatus(connected: boolean) {
		this.lastStatus = connected;
		for (const l of this.statusListeners) l(connected);
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) return;
		const cap = 30_000;
		const base = Math.min(cap, 1000 * 2 ** this.reconnectAttempts);
		const delay = base / 2 + Math.random() * (base / 2);
		this.reconnectAttempts++;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.connect();
		}, delay);
	}

	get isOpen() {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	get status() {
		return this.isOpen || this.lastStatus;
	}
}

// In dev Vite serves the page and the backend listens on :8080.
const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = import.meta.env.DEV
	? `${wsProto}//${window.location.hostname}:8080/ws`
	: `${wsProto}//${window.location.host}/ws`;

export const ws = new WSClient(wsUrl);

// A reconnect may follow a deploy: load the new build if index.html changed.
async function reloadIfUpdated() {
	const src = document
		.querySelector("script[type=module][src]")
		?.getAttribute("src");
	const html = await fetch("/", { cache: "no-store" })
		.then((r) => r.text())
		.catch(() => "");
	if (src && html && !html.includes(src)) location.reload();
}
