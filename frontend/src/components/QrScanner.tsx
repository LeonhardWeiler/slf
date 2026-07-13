import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";

// Extracts a 6-char [a-z0-9] lobby code from a scanned value. Accepts a full join
// link (".../join/a3f9k2") or a bare code (case-insensitive).
function extractCode(data: string): string | null {
	try {
		const url = new URL(data);
		const m = url.pathname.match(/\/join\/([a-z0-9]{6})/i);
		if (m) return m[1].toLowerCase();
	} catch {
		/* not a URL - fall through */
	}
	const cleaned = data.toLowerCase().replace(/[^a-z0-9]/g, "");
	return cleaned.length === 6 ? cleaned : null;
}

export function QrScannerView({
	onScan,
	onClose,
}: {
	onScan: (code: string) => void;
	onClose: () => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const onScanRef = useRef(onScan);
	onScanRef.current = onScan;
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		// getUserMedia only works in a secure context (https or localhost); on a
		// plain-http LAN address the browser never even shows the permission prompt.
		if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
			setError(
				"Kamera nur über HTTPS verfügbar. Gib den Lobbycode stattdessen manuell ein.",
			);
			return;
		}

		const scanner = new QrScanner(
			video,
			(result) => {
				const code = extractCode(result.data);
				if (code) {
					scanner.stop();
					onScanRef.current(code);
				}
			},
			{
				preferredCamera: "environment",
				highlightScanRegion: true,
				highlightCodeOutline: true,
			},
		);

		// start() internally calls getUserMedia, which triggers the iOS/Android
		// permission prompt. Surface a helpful message per failure cause.
		scanner.start().catch((err: unknown) => {
			const name = err instanceof Error ? err.name : "";
			if (name === "NotAllowedError" || name === "SecurityError") {
				setError(
					"Kamerazugriff wurde verweigert. Erlaube die Kamera in den Browser-Einstellungen und versuche es erneut.",
				);
			} else if (name === "NotFoundError" || name === "OverconstrainedError") {
				setError("Keine Kamera gefunden. Gib den Lobbycode manuell ein.");
			} else {
				setError(
					"Kamera konnte nicht gestartet werden. Erlaube den Kamerazugriff und versuche es erneut.",
				);
			}
		});

		return () => {
			scanner.stop();
			scanner.destroy();
		};
	}, []);

	return (
		<div className="space-y-3">
			<div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
				{/* playsInline + muted + autoPlay are required for the inline camera
            preview to actually start on iOS Safari (otherwise it stays black or
            tries to go fullscreen). */}
				<video
					ref={videoRef}
					className="h-full w-full object-cover"
					playsInline
					muted
					autoPlay
				/>
			</div>
			{error ? (
				<p className="text-sm text-destructive text-center">{error}</p>
			) : (
				<p className="text-center text-xs text-muted-foreground">
					Richte die Kamera auf den QR-Code der Lobby.
				</p>
			)}
			<div className="flex justify-center">
				<Button
					size="sm"
					type="button"
					onClick={onClose}
					className="text-muted-foreground"
					variant="ghost"
				>
					Abbrechen
				</Button>
			</div>
		</div>
	);
}
