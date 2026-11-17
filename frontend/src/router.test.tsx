import { afterAll, expect, it, mock, spyOn } from "bun:test";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme";
import { ws } from "@/lib/ws";

const send = spyOn(ws, "send").mockImplementation(() => {});
afterAll(() => send.mockRestore());
mock.module("@/lib/nav", () => ({
	navigate: () => {},
	usePath: () => "/",
	joinCode: () => null,
	Navigate: () => null,
}));

const { Router } = await import("@/router");

it("unsubscribes its status listeners on unmount", () => {
	const listeners = (ws as unknown as { statusListeners: Set<unknown> })
		.statusListeners;
	const before = listeners.size;
	render(<Router />, { wrapper: ThemeProvider }).unmount();
	expect(listeners.size).toBe(before);
});
