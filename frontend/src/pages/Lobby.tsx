import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { useNavigate, Navigate } from "@tanstack/react-router";
import type { Player } from "@/types/events";
import { Plus, Pencil, Check, X, Trash2, QrCode as QrCodeIcon, Copy, Link as LinkIcon } from "lucide-react";
import { ws } from "@/lib/ws";
import { isTypingTarget } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useConfirm, isConfirmDialogOpen } from "@/components/ConfirmDialog";
import { InfoHint } from "@/components/InfoHint";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionBadge } from "@/components/ConnectionBadge";
// The QR generator (qrcode lib) is only needed when the host reveals the code,
// so load it lazily instead of in the main bundle.
const QrCode = lazy(() =>
  import("@/components/QrCode").then((m) => ({ default: m.QrCode }))
);
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

// Keeps players briefly rendered after they leave so the row can fade out
// instead of snapping away. Present players carry fresh data (name/connection
// stay live); a departed player lingers with its last-known data and
// `leaving: true` until the exit animation has had time to play.
const PLAYER_EXIT_MS = 220;
function usePlayerPresence(
  players: Player[]
): { player: Player; leaving: boolean }[] {
  const [leavingIds, setLeavingIds] = useState<string[]>([]);
  const prevIdsRef = useRef<string[]>(players.map((p) => p.id));
  const lastByIdRef = useRef<Map<string, Player>>(new Map());

  // Remember the latest data for every present player, so a row that starts
  // leaving still has a name to show on the way out.
  for (const p of players) lastByIdRef.current.set(p.id, p);

  useEffect(() => {
    const curIds = players.map((p) => p.id);
    const prev = prevIdsRef.current;
    // Only react to added/removed ids, not to reorders or field updates — those
    // would otherwise re-run this effect on every render and loop via setState.
    const same =
      curIds.length === prev.length && curIds.every((id, i) => id === prev[i]);
    if (same) return;
    prevIdsRef.current = curIds;
    const curSet = new Set(curIds);
    // A re-appeared player (reconnect within the exit window) drops its leaving flag.
    setLeavingIds((l) => l.filter((id) => !curSet.has(id)));
    const gone = prev.filter((id) => !curSet.has(id));
    if (gone.length === 0) return;
    setLeavingIds((l) => Array.from(new Set([...l, ...gone])));
    const t = setTimeout(() => {
      setLeavingIds((l) => l.filter((id) => !gone.includes(id)));
      for (const id of gone) lastByIdRef.current.delete(id);
    }, PLAYER_EXIT_MS);
    return () => clearTimeout(t);
  }, [players]);

  const presentIds = new Set(players.map((p) => p.id));
  const list = players.map((p) => ({ player: p, leaving: false }));
  for (const id of leavingIds) {
    if (presentIds.has(id)) continue;
    const p = lastByIdRef.current.get(id);
    if (p) list.push({ player: p, leaving: true });
  }
  return list;
}

