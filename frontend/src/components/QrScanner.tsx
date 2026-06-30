import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

// Extracts a 6-digit lobby code from a scanned value. Accepts a full join link
// (".../join/123456") or a bare code.
function extractCode(data: string): string | null {
  try {
    const url = new URL(data);
    const m = url.pathname.match(/\/join\/(\d{6})/);
    if (m) return m[1];
  } catch {
    /* not a URL — fall through */
  }
  const digits = data.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
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
      }
    );

    scanner.start().catch(() => {
      setError(
        "Kamera konnte nicht gestartet werden. Erlaube den Kamerazugriff und versuche es erneut."
      );
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" />
      </div>
      {error ? (
        <p className="text-sm text-destructive text-center">{error}</p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Richte die Kamera auf den QR-Code der Lobby.
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Abbrechen
      </button>
    </div>
  );
}
