import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useRoomStore } from "@/store/room";

export function HostGraceBanner() {
	const hostGrace = useRoomStore((s) => s.hostGrace);
	const [remaining, setRemaining] = useState<number | null>(null);
	const deadlineRef = useRef<number | null>(null);

	// Ignore sub-second re-syncs so the visible number never jumps back a second.
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

	useEffect(() => {
		const id = setInterval(() => {
			if (deadlineRef.current == null) return;
			setRemaining(
				Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)),
			);
		}, 250);
		return () => clearInterval(id);
	}, []);

	if (remaining == null) return null;
	return (
		<div className="flex justify-center">
			<span className="sr-only" role="alert">
				Host getrennt - die Lobby wird in Kürze geschlossen.
			</span>
			<div
				aria-hidden="true"
				className="flex items-center gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-5 py-2.5 text-base font-medium text-amber-800 dark:text-amber-300"
			>
				<AlertTriangle className="h-5 w-5 shrink-0" />
				<span>
					Host getrennt - Lobby schließt in{" "}
					<span className="tabular-nums font-bold">{remaining}s</span>
				</span>
			</div>
		</div>
	);
}
