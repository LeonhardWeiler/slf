import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useParams, Navigate } from "react-router";
import { ArrowLeft, Plus, LogIn, ScanLine } from "lucide-react";
import { ws } from "@/lib/ws";
import type { LobbyCheckPayload } from "@/types/events";
import { useLobbyStore } from "@/store/lobby";
import { useToastStore } from "@/store/toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// The QR scanner pulls in the sizeable qr-scanner library (+ worker); load it
// only when the user actually opens the scan step so the initial paint is lean.
const QrScannerView = lazy(() =>
  import("@/components/QrScanner").then((m) => ({ default: m.QrScannerView }))
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = "start" | "createName" | "joinCode" | "joinName" | "scan";

// Human-readable reason why a lobby can't be joined, keyed by the server's
// checkLobby reason code. Shown inline at the code step before a name is asked.
const UNAVAILABLE_MESSAGES: Record<string, string> = {
  inProgress: "Diese Lobby ist gerade in einer Runde.",
  full: "Diese Lobby ist voll.",
  notFound: "Diese Lobby gibt es nicht.",
  invalidCode: "Ungültiger Lobbycode.",
  throttled: "Zu viele Versuche – bitte kurz warten.",
};

export function Home() {
  const params = useParams<{ code?: string }>();
  const { lobby } = useLobbyStore();
  const addToast = useToastStore((s) => s.addToast);
  // Monotonic toast counter: a new toast (validation or server error) means the
  // pending submit failed → stop the spinner. Robust against auto-dismissals.
  const toastSeq = useToastStore((s) => s.seq);

  const deepLinkCode = (params.code ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);

  const [name, setName] = useState("");
  const [code, setCode] = useState(deepLinkCode);
  // A deep link (/join/:code) prefills the code and lands on the code step so a
  // pre-join check can run first — an unavailable lobby (mid-game/full/unknown)
  // is surfaced there instead of only after the player typed a name.
  const [step, setStep] = useState<Step>(
    deepLinkCode.length === 6 ? "joinCode" : "start"
  );
  const [loading, setLoading] = useState(false);
  // Pre-join availability check (code/QR/deep-link) and its inline error.
  const [checking, setChecking] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connected, setConnected] = useState(ws.isOpen);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The code whose checkLobby reply we're currently awaiting (to ignore stale
  // replies when the user changed the code meanwhile).
  const pendingCode = useRef<string | null>(null);

  // Track live connection status so the user sees when the server is down.
  useEffect(() => ws.onStatusChange(setConnected), []);

  // Handle checkLobby replies and kick off the initial check for a deep link.
  // biome-ignore lint/correctness/useExhaustiveDependencies: register once on mount
  useEffect(() => {
    ws.on("lobbyCheck", onLobbyCheck);
    if (deepLinkCode.length === 6) checkCode(deepLinkCode);
    return () => {
      ws.off("lobbyCheck");
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, []);

  // Stop the loading spinner once any toast appears (validation or server error).
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on a new toast
  useEffect(() => {
    setLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [toastSeq]);

  // Clean up the pending timeout if the component unmounts.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Already in a lobby (e.g. after a reconnect on reload, or once the server
  // confirms our create/join) → the global handlers set the lobby state and we
  // navigate there. The redirect unmounts this screen.
  if (lobby) {
    return <Navigate to="/lobby" replace />;
  }

  function goTo(next: Step) {
    setStep(next);
  }

  function armTimeout() {
    // Safety net: if the server never answers (e.g. backend down), don't hang
    // on "Verbinde…" forever — surface an error so the user can retry.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      addToast("Keine Verbindung zum Server. Bitte erneut versuchen.");
      setLoading(false);
    }, 8000);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLoading(true);
    armTimeout();
    ws.send({ type: "createLobby", payload: { playerName: trimmedName } });
  }

  function onLobbyCheck(payload: LobbyCheckPayload) {
    // Ignore a reply for a code the user has since changed.
    if (payload.lobbyCode !== pendingCode.current) return;
    pendingCode.current = null;
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    setChecking(false);
    if (payload.available) {
      setJoinError(null);
      setStep("joinName");
    } else {
      setJoinError(
        UNAVAILABLE_MESSAGES[payload.reason ?? ""] ?? "Beitritt nicht möglich."
      );
      // Land back on the code step so the error sits next to the code field
      // (covers the QR and deep-link paths too).
      setStep("joinCode");
    }
  }

  // Ask the server whether `candidate` can be joined right now, before moving on
  // to the name step. Only advances on success; otherwise shows an inline error.
  function checkCode(candidate: string) {
    const c = candidate.trim();
    if (c.length !== 6) {
      setJoinError("Der Lobbycode muss 6 Zeichen lang sein.");
      setStep("joinCode");
      return;
    }
    setJoinError(null);
    setChecking(true);
    pendingCode.current = c;
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(() => {
      pendingCode.current = null;
      setChecking(false);
      setJoinError("Keine Verbindung zum Server. Bitte erneut versuchen.");
    }, 8000);
    ws.send({ type: "checkLobby", payload: { lobbyCode: c } });
  }

  function submitJoinCode(e: React.FormEvent) {
    e.preventDefault();
    checkCode(code);
  }

  function submitJoinName(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (code.trim().length !== 6) {
      addToast("Lobbycode muss 6 Ziffern lang sein");
      setStep("joinCode");
      return;
    }
    setLoading(true);
    armTimeout();
    ws.send({
      type: "joinLobby",
      payload: { playerName: trimmedName, lobbyCode: code.trim() },
    });
  }

  return (
    <div className="min-h-svh flex items-center justify-center screen-pad bg-background">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Stadt Land Fluss</h1>
          <p className="text-muted-foreground text-sm">Multiplayer</p>
        </div>

        {!connected && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Keine Verbindung zum Server…
          </div>
        )}

        {/* ---- Step: start ---- */}
        {step === "start" && (
          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => goTo("createName")}
            >
              <Plus className="h-4 w-4" />
              Lobby erstellen
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => goTo("joinCode")}
            >
              <LogIn className="h-4 w-4" />
              Lobby beitreten
            </Button>
          </div>
        )}

        {/* ---- Step: scan QR ---- */}
        {step === "scan" && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">QR-Code scannen</CardTitle>
              <CardDescription>
                Scanne den Lobby-Code, danach gibst du nur noch deinen Namen ein.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorBoundary
                fallback={() => (
                  <p className="text-sm text-destructive">
                    QR-Scanner konnte nicht geladen werden. Nutze stattdessen den
                    Code.
                  </p>
                )}
              >
                <Suspense
                  fallback={
                    <p aria-live="polite" className="text-sm text-muted-foreground">
                      Kamera wird geladen…
                    </p>
                  }
                >
                  <QrScannerView
                    onScan={(scanned) => {
                      setCode(scanned);
                      // Verify the scanned lobby is joinable before asking a name.
                      checkCode(scanned);
                    }}
                    onClose={() => goTo("joinCode")}
                  />
                </Suspense>
              </ErrorBoundary>
            </CardContent>
          </Card>
        )}

        {/* ---- Step: create → name ---- */}
        {step === "createName" && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Neue Lobby erstellen</CardTitle>
              <CardDescription>Du wirst automatisch zum Host.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Dein Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name eingeben…"
                    maxLength={20}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goTo("start")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Zurück
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || !name.trim()}
                  >
                    {loading ? "Verbinde…" : "Weiter"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ---- Step: join → code ---- */}
        {step === "joinCode" && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Lobby beitreten</CardTitle>
              <CardDescription>
                Gib den Code ein, den du erhalten hast.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitJoinCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Lobbycode</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => {
                      setJoinError(null);
                      setCode(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, "")
                          .slice(0, 6)
                      );
                    }}
                    aria-invalid={joinError != null}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={6}
                    autoFocus
                    autoComplete="off"
                    className="font-mono lowercase tracking-widest"
                  />
                  {joinError && (
                    <p className="text-sm text-destructive">{joinError}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  oder
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => goTo("scan")}
                >
                  <ScanLine className="h-4 w-4" />
                  QR-Code scannen
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goTo("start")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Zurück
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={code.trim().length !== 6 || checking}
                  >
                    {checking ? "Prüfe…" : "Weiter"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ---- Step: join → name ---- */}
        {step === "joinName" && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Lobby beitreten</CardTitle>
              <CardDescription>
                Lobby {code.toUpperCase()} — gib deinen Namen ein.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitJoinName} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-name">Dein Name</Label>
                  <Input
                    id="join-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name eingeben…"
                    maxLength={20}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goTo("joinCode")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Zurück
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || !name.trim()}
                  >
                    {loading ? "Verbinde…" : "Beitreten"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