export function Lobby() {
  const navigate = useNavigate();
  const lobby = useLobbyStore((s) => s.lobby);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);
  const reset = useLobbyStore((s) => s.reset);
  const setSelfLeaving = useLobbyStore((s) => s.setSelfLeaving);
  const isHost = useIsHost();
  const { confirm, dialog } = useConfirm();

  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [showQr, setShowQr] = useState(false);
  // True while the QR popup plays its exit animation before unmounting.
  const [qrClosing, setQrClosing] = useState(false);
  const [copied, setCopied] = useState<null | "code" | "link">(null);
  const [copyFailed, setCopyFailed] = useState(false);
  // Bumped on every successful code copy so the pop animation replays even when
  // copying repeatedly (a changing key re-mounts the element → animation reruns).
  const [copyPulse, setCopyPulse] = useState(0);
  // The letter currently playing its toggle pop; cleared when the animation ends
  // so the same letter can pop again on the next toggle.
  const [poppedLetter, setPoppedLetter] = useState<string | null>(null);
  // Set when the disabled "Spiel starten" button is clicked, so the hint text
  // shakes; reset once the shake animation ends.
  const [startShake, setStartShake] = useState(false);
  // The time option currently confirming its selection with a pop (by label).
  const [poppedTime, setPoppedTime] = useState<string | null>(null);
  // While true, every letter replays the pop with a staggered delay — used when
  // "Alle aktivieren" brings the whole row back at once.
  const [staggerLetters, setStaggerLetters] = useState(false);
  // Flash a just-added category so it's clear what appeared. Known ids are
  // seeded from the initial list so existing categories don't flash on mount.
  const [flashCatId, setFlashCatId] = useState<string | null>(null);
  const knownCatIds = useRef<Set<string>>(
    new Set((lobby?.categories ?? []).map((c) => c.id))
  );

  const lobbyCode = lobby?.lobbyCode ?? "";
  const joinLink = lobby ? `${window.location.origin}/join/${lobby.lobbyCode}` : "";

  async function copyText(text: string, kind: "code" | "link") {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopyFailed(false);
      setCopied(kind);
      if (kind === "code") setCopyPulse((n) => n + 1);
      setTimeout(() => setCopied(null), 2000);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  }

  // Ctrl/Cmd+C copies the lobby code — but only when the user isn't selecting
  // text or typing in a field, so normal copy still works there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-bind only on lobbyCode
  useEffect(() => {
    function onCopy(e: KeyboardEvent) {
      if (!(e.key === "c" && (e.ctrlKey || e.metaKey))) return;
      if (isTypingTarget(document.activeElement)) return;
      // Don't hijack copy while a confirm dialog is up (kick/delete/leave) — UX-1.
      if (isConfirmDialogOpen()) return;
      if ((window.getSelection()?.toString() ?? "") !== "") return;
      copyText(lobbyCode, "code");
    }
    window.addEventListener("keydown", onCopy);
    return () => window.removeEventListener("keydown", onCopy);
  }, [lobbyCode]);

  // Play the exit animation, then unmount the popup.
  const closeQr = useCallback(() => {
    setQrClosing(true);
    setTimeout(() => {
      setShowQr(false);
      setQrClosing(false);
    }, 170);
  }, []);

  // QR popup: lock body scroll while open and let Escape close it, matching the
  // confirm dialog's modal behaviour.
  useEffect(() => {
    if (!showQr) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeQr();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showQr, closeQr]);

  // Players who left an in-progress game linger only for the final standings.
  const activePlayers = (lobby?.players ?? []).filter((p) => !p.left);
  // Rows to render, including players that just left (fading out). Called before
  // the early return below so the hook order stays stable.
  const playerRows = usePlayerPresence(activePlayers);

  // Detect categories added since the last render and flash the newest one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: react to the id list only
  useEffect(() => {
    if (!lobby) return;
    const current = lobby.categories.map((c) => c.id);
    const added = current.filter((id) => !knownCatIds.current.has(id));
    knownCatIds.current = new Set(current);
    if (added.length > 0) setFlashCatId(added[added.length - 1]);
  }, [lobby?.categories]);

  if (!lobby) {
    return <Navigate to="/" replace />;
  }

  async function handleLeave() {
    const confirmed = await confirm(
      isHost
        ? {
            title: "Lobby schließen?",
            description:
              "Als Host beendest du die Lobby für alle Mitspieler.",
            confirmLabel: "Lobby schließen",
            destructive: true,
          }
        : {
            title: "Lobby verlassen?",
            description: "Du verlässt die Lobby und kehrst zur Startseite zurück.",
            confirmLabel: "Verlassen",
            destructive: true,
          }
    );
    if (!confirmed) return;
    // Suppress the "lobby closed" toast the host would otherwise get from the
    // server's own lobbyClosed echo.
    setSelfLeaving(true);
    ws.send({ type: "leaveLobby", payload: {} });
    reset();
    void navigate({ to: "/" });
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

  // Kategorien lassen sich jederzeit neu hinzufügen — Löschen ist billig
  // reversibel, daher ohne Bestätigungs-Popup direkt ausführen.
  function deleteCategory(id: string) {
    ws.send({ type: "deleteCategory", payload: { categoryId: id } });
  }

  async function kickPlayer(id: string, name: string) {
    if (
      await confirm({
        title: `${name} entfernen?`,
        description: `${name} wird aus der Lobby entfernt und kehrt zur Startseite zurück.`,
        confirmLabel: "Entfernen",
        destructive: true,
      })
    ) {
      ws.send({ type: "kickPlayer", payload: { playerId: id } });
    }
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
    setPoppedLetter(letter);
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
              <span className="relative block">
                {/* Checkmark pops in above the code on a successful copy — the
                    primary confirmation now sits over the code, not just as a
                    text swap below it. */}
                {copied === "code" && (
                  <span
                    aria-hidden="true"
                    className="animate-check-pop absolute -top-5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-green-600 text-white shadow"
                  >
                    <Check className="h-4 w-4" />
                  </span>
                )}
                <span
                  // Keyed on copyPulse so the pop replays on every copy.
                  key={copyPulse}
                  className={`flex items-center justify-center text-5xl font-mono font-bold uppercase tracking-[0.2em] group-hover:opacity-80 group-active:opacity-80 transition-opacity ${
                    copyPulse > 0 ? "animate-pop" : ""
                  }`}
                >
                  <span>{lobby.lobbyCode.slice(0, 3)}</span>
                  <span className="ml-2">{lobby.lobbyCode.slice(3)}</span>
                </span>
              </span>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                {copyFailed
                  ? "Kopieren nicht möglich – Code manuell markieren (nur über HTTPS)"
                  : "Klicken oder Strg+C zum Kopieren"}
              </p>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                // Fixed width so swapping the label to "Link kopiert!" doesn't
                // make the button jump narrower.
                className="min-w-[8.5rem]"
                onClick={() => copyText(joinLink, "link")}
              >
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
                onClick={() => setShowQr(true)}
              >
                <QrCodeIcon className="h-4 w-4" />
                QR anzeigen
              </Button>
            </div>
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
            {playerRows.map(({ player, leaving }) => (
              <div
                key={player.id}
                className={`flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 ${
                  leaving ? "animate-fade-out pointer-events-none" : "animate-fade-in"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                      player.connected
                        ? "bg-green-500"
                        : "bg-muted-foreground animate-pulse"
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
                  {isHost && !leaving && player.id !== myPlayerId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title={`${player.name} entfernen`}
                      onClick={() => kickPlayer(player.id, player.name)}
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
                onAnimationEnd={() =>
                  setFlashCatId((id) => (id === cat.id ? null : id))
                }
                // Fixed height so switching a row into edit mode doesn't grow it
                // and shove the rest of the list down.
                className={`flex h-10 items-center justify-between px-3 rounded-md bg-muted/50 ${
                  flashCatId === cat.id ? "animate-highlight" : ""
                }`}
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
                      // Seamless inline edit: no border/extra padding so the text
                      // stays exactly where the name span sat (no horizontal jump).
                      className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
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
                        onClick={() => {
                          updateSettings({ timeLimit: opt.value });
                          setPoppedTime(opt.label);
                        }}
                        onAnimationEnd={() =>
                          setPoppedTime((t) => (t === opt.label ? null : t))
                        }
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          poppedTime === opt.label ? "animate-pop" : ""
                        } ${
                          // Selected: border matches the fill so no lighter halo
                          // shows (border reads as an edge only on the darker,
                          // unselected fill). See TODO 13.
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

            {/* Commentator mode — on = host doesn't play, only comments (the
                switch is the inverse of the hostPlays flag it drives). */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">Kommentator</p>
                <InfoHint label="Was bedeutet „Kommentator“?">
                  An: Der Host spielt nicht mit, sondern ist nur Kommentator und
                  sieht auf dem Beamer, wer schon ausgefüllt hat – ohne die
                  Antworten selbst.
                </InfoHint>
              </div>
              {isHost ? (
                <Switch
                  checked={!lobby.settings.hostPlays}
                  onCheckedChange={(v: boolean) =>
                    updateSettings({ hostPlays: !v })
                  }
                  aria-label="Kommentator"
                />
              ) : (
                <span className="text-sm text-muted-foreground shrink-0">
                  {lobby.settings.hostPlays ? "Nein" : "Ja"}
                </span>
              )}
            </div>

            {/* Flames spice */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Flammen</p>
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

            {/* Last-letter spice */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Letzter Buchstabe</p>
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
                  aria-label="Letzter Buchstabe"
                />
              ) : (
                <span className="text-sm text-muted-foreground shrink-0">
                  {lobby.settings.lastLetterMode ? "Ja" : "Nein"}
                </span>
              )}
            </div>

            {/* Show letter during countdown */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Buchstabe während Countdown</p>
              {isHost ? (
                <Switch
                  checked={lobby.settings.showLetterDuringCountdown}
                  onCheckedChange={(v: boolean) =>
                    updateSettings({ showLetterDuringCountdown: v })
                  }
                  aria-label="Buchstabe während Countdown"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {lobby.settings.showLetterDuringCountdown ? "Ja" : "Nein"}
                </span>
              )}
            </div>

            {/* Letter selection */}
            <div className="space-y-2">
              {/* min-h matches the "Alle aktivieren" button (h-7) so the row keeps
                  the same height whether or not the button is shown — no layout
                  shift when a letter is toggled. "Alle aktivieren" sits inward of
                  the count, which stays flush right. */}
              <div className="flex min-h-7 items-center justify-end gap-2">
                {isHost && lobby.settings.excludedLetters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      updateSettings({ excludedLetters: [] });
                      setStaggerLetters(true);
                      // Long enough for the last letter's delayed pop to finish.
                      setTimeout(() => setStaggerLetters(false), 26 * 18 + 350);
                    }}
                  >
                    Alle aktivieren
                  </Button>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {26 - lobby.settings.excludedLetters.length} von 26 aktiv
                </span>
              </div>
              {!isHost && (
                <p className="text-xs text-muted-foreground">
                  Aktive Buchstaben für dieses Spiel.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {ALPHABET.map((letter, idx) => {
                  const excluded =
                    lobby.settings.excludedLetters.includes(letter);
                  const popping = poppedLetter === letter || staggerLetters;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!isHost}
                      onClick={() => toggleLetter(letter)}
                      onAnimationEnd={() =>
                        setPoppedLetter((l) => (l === letter ? null : l))
                      }
                      aria-pressed={!excluded}
                      title={
                        excluded ? `${letter} aktivieren` : `${letter} deaktivieren`
                      }
                      style={
                        staggerLetters
                          ? { animationDelay: `${idx * 18}ms` }
                          : undefined
                      }
                      className={`h-8 w-8 rounded-md text-sm font-semibold border transition-[background-color,border-color,color,opacity] duration-200 ${
                        popping ? "animate-pop" : ""
                      } ${isHost ? "cursor-pointer" : "cursor-default"} ${
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
            {/* Kept a real, focusable button (aria-disabled instead of disabled)
                so a click while not startable still fires and can shake the hint
                — a plain disabled button swallows the click. */}
            <Button
              className="w-full transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:translate-y-0"
              size="lg"
              aria-disabled={!canStart}
              onClick={() => {
                if (!canStart) {
                  setStartShake(true);
                  return;
                }
                ws.send({ type: "startGame", payload: {} });
              }}
            >
              Spiel starten
            </Button>
            {!canStart && (
              <p
                onAnimationEnd={() => setStartShake(false)}
                className={`text-center text-xs ${
                  startShake
                    ? "animate-shake text-destructive"
                    : "text-muted-foreground"
                }`}
              >
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

      {/* QR popup — same modal chrome as the confirm dialog, so revealing the
          code no longer pushes the page layout around. The join link lives here
          too (previously under the inline QR). */}
      {showQr && (
        // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only backdrop-to-close; Escape is handled by the effect above and the close button
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is optional mouse sugar — Escape closes via the window listener above
        <div
          className={`fixed inset-0 z-[60] m-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${
            qrClosing ? "animate-fade-out" : "animate-fade-in"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQr();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-title"
            className={`w-full max-w-sm max-h-[calc(100svh-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl ${
              qrClosing ? "animate-scale-out" : "animate-scale-in"
            }`}
          >
            <h2 id="qr-title" className="text-center text-lg font-semibold">
              Zum Beitreten scannen
            </h2>
            <div className="mt-4 flex flex-col items-center gap-3">
              <ErrorBoundary
                fallback={() => (
                  <p className="text-sm text-destructive">
                    QR-Code konnte nicht geladen werden.
                  </p>
                )}
              >
                <Suspense fallback={<div style={{ height: 220 }} />}>
                  <QrCode value={joinLink} size={220} />
                </Suspense>
              </ErrorBoundary>
              <button
                type="button"
                onClick={() => copyText(joinLink, "link")}
                title="Link kopieren"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground active:text-foreground transition-colors break-all"
              >
                {copied === "link" ? (
                  <>
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    Link kopiert!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                    {joinLink}
                  </>
                )}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={closeQr}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
