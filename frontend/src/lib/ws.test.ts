import { expect, it } from "bun:test";

const sent: string[] = [];
const sockets: FakeSocket[] = [];
class FakeSocket {
	static OPEN = 1;
	readyState = 0;
	onopen = () => {};
	onclose = (_event: { code: number }) => {};
	onerror = () => {};
	onmessage = () => {};
	constructor() {
		sockets.push(this);
	}
	send(data: string) {
		sent.push(data);
	}
	close() {}
}
globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
const { ws } = await import("./ws");
const { useToastStore } = await import("@/store/toast");

it("binds the session before replaying the outbox", () => {
	localStorage.setItem("sessionId", "s1");
	ws.send({ type: "checkLobby", payload: { lobbyCode: "abc123" } });
	const socket = sockets[0];
	socket.readyState = FakeSocket.OPEN;
	socket.onopen();
	expect(sent.map((d) => JSON.parse(d).type)).toEqual([
		"reconnect",
		"checkLobby",
	]);
});

it("pauses after another tab took over and resumes on focus", () => {
	const socket = sockets[0];
	socket.readyState = 3;
	socket.onclose({ code: 4000 });
	ws.send({ type: "startGame", payload: {} });
	expect(sockets).toHaveLength(1);
	window.dispatchEvent(new Event("focus"));
	expect(sockets).toHaveLength(2);
});

it("drops a room action while offline instead of replaying it later", () => {
	const socket = sockets[1];
	ws.send({ type: "startNextRound", payload: {} });
	expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
		"Offline – Aktion nicht gesendet.",
	);
	sent.length = 0;
	socket.readyState = FakeSocket.OPEN;
	socket.onopen();
	expect(sent.map((d) => JSON.parse(d).type)).toEqual(["reconnect"]);
});
