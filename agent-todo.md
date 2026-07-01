# Agent-TODO — Code-Review-Befunde (Verbesserungsplan)

Ergebnis eines Durchgangs durch die gesamte Codebase (Backend + Frontend,
**ohne** UI/Styling). Nach Priorität sortiert; jeder Punkt nennt Ort, Problem
und Lösungsvorschlag. Reihenfolge = empfohlene Abarbeitungsreihenfolge.

Legende Aufwand/Risiko: 🟢 klein · 🟡 mittel · 🔴 größer.

---

## A · Bugs (Korrektheit)

### A1 — Reconnect verdrängt die neue Verbindung 🟢 (HIGH)
**Ort:** `backend/internal/websocket/hub.go` → `onDisconnect`.
**Problem:** `onDisconnect` löscht `h.clients[sessionID]` **bedingungslos** und
setzt `player.Connected = false`. Reconnectet ein Spieler (neue Verbindung `B`),
bevor der Server das Schließen der alten Verbindung `A` bemerkt hat, gilt:
`h.clients[sessionID] == B`. Wenn `A` dann doch schließt, entfernt dessen
`onDisconnect` **`B`** aus der Client-Map und markiert den *tatsächlich
verbundenen* Spieler als offline → er bekommt keine Broadcasts mehr und
erscheint als „getrennt". Tritt bei flakiger Verbindung / dem 2-s-Auto-Reconnect
auf (bei F5 schließt A meist zuerst, dann ist alles ok — deshalb bisher unauffällig).
**Fix:** Nur aufräumen, wenn die Map noch *auf dieses* Client-Objekt zeigt:
```go
if cur, ok := h.clients[c.sessionID]; ok && cur == c {
    delete(h.clients, c.sessionID)
    // ... player.Connected = false + slog + broadcast
}
```
Sonst (neuere Verbindung existiert) nichts tun.
**Optional (ergänzend, A1b):** In `handleReconnect` die alte Verbindung aktiv
schließen (`if old := h.clients[sid]; old != nil && old != c { old.conn.Close(...) }`),
damit nie zwei Sockets pro Session live sind.

### A2 — Lobbycode-Kollision überschreibt bestehende Lobby 🟢 (MED)
**Ort:** `backend/internal/websocket/util.go` (`generateLobbyCode`),
`room_manager.go` (`Create`), `handlers.go` (`handleCreateLobby`).
**Problem:** `generateLobbyCode` zieht eine 6-stellige Zahl ohne
Eindeutigkeitsprüfung; `RoomManager.Create` macht `rm.rooms[code] = room` —
bei Kollision (Raum bei 10⁶ Codes) wird die **bestehende Lobby überschrieben**
und verwaist. Bei vielen parallelen Lobbys real möglich.
**Fix:** Code unter gehaltenem `hub.mu` in einer Schleife neu ziehen, bis
`rooms.Get(code)` leer ist (oder `RoomManager.Create` gibt bei Existenz einen
Fehler zurück). Analog defensiv für `generateID` bei Session/Player denkbar
(Kollision dort aber vernachlässigbar → optional).

