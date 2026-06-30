import { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore } from "@/store/lobby";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  if (!lobby) {
    return <Navigate to="/" replace />;
  }

  const me = lobby.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
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

  function setTimeLimit(value: number | null) {
    ws.send({
      type: "updateSettings",
      payload: {
        timeLimit: value,
        showLetterDuringCountdown: lobby!.settings.showLetterDuringCountdown,
      },
    });
  }

  function toggleShowLetter() {
    ws.send({
      type: "updateSettings",
      payload: {
        timeLimit: lobby!.settings.timeLimit,
        showLetterDuringCountdown: !lobby!.settings.showLetterDuringCountdown,
      },
    });
  }

  const canStart =
    isHost && activePlayers.length >= 1 && lobby.categories.length >= 1;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lobby</h1>
            <p className="text-muted-foreground text-sm">Wartet auf Spieler…</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              Verlassen
            </Button>
          </div>
        </div>

        {/* Lobby Code */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Lobbycode
              </p>
              <p className="text-5xl font-mono font-bold tracking-[0.3em]">
                {lobby.lobbyCode}
              </p>
              <p className="text-xs text-muted-foreground">
                Teile diesen Code mit deinen Mitspielern
              </p>
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
                      Host
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
                        onClick={() => setTimeLimit(opt.value)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
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
                  onCheckedChange={toggleShowLetter}
                  aria-label="Buchstabe während Countdown zeigen"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {lobby.settings.showLetterDuringCountdown ? "Ja" : "Nein"}
                </span>
              )}
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
                Mindestens 1 Spieler und 1 Kategorie nötig.
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
