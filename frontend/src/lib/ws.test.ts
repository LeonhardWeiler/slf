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
it("binds the session, pauses for another tab and drops room actions offline", () => {
	localStorage.setItem("sessionId", "s1");
	ws.send({ type: "checkLobby", payload: { lobbyCode: "abc123" } });
	const first = sockets[0];
	first.readyState = FakeSocket.OPEN;
	first.onopen();
	expect(sent.map((d) => JSON.parse(d).type)).toEqual([
		"reconnect",
		"checkLobby",
	]);

	first.readyState = 3;
	first.onclose({ code: 4000 });
	ws.send({ type: "startGame", payload: {} });
	expect(sockets).toHaveLength(1);
	window.dispatchEvent(new Event("focus"));
	expect(sockets).toHaveLength(2);

	const second = sockets[1];
	ws.send({ type: "startNextRound", payload: {} });
	expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
		"Offline – Aktion nicht gesendet.",
	);
	sent.length = 0;
	second.readyState = FakeSocket.OPEN;
	second.onopen();
	expect(sent.map((d) => JSON.parse(d).type)).toEqual(["reconnect"]);
});

it("keeps only the newest queued Home action and drops it on request", () => {
	const open = sockets.at(-1) as FakeSocket;
	open.readyState = 3;
	open.onclose({ code: 1000 });
	ws.send({ type: "createLobby", payload: { playerName: "a" } });
	ws.send({ type: "createLobby", payload: { playerName: "b" } });
	ws.send({
		type: "joinLobby",
		payload: { playerName: "c", lobbyCode: "abc123" },
	});
	ws.drop("joinLobby");
	sent.length = 0;
	const next = sockets.at(-1) as FakeSocket;
	next.readyState = FakeSocket.OPEN;
	next.onopen();
	expect(sent.map((d) => JSON.parse(d))).toMatchObject([
		{ type: "reconnect" },
		{ type: "createLobby", payload: { playerName: "b" } },
	]);
});