### A3 — `startGame` aus `GameOver` behält „Left"-Spieler 🟢 (LOW)
**Ort:** `backend/internal/websocket/game_handlers.go` → `handleStartGame`
(erlaubt Start aus `StateLobby` **und** `StateGameOver`).
**Problem:** Nur `returnToLobby` entfernt Spieler mit `Left == true` und cleant.
Ein direkter Neustart aus `GameOver` setzt zwar alle Scores auf 0, lässt aber das
`Left`-Flag stehen → diese Spieler bleiben in der Tabelle als „(verlassen)" und
sind aus dem Review ausgeschlossen. Aktuell nicht per UI auslösbar (GameOver bietet
nur „Zurück zur Lobby"), aber der Handler erlaubt es.
**Fix:** Beim Start `Left`-Spieler entfernen (wie in `returnToLobby`) **oder**
`startGame` nur aus `StateLobby` zulassen und den GameOver-Pfad allein über
`returnToLobby` führen.

### A4 — RoundResult nach Reconnect: leere Buchstaben-Übersicht & falsches Button-Label 🟡 (LOW)
**Ort:** `frontend/src/pages/game/RoundResultScreen.tsx` (nutzt `game` aus dem
Store für `remainingLetters`/`usedLetters`/Label); Server:
`sendCurrentGameStateTo` sendet im `RoundResult` nur `roundResult`, kein `gameState`.
**Problem:** Nach Reconnect im RoundResult ist `game` im Store `null` →
`LetterOverview` leer und das Label zeigt „Spiel abschließen" statt „Nächste Runde",
weil `lettersLeft` auf 0 defaultet.
**Fix:** `usedLetters`/`remainingLetters` (oder ein `lettersLeft`-Flag) in den
`roundResult`-Payload aufnehmen, oder beim Reconnect zusätzlich den letzten
`gameState` mitschicken. Alternativ Label serverseitig entscheiden.

### A5 — Fehlende defensive nil-Checks im Review/Scoring 🟢 (LOW)
**Ort:** `game_handlers.go` → `handleFinishReview` greift `lobby.Game.Round` zu,
nachdem nur `lobby.State == Reviewing` geprüft wurde.
**Problem:** Ist der Zustand (durch einen künftigen Bug) `Reviewing` **ohne** `Game`,
paniced der Server (nil-Deref) → RuntimeError statt sauberem Abweisen.
**Fix:** `if lobby.Game == nil || lobby.Game.Round == nil { sendError(...); return }`
ergänzen (analog zu `mutateReview`, das das bereits tut).

---

## B · Robustheit & Performance

### B1 — Broadcasts ohne Write-Timeout, sequentiell 🟡 (MED)
**Ort:** `hub.go`/`game_util.go` → alle `writeRaw`/`broadcastTo`-Schleifen nutzen
`c.conn.Write(context.Background(), …)` und schreiben Client für Client
nacheinander.
**Problem:** Ein langsamer/toter Client (TCP-Backpressure) blockiert ohne Timeout
die Schleife und damit den Broadcast für **alle folgenden** Clients — genau im
Ziel-Szenario „≥ 500 Spieler" kritisch. (Der Loadtest über loopback zeigt das
nicht, weil dort niemand langsam ist.)
**Fix:** Pro Write ein `context.WithTimeout` (z. B. 2–5 s); bei Fehler/Timeout
Verbindung schließen. Optional Broadcasts parallelisieren (Goroutine je Client
oder Worker-Pool). Hinweis: `coder/websocket` erlaubt keine *nebenläufigen*
Writes auf **dieselbe** Verbindung — Parallelität nur über verschiedene Clients.

### B2 — Session-IDs mit `math/rand` statt `crypto/rand` 🟡 (MED, Security)
**Ort:** `backend/internal/websocket/util.go` → `generateID` (auch für `sessionId`).
**Problem:** Die `sessionId` ist das **einzige Auth-Merkmal** (Reconnect/Identität).
`math/rand` ist nicht kryptografisch — Ausgaben sind bei bekanntem Zustand
korreliert/vorhersagbar → theoretisches Session-Hijacking.
**Fix:** `sessionId` (und gerne `playerId`) aus `crypto/rand` erzeugen
(z. B. `base32`/hex über 16 Zufalls-Bytes). Lobbycode darf `math/rand` bleiben.

### B3 — Doppeltes Locking pro Broadcast 🟢 (LOW)
**Ort:** `game_util.go` → `broadcastGameState`/`broadcastReviewState` bauen den
Payload unter einem Lock, `broadcastTo` erhöht danach `Version` und marshalt unter
einem **zweiten** Lock.
**Problem:** Zwei Lock-Zyklen je Broadcast + kleines Fenster, in dem sich State/
Version zwischen Payload-Bau und Versionierung ändern könnten (Inkonsistenz-Risiko,
gering).
**Fix:** Payload-Bau **und** `Version++` in *einem* gehaltenen Lock erledigen
(Version als Parameter durchreichen statt in `broadcastTo` zu bumpen).

### B4 — `answerUpdate` bei jedem Tastendruck 🟢 (LOW)
**Ort:** `frontend/src/pages/game/GameScreen.tsx` → `updateAnswer` sendet je
Keystroke ein `answerUpdate`.
**Problem:** Viel WS-Traffic bei schnellem Tippen (jede Taste = 1 Nachricht),
unnötige Serverarbeit. Funktional ok (localStorage puffert für Reconnect).
**Fix:** Senden um ~150–300 ms debouncen (letzter Wert pro Kategorie), beim
Buzz/Blur sofort flushen.

---

