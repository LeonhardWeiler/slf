import type { Player } from "@/types/events";

// PlayerStatus marks a standings row: "(verlassen)" only for a final leave or
// kick, the lobby list's pulsing dot for a connection drop that may still heal.
export function PlayerStatus({ player }: { player?: Player }) {
	if (player?.left) {
		return <span className="text-xs text-muted-foreground"> (verlassen)</span>;
	}
	if (player && !player.connected) {
		return (
			<span
				role="img"
				aria-label="Verbindung getrennt"
				title="Verbindung getrennt"
				className="ml-2 inline-block h-2 w-2 rounded-full bg-muted-foreground align-middle animate-pulse"
			/>
		);
	}
	return null;
}
