import { DoorOpen, WifiOff } from "lucide-react";
import type { Player } from "@/types/events";

// PlayerStatus marks a standings row: a door for a final leave or kick, a
// cut wifi for a connection drop that may still heal.
export function PlayerStatus({ player }: { player?: Player }) {
	if (player?.left)
		return (
			<span
				className="status"
				role="img"
				aria-label="verlassen"
				data-tip="Verlassen"
			>
				<DoorOpen />
			</span>
		);
	if (player && !player.connected)
		return (
			<span
				className="status"
				role="img"
				aria-label="Verbindung getrennt"
				data-tip="Verbindung getrennt"
			>
				<WifiOff />
			</span>
		);
	return null;
}
