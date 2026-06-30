import { useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router";
import { ArrowLeft, Plus, LogIn } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore } from "@/store/lobby";
import { ThemeToggle } from "@/components/ThemeToggle";
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

type Step = "start" | "createName" | "joinCode" | "joinName";

export function Home() {
  const params = useParams<{ code?: string }>();
  const { setError, error, lobby, notice, setNotice } = useLobbyStore();

  const deepLinkCode = (params.code ?? "").replace(/\D/g, "").slice(0, 6);

  const [name, setName] = useState("");
  const [code, setCode] = useState(deepLinkCode);
  // A deep link (/join/:code) drops the user straight into the join flow with
  // the code prefilled — only the name is missing.
  const [step, setStep] = useState<Step>(
    deepLinkCode.length === 6 ? "joinName" : "start"
  );
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(ws.isOpen);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track live connection status so the user sees when the server is down.
  useEffect(() => ws.onStatusChange(setConnected), []);

  // Clear any stale error when arriving on the home screen.
  useEffect(() => {
    setError(null);
  }, [setError]);

  // Stop the loading spinner once the server reports an error.
  useEffect(() => {
    if (error) {
      setLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [error]);

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
    setError(null);
    setStep(next);
  }

  function armTimeout() {
    // Safety net: if the server never answers (e.g. backend down), don't hang
    // on "Verbinde…" forever — surface an error so the user can retry.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setError("Keine Verbindung zum Server. Bitte erneut versuchen.");
      setLoading(false);
    }, 8000);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    armTimeout();
    ws.send({ type: "createLobby", payload: { playerName: trimmedName } });
  }

  function submitJoinCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError("Lobbycode muss 6 Ziffern lang sein");
      return;
    }
    goTo("joinName");
  }

  function submitJoinName(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (code.trim().length !== 6) {
      setError("Lobbycode muss 6 Ziffern lang sein");
      setStep("joinCode");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    armTimeout();
    ws.send({
      type: "joinLobby",
      payload: { playerName: trimmedName, lobbyCode: code.trim() },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Stadt Land Fluss</h1>
          <p className="text-muted-foreground text-sm">Multiplayer</p>
        </div>

        {notice && (
          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
            {notice}
          </div>
        )}

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
                {error && <p className="text-sm text-destructive">{error}</p>}
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
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
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
                    disabled={code.trim().length !== 6}
                  >
                    Weiter
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
                Lobby {code} — gib deinen Namen ein.
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
                {error && <p className="text-sm text-destructive">{error}</p>}
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