## C · Toter Code / Redundanz / Sauberkeit

### C1 — Ungenutzte Backend-Funktionen/Felder entfernen 🟢
- `hub.go` `sendTo(...)` — nirgends aufgerufen → entfernen.
- `hub.go` `writeRawTo(...)` — nirgends aufgerufen → entfernen.
- `game.Answer.Normalized` — wird gesetzt, aber **nie gelesen** (Scoring nutzt
  `Normalize(a.Value)` direkt) → Feld + Zuweisung entfernen.
- `game.Round.BuzzedBy` — wird in `handleBuzz` gesetzt, aber nie gelesen/gesendet.
  → **Entweder** nutzen (z. B. „X hat gebuzzert" im RoundResult anzeigen) **oder**
  Feld + Zuweisung entfernen. (Bewusste Entscheidung nötig.)

### C2 — Doppelte `validateAnswers`-Berechnung 🟢
**Ort:** `GameScreen.tsx` — `canBuzz` ruft `validateAnswers(...).valid`, kurz darauf
berechnet `validation` dasselbe erneut.
**Fix:** Einmal `const validation = validateAnswers(...)` berechnen und
`canBuzz` daraus ableiten (`validation.valid && lobby.state === "Playing"`).

### C3 — „bin ich Host?" mehrfach dupliziert 🟢
**Ort:** In `Lobby`, `GameScreen`, `ReviewScreen`, `RoundResultScreen`,
`GameOverScreen` je `lobby.players.find(p => p.id === myPlayerId)?.isHost`.
In `RoundResultScreen` sogar **zweimal** (`amHost` **und** `isHost`, identisch).
**Fix:** Kleinen Selektor/Hook `useIsHost()` (bzw. `useMe()`) im lobby-Store
bereitstellen und überall verwenden; Doppelung in RoundResultScreen entfernen.

### C4 — Wiederholte „Fokus in Eingabefeld?"-Tastatur-Guard 🟢
**Ort:** identische Prüfung (`activeElement.tagName === "INPUT"/"TEXTAREA"/…`) in
`ReviewScreen`, `RoundResultScreen`, `Lobby`, (sinngemäß) `GameScreen`.
**Fix:** Helper `isTypingTarget(el)` in `lib/` auslagern und wiederverwenden.

### C5 — Defensive `?? []` für `excludedLetters` 🟢
**Ort:** `Lobby.tsx` mehrfach `lobby.settings.excludedLetters ?? []`.
**Problem/Fix:** Der Server liefert `excludedLetters` immer (nie undefined) und der
Typ ist `string[]` (nicht optional). Die `?? []`-Guards sind toter Ballast →
entfernen (Typ bleibt nicht-optional).

---

## D · Optional / Härtung

### D1 — WebSocket-Origin einschränkbar machen 🟢 (LOW)
**Ort:** `client.go` `ServeWS` → `OriginPatterns: []string{"*"}`.
**Problem:** Akzeptiert jede Origin (CSWSH-Fläche). Risiko gering (Auth-Token in
sessionStorage, nicht Cookie), aber unsauber für „echten" Betrieb.
**Fix:** Erlaubte Origins via ENV konfigurierbar; Default fürs LAN weiterhin offen.

### D2 — Graceful Shutdown 🟢 (LOW)
**Ort:** `cmd/server/main.go` → `http.ListenAndServe` ohne Signal-Handling.
**Fix:** `http.Server` + `Shutdown(ctx)` auf SIGINT/SIGTERM (sauberes
`docker stop`). Da State ohnehin im RAM lebt, rein kosmetisch/log-freundlich.

---

## Reihenfolge-Empfehlung
1. **A1** (Reconnect-Bug) — höchster Nutzen, kleiner Fix.
2. **A2** (Code-Kollision), **B2** (crypto/rand) — beide klein, klarer Gewinn.
3. **C1–C5** (Aufräumen) — schnell, macht den Rest übersichtlicher.
4. **B1** (Write-Timeout) — wichtig für echte Last, etwas mehr Denkarbeit.
5. Rest (A3–A5, B3, B4, D1, D2) nach Bedarf.

> Hinweis: A1, A2, B1 sind schwer per Unit-Test abzudecken — am besten mit dem
> vorhandenen Muster (echter WS-Client / Playwright) bzw. gezielten
> Nebenläufigkeits-Tests verifizieren.
