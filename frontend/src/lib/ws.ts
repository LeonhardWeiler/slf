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
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

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
    for (const l of this.statusListeners) l(connected);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().then(() => {
        if (getSessionId()) {
          this.send({ type: "reconnect", payload: {} });
        }
      });
    }, 2000);
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

const wsUrl =
  window.location.hostname === "localhost"
    ? "ws://localhost:8080/ws"
    : `ws://${window.location.hostname}:8080/ws`;

export const ws = new WSClient(wsUrl);
