import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { Plus, Pencil, Check, X, Trash2, QrCode as QrCodeIcon, Copy, Link as LinkIcon } from "lucide-react";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Unbegrenzt", value: null },
  { label: "30 Sek.", value: 30 },
  { label: "60 Sek.", value: 60 },
  { label: "90 Sek.", value: 90 },
  { label: "120 Sek.", value: 120 },
  { label: "180 Sek.", value: 180 },
];

export function Lobby() {
  const navigate = useNavigate();
  const { lobby, myPlayerId, reset } = useLobbyStore();
  const isHost = useIsHost();

  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState<null | "code" | "link">(null);

  const lobbyCode = lobby?.lobbyCode ?? "";
  const joinLink = lobby ? `${window.location.origin}/join/${lobby.lobbyCode}` : "";

  function copyText(text: string, kind: "code" | "link") {
    if (!text) return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        /* clipboard unavailable (e.g. insecure context) — ignore */
      });
  }

  // Ctrl/Cmd+C copies the lobby code — but only when the user isn't selecting
  // text or typing in a field, so normal copy still works there.
  useEffect(() => {
    function onCopy(e: KeyboardEvent) {
      if (!(e.key === "c" && (e.ctrlKey || e.metaKey))) return;
      if (isTypingTarget(document.activeElement)) return;
      if ((window.getSelection()?.toString() ?? "") !== "") return;
      copyText(lobbyCode, "code");
    }
    window.addEventListener("keydown", onCopy);
    return () => window.removeEventListener("keydown", onCopy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyCode]);

  if (!lobby) {
    return <Navigate to="/" replace />;
  }

  // Players who left an in-progress game linger only for the final standings.
  const activePlayers = lobby.players.filter((p) => !p.left);

  function handleLeave() {
    ws.send({ type: "leaveLobby", payload: {} });
    reset();
    void navigate("/");
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    ws.send({ type: "addCategory", payload: { name } });
    setNewCategory("");
  }

  function startEdit(id: string, current: string) {
    setEditingId(id);
    setEditingValue(current);
  }

  function saveEdit() {
    const name = editingValue.trim();
    if (editingId && name) {
      ws.send({ type: "editCategory", payload: { categoryId: editingId, name } });
    }
    setEditingId(null);
    setEditingValue("");
  }

  function deleteCategory(id: string) {
    ws.send({ type: "deleteCategory", payload: { categoryId: id } });
  }

  function kickPlayer(id: string) {
    ws.send({ type: "kickPlayer", payload: { playerId: id } });
  }

  function updateSettings(patch: {
    timeLimit?: number | null;
    showLetterDuringCountdown?: boolean;
    excludedLetters?: string[];
    hostPlays?: boolean;
    lastLetterMode?: boolean;
    flamesEnabled?: boolean;
  }) {
    const s = lobby!.settings;
    ws.send({
      type: "updateSettings",
      payload: {
        timeLimit: patch.timeLimit !== undefined ? patch.timeLimit : s.timeLimit,
        showLetterDuringCountdown:
          patch.showLetterDuringCountdown ?? s.showLetterDuringCountdown,
        excludedLetters: patch.excludedLetters ?? s.excludedLetters,
        hostPlays: patch.hostPlays ?? s.hostPlays,
        lastLetterMode: patch.lastLetterMode ?? s.lastLetterMode,
        flamesEnabled: patch.flamesEnabled ?? s.flamesEnabled,
      },
    });
  }

  function toggleLetter(letter: string) {
    const excluded = new Set(lobby!.settings.excludedLetters);
    if (excluded.has(letter)) excluded.delete(letter);
    else excluded.add(letter);
    updateSettings({ excludedLetters: [...excluded] });
  }

  // A commentator host (hostPlays=false) doesn't count as a player, so at least
  // one other player is required to start.
  const playingCount = lobby.settings.hostPlays
    ? activePlayers.length
    : activePlayers.filter((p) => !p.isHost).length;
  const canStart =
    isHost && playingCount >= 1 && lobby.categories.length >= 1;

  return (
    <div className="min-h-svh bg-background screen-pad">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lobby</h1>
            <p className="text-muted-foreground text-sm">
              {activePlayers.length <= 1
                ? "Warte auf Mitspieler…"
                : `${activePlayers.length} Spieler bereit`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              Verlassen
            </Button>
          </div>
        </div>

        {/* Lobby Code */}
        <Card>
          <CardContent className="pt-6">
            <button
              type="button"
              onClick={() => copyText(lobbyCode, "code")}
              title="Lobbycode kopieren (Strg+C)"
              className="block w-full text-center space-y-1 group"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Lobbycode
              </p>
              <p className="text-5xl font-mono font-bold tracking-[0.2em] group-hover:opacity-80 group-active:opacity-80 transition-opacity">
                {lobby.lobbyCode.replace(/(\d{3})(\d{3})/, "$1 $2")}
              </p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                {copied === "code" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    Code kopiert!
                  </>
                ) : (
                  "Klicken oder Strg+C zum Kopieren"
                )}
              </p>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(joinLink, "link")}>
                {copied === "link" ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    Link kopiert!
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4" />
                    Link kopieren
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQr((v) => !v)}
              >
                <QrCodeIcon className="h-4 w-4" />
                {showQr ? "QR verbergen" : "QR anzeigen"}
              </Button>
            </div>

            {showQr && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <QrCode value={joinLink} size={200} />
                <button
                  type="button"
                  onClick={() => copyText(joinLink, "link")}
                  title="Link kopieren"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground active:text-foreground transition-colors break-all"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  {joinLink}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Players */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Spieler ({activePlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activePlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      player.connected ? "bg-green-500" : "bg-muted-foreground"
                    }`}
                  />
                  <span className="text-sm font-medium">{player.name}</span>
                  {player.id === myPlayerId && (
                    <span className="text-xs text-muted-foreground">(du)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {player.isHost && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {lobby.settings.hostPlays ? "Host" : "Host · Kommentator"}
                    </span>
                  )}
                  {isHost && player.id !== myPlayerId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title={`${player.name} entfernen`}
                      onClick={() => kickPlayer(player.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Kategorien ({lobby.categories.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lobby.categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50"
              >
                {isHost && editingId === cat.id ? (
                  <form
                    className="flex items-center gap-2 w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit();
                    }}
                  >
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      maxLength={30}
                      autoFocus
                      className="h-8"
                    />
                    <Button type="submit" size="icon" className="h-7 w-7">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="text-sm">{cat.name}</span>
                    {isHost && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Bearbeiten"
                          onClick={() => startEdit(cat.id, cat.name)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Löschen"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {lobby.categories.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-1">
                Noch keine Kategorien.
              </p>
            )}

            {isHost && (
              <form onSubmit={handleAddCategory} className="flex items-center gap-2 pt-1">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Neue Kategorie…"
                  maxLength={30}
                  className="h-8"
                />
                <Button type="submit" size="icon" className="h-8 w-8" disabled={!newCategory.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Einstellungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time limit */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Zeitlimit pro Runde</p>
              {isHost ? (
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((opt) => {
                    const active = lobby.settings.timeLimit === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => updateSettings({ timeLimit: opt.value })}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted active:bg-muted border-border"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lobby.settings.timeLimit === null
                    ? "Unbegrenzt"
                    : `${lobby.settings.timeLimit} Sek.`}
                </p>
              )}
            </div>

            {/* Show letter during countdown */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Buchstabe während Countdown zeigen</p>
              {isHost ? (
                <Switch
                  checked={lobby.settings.showLetterDuringCountdown}
                  onCheckedChange={(v: boolean) =>
                    updateSettings({ showLetterDuringCountdown: v })
                  }
                  aria-label="Buchstabe während Countdown zeigen"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {lobby.settings.showLetterDuringCountdown ? "Ja" : "Nein"}
                </span>
              )}
            </div>

            {/* Host commentator mode */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Host spielt mit</p>
                <p className="text-xs text-muted-foreground">
                  Aus: Der Host ist nur Kommentator und sieht auf dem Beamer, wer
                  schon ausgefüllt hat – ohne die Antworten selbst.
                </p>
              </div>
              {isHost ? (
                <Switch
                  checked={lobby.settings.hostPlays}
                  onCheckedChange={(v: boolean) =>
                    updateSettings({ hostPlays: v })
                  }
                  aria-label="Host spielt mit"
                />
              ) : (
                <span className="text-sm text-muted-foreground shrink-0">
                  {lobby.settings.hostPlays ? "Ja" : "Nein"}
                </span>
              )}
            </div>

            {/* Last-letter spice */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Letzter statt erster Buchstabe</p>
                <p className="text-xs text-muted-foreground">
                  Antworten müssen mit dem Buchstaben <em>enden</em> statt beginnen.
                </p>
              </div>
              {isHost ? (
                <Switch
                  checked={lobby.settings.lastLetterMode}
                  onCheckedChange={(v: boolean) =>
                    updateSettings({ lastLetterMode: v })
                  }
                  aria-label="Letzter statt erster Buchstabe"
                />
              ) : (
                <span className="text-sm text-muted-foreground shrink-0">
                  {lobby.settings.lastLetterMode ? "Ja" : "Nein"}
                </span>
              )}
            </div>

            {/* Flames spice */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Flammen 🔥</p>
                <p className="text-xs text-muted-foreground">
                  Wette pro Runde auf eine Kategorie, dass du die einzige Antwort
                  hast: richtig +5 (15), falsch 0 Punkte.
                </p>
              </div>
              {isHost ? (
                <Switch
                  checked={lobby.settings.flamesEnabled}
                  onCheckedChange={(v: boolean) =>
                    updateSettings({ flamesEnabled: v })
                  }
                  aria-label="Flammen aktivieren"
                />
              ) : (
                <span className="text-sm text-muted-foreground shrink-0">
                  {lobby.settings.flamesEnabled ? "Ja" : "Nein"}
                </span>
              )}
            </div>

            {/* Letter selection */}
            <div className="space-y-2">
              {/* min-h matches the "Alle aktivieren" button (h-7) so the row keeps
                  the same height whether or not the button is shown — no layout
                  shift when a letter is toggled. */}
              <div className="flex min-h-7 items-center justify-between gap-2">
                <p className="text-sm font-medium">Buchstaben</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {26 - lobby.settings.excludedLetters.length} von 26 aktiv
                  </span>
                  {isHost && lobby.settings.excludedLetters.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateSettings({ excludedLetters: [] })}
                    >
                      Alle aktivieren
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {isHost
                  ? "Tippe einen Buchstaben an, um ihn aus dem Spiel zu nehmen."
                  : "Aktive Buchstaben für dieses Spiel."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALPHABET.map((letter) => {
                  const excluded =
                    lobby.settings.excludedLetters.includes(letter);
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!isHost}
                      onClick={() => toggleLetter(letter)}
                      aria-pressed={!excluded}
                      title={
                        excluded ? `${letter} aktivieren` : `${letter} deaktivieren`
                      }
                      className={`h-8 w-8 rounded-md text-sm font-semibold border transition-colors ${
                        isHost ? "cursor-pointer" : "cursor-default"
                      } ${
                        excluded
                          ? "bg-muted text-muted-foreground/40 border-border line-through"
                          : "bg-primary text-primary-foreground border-primary"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start Game (Host only) */}
        {isHost ? (
          <div className="space-y-1">
            <Button
              className="w-full"
              size="lg"
              disabled={!canStart}
              onClick={() => ws.send({ type: "startGame", payload: {} })}
            >
              Spiel starten
            </Button>
            {!canStart && (
              <p className="text-center text-xs text-muted-foreground">
                {!lobby.settings.hostPlays && playingCount < 1
                  ? "Als Kommentator brauchst du mindestens einen Mitspieler."
                  : "Mindestens 1 Spieler und 1 Kategorie nötig."}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Warte auf den Host…
          </p>
        )}
      </div>
    </div>
  );
}
