import { navigate } from "@/lib/nav";
import { ws } from "@/lib/ws";
import { markForcedLeave } from "@/lib/forcedLeave";
import { useIsHost, useRoomStore } from "@/store/room";
import { useConfirm } from "@/components/ConfirmDialog";

// useLeave asks to leave the room; leave resolves true once the player has left.
export function useLeave() {
	const inLobby = useRoomStore((s) => s.lobby?.state === "Lobby");
	const isHost = useIsHost();
	const { confirm, dialog } = useConfirm();

	async function leave() {
		const what = inLobby ? "Lobby" : "Spiel";
		const confirmed = await confirm(
			isHost
				? {
						title: "Lobby schließen?",
						description: inLobby
							? "Als Host beendest du die Lobby für alle Mitspieler."
							: "Als Host beendest du das laufende Spiel für alle.",
						confirmLabel: "Lobby schließen",
						destructive: true,
					}
				: {
						title: `${what} verlassen?`,
						description: `Du verlässt ${inLobby ? "die Lobby" : "das Spiel"} und kehrst zur Startseite zurück.`,
						confirmLabel: "Verlassen",
						destructive: true,
					},
		);
		if (!confirmed) return false;
		const { setSelfLeaving, reset } = useRoomStore.getState();
		setSelfLeaving(true);
		ws.send({ type: "leaveLobby", payload: {} });
		markForcedLeave();
		reset();
		navigate("/");
		return true;
	}

	return { leave, dialog };
}
