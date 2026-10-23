import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { ws } from "@/lib/ws";

// Small badge that appears only while the WebSocket is disconnected, so players
// get a clear signal if the connection drops mid-game (it auto-reconnects).
export function ConnectionBadge() {
	const [connected, setConnected] = useState(ws.status);
	useEffect(() => ws.onStatusChange(setConnected), []);

	// The status region stays mounted so the drop is announced when it appears.
	return (
		<span role="status" className="contents">
			{!connected && (
				<span className="offline" data-tip="Verbindung getrennt…">
					<WifiOff />
				</span>
			)}
		</span>
	);
}
