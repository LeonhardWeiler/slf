import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { sound } from "@/lib/sound";
import { useRoomStore } from "@/store/room";

// Shared, prominent countdown shown to everyone while the host is disconnected.
// The lobby closes when it reaches zero unless the host reconnects (SRS 4.6/8.5).
export function HostGraceBanner() {
	const hostGrace = useRoomStore((s) => s.hostGrace);
	const [remaining, setRemaining] = useState<number | null>(null);
	// Absolute local deadline we tick down to. Kept in a ref so an interim
	// lobbyState broadcast that re-sends hostGrace can't reset our smooth
	// countdown on every arrival.
	const deadlineRef = useRef<number | null>(null);

	// Adopt the server's remaining time on first sight or when it diverges by
	// more than a second from what we're already showing; ignore sub-second
	// re-syncs so the visible number never jumps back a second (former UX-2).
	useEffect(() => {
		if (hostGrace == null) {
			deadlineRef.current = null;
			setRemaining(null);
			return;
		}
		const candidate = Date.now() + hostGrace * 1000;
		if (
			deadlineRef.current == null ||
			Math.abs(candidate - deadlineRef.current) > 1000
		) {
			deadlineRef.current = candidate;
		}
		setRemaining(
			Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)),
		);
	}, [hostGrace]);

	// Single, stable ticker independent of hostGrace changes.
	useEffect(() => {
		const id = setInterval(() => {
			if (deadlineRef.current == null) return;
			setRemaining(
				Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)),
			);
		}, 250);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		if (remaining != null && remaining <= 5) sound.tick(5 - remaining);
	}, [remaining]);

	if (remaining == null) return null;
	return (
		<div
			className="grace"
			style={{ "--k": 1 - remaining / 15 } as React.CSSProperties}
		>
			<span className="sr-only" role="alert">
				Host getrennt - die Lobby wird in Kürze geschlossen.
			</span>
			<div className="grace-card" aria-hidden="true">
				<WifiOff />
				<svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
					<circle cx="50" cy="50" r="44" />
				</svg>
				<b>{remaining}</b>
			</div>
		</div>
	);
}
