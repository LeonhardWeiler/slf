import { expect, it } from "bun:test";

const sent: string[] = [];
const sockets: FakeSocket[] = [];
class FakeSocket {
	static OPEN = 1;
	readyState = 0;
	onopen = () => {};
	onclose = () => {};
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

it("binds the session before replaying the outbox", () => {
	localStorage.setItem("sessionId", "s1");
	ws.send({ type: "startGame", payload: {} });
	const socket = sockets[0];
	socket.readyState = FakeSocket.OPEN;
	socket.onopen();
	expect(sent.map((d) => JSON.parse(d).type)).toEqual([
		"reconnect",
		"startGame",
	]);
});
