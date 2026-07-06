import type { ClientEvent, ServerEvent } from "@/types/events";
import { getSessionId } from "./session";
import { parseServerEvent } from "./serverEvents";

type EventHandler<T extends ServerEvent["type"]> = (
  payload: Extract<ServerEvent, { type: T }>["payload"]
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
  private url: string;
  // Optimistic connection status: starts `true` so the UI doesn't flash a
  // "disconnected" state during the ~200ms initial handshake (a cold load would
  // otherwise render the error banner before the very first onopen). It flips to
  // the real value on the first actual open/close signal.
  private lastStatus = true;

  constructor(url: string) {
    this.url = url;
    // When the browser signals it is back — network online again, or the tab was
    // refocused / made visible — try to reconnect immediately with a fresh
    // backoff, instead of waiting out a possibly long (up to 30s) pending retry.
    // That stale wait is why the app could still show "not connected" while the
    // server was already reachable again (a full-page reload that raced the
    // server coming up would just restart the same slow backoff).
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.ensureConnected);
      window.addEventListener("focus", this.ensureConnected);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", this.ensureConnected);
      }
    }
  }

  // Force an immediate reconnect attempt (resetting the backoff) when we are not
  // already connected or connecting. Bound as a field so it can be added/removed
  // as an event listener with a stable reference.
  private ensureConnected = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return; // a tab going hidden is not a reason to reconnect
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;
    // Drop a pending backoff timer and retry right away with a fresh budget.
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    void this.connect().then(() => {
      if (getSessionId()) this.send({ type: "reconnect", payload: {} });
    });
  };

  // Idempotent: repeated calls (e.g. React StrictMode's double-invoked effect)
  // reuse the same socket instead of opening a second orphaned connection.
  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.ws = socket;

      socket.onopen = () => {
        this.connecting = null;
        this.reconnectAttempts = 0; // reset backoff after a successful connect
        this.notifyStatus(true);
        this.flush();
        resolve();
      };

      socket.onerror = () => {
        this.connecting = null;
        // onclose fires right after and drives the retry loop.
        reject(new Error("WebSocket-Verbindung fehlgeschlagen"));
      };

      socket.onmessage = (event) => {
        // Validate with Zod before dispatching; malformed or unexpected-shape
        // messages are dropped (SRS 9.3 / 9.12).
        const msg = parseServerEvent(event.data as string);
        if (!msg) return;
        const handler = this.handlers[msg.type];
        if (handler) {
          // @ts-expect-error dynamic dispatch
          handler(msg.payload);
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.ws = null;
        }
        this.connecting = null;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };
    });

    // Swallow rejection so callers awaiting connect() don't throw unhandled;
    // the retry loop keeps trying in the background.
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

  // Queue the message and make sure it gets delivered. If the socket is not
  // open yet (initial load, or mid-reconnect), the message is buffered and
  // flushed as soon as the connection is established — instead of being
  // silently dropped.
  send(event: ClientEvent) {
    this.outbox.push(event);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.flush();
    } else {
      void this.connect();
    }
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
    // Exponential backoff (1s → cap 30s) with jitter so many clients don't all
    // retry in lock-step after a server restart (thundering herd). The delay is
    // 50–100% of the current step; reset to 1s once a connection succeeds.
    const cap = 30_000;
    const base = Math.min(cap, 1000 * 2 ** this.reconnectAttempts);
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().then(() => {
        if (getSessionId()) {
          this.send({ type: "reconnect", payload: {} });
        }
      });
    }, delay);
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Best-known connection status for the UI: the real socket state once it is
  // open, otherwise the optimistic/last-observed value. Used to seed component
  // state so the "disconnected" UI only appears after an actual failure.
  get status() {
    return this.isOpen || this.lastStatus;
  }
}

// In dev the frontend runs on Vite while the backend listens on :8080, so the
// WS target is explicit. In production the Go server serves both the static
// frontend and /ws on the same origin, so we reuse the page's host and derive
// wss:// automatically when served over https.
const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = import.meta.env.DEV
  ? `${wsProto}//${window.location.hostname}:8080/ws`
  : `${wsProto}//${window.location.host}/ws`;

export const ws = new WSClient(wsUrl);
