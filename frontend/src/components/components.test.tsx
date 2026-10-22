import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { isModalOpen, Modal } from "@/components/Modal";
import { PlayerStatus } from "@/components/PlayerStatus";
import type { Player } from "@/types/events";

describe("Modal", () => {
	it("traps focus, closes on Escape and returns focus", () => {
		const onClose = mock(() => {});
		const { rerender } = render(<button type="button">trigger</button>);
		screen.getByText("trigger").focus();
		rerender(
			<>
				<button type="button">trigger</button>
				<Modal role="dialog" labelledBy="t" onClose={onClose}>
					<h2 id="t">Titel</h2>
					<button type="button">a</button>
					<button type="button">b</button>
				</Modal>
			</>,
		);
		expect(screen.getByRole("dialog")).toBeDefined();
		expect(document.activeElement?.textContent).toBe("a");
		expect(isModalOpen()).toBe(true);

		screen.getByText("b").focus();
		fireEvent.keyDown(window, { key: "Tab" });
		expect(document.activeElement?.textContent).toBe("a");

		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);

		rerender(<button type="button">trigger</button>);
		expect(isModalOpen()).toBe(false);
		expect(document.activeElement?.textContent).toBe("trigger");
	});
});

describe("PlayerStatus", () => {
	const player = (p: Partial<Player>): Player => ({
		id: "p",
		name: "Ann",
		isHost: false,
		connected: true,
		left: false,
		pending: false,
		score: 0,
		...p,
	});

	it("marks a final leave", () => {
		render(<PlayerStatus player={player({ left: true, connected: false })} />);
		expect(screen.getByText("(verlassen)")).toBeDefined();
	});

	it("marks a dropped connection as reversible", () => {
		render(<PlayerStatus player={player({ connected: false })} />);
		expect(
			screen.getByRole("img", { name: "Verbindung getrennt" }),
		).toBeDefined();
		expect(screen.queryByText("(verlassen)")).toBeNull();
	});

	it("shows nothing for a connected player", () => {
		const { container } = render(<PlayerStatus player={player({})} />);
		expect(container.innerHTML).toBe("");
	});
});
