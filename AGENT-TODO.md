# AGENT-TODO — Umsetzungsplan (nächste Session)

> **STATUS (erledigt):** Alle 13 Punkte aus `TODO.md` sind umgesetzt und per
> Browser-E2E (Playwright/chromium, 29 Checks grün) verifiziert. Aufgeteilt in
> 4 Commits (Gruppe A+#10, Login-Flow #1, Spielfluss #12/#13, QR #2).
> Verifiziert: Home-Flow, QR-Anzeige, Countdown sofort, Timer ohne Refresh,
> Stoppuhr, Buzz-Zod-Validierung, leere Inputs raus aus Review, Review-Icons,
> Pfeiltasten-Navigation, Merge-per-Button (10→5→10 Punkte), Zurück-zur-Lobby,
> verlassende Spieler bleiben in der Tabelle. QR-Kamera-Scan nur per Build
> geprüft (kein Kamerazugriff im Testlauf). Offen bleibt weiterhin nur:
> Host-Disconnect-30s-Timeout (SRS 4.6/8.5) und SRS 9.4.

Mein konkreter Plan zu den Punkten aus `TODO.md`. Reihenfolge = empfohlene
Abarbeitung (Bugs/Quick-Wins zuerst, größere Features danach, QR zuletzt wegen
neuer Dependency).

## Kontext / Setup
- Backend: Go, Port `:8080`, läuft via `air` (rebuildet bei Dateiänderung). Start sonst: `cd backend && go run ./cmd/server`.
- Frontend: `cd frontend && bun dev` (sucht freien Port ab 5173).
- Tests: `cd backend && go test ./...`. Browser-E2E mit Playwright/chromium — **muss in der Session ggf. neu installiert werden** (`cd $CLAUDE_JOB_DIR/tmp && bun add playwright && bunx playwright install chromium`), dann `node test.mjs` mit zwei `browser.newContext()` für Host+Joiner (isolierte sessionStorage). Achtung: `innerText` spiegelt CSS `uppercase` → Text-Asserts case-insensitiv.
- Architektur-Notizen siehe Memory `project_slf.md`. Server = Single Source of Truth; sessionId in **sessionStorage** (nicht localStorage!).

## Entscheidungen des Users (bestätigt)
- **Punkt 12:** Bei Alphabet leer / Host beendet → Endstand-Screen mit Rangliste; Host-Button **„Zurück zur Lobby"** → Zustand `Lobby` (Config-Screen), **keine** automatische neue Runde. Punkte beim Zurückkehren auf 0 zurücksetzen (neues Spiel startet ohnehin frisch). Spieler/Kategorien/Settings bleiben.
- **Punkt 6/7:** Bewertung = **ein Toggle pro Antwort mit korrigiertem Icon (Aktions-Semantik)**: gültige Antwort → **X**-Icon (Klick entfernt/markiert ungültig); ungültige Antwort → **Haken**-Icon (Klick akzeptiert). (User kann nach Umsetzung gegenchecken.)

---

## A. Bugs / Quick-Wins zuerst

### 9. Countdown sofort anzeigen (kein UI-Flash)
- **Problem:** Beim Start blitzt kurz die Playing-UI auf, bevor der Countdown kommt.
- **Ursache:** `Room.tsx` schaltet auf `lobby.state`, aber `GameScreen` rendert die Phase aus `gameStore.game.state`; beim Übergang kann kurz der alte `game` (Playing der Vorrunde) anliegen.
- **Fix:** In `GameScreen.tsx` die Phase aus **`lobby.state`** ableiten (Countdown vs Playing), nicht aus `game.state`. Zusätzlich beim Verlassen von RoundResult/GameOver `gameStore` sauber halten. Verifizieren: Start → sofort Countdown.
- Dateien: `src/pages/game/GameScreen.tsx`, ggf. `src/pages/Room.tsx`.

### 4. Timer-Anzeige (großer Bug + Features)
- **Bug:** Timer erscheint erst nach Refresh. **Ursache:** `useTicker` re-initialisiert nur bei `resetKey`-Wechsel; beim Übergang Countdown→Playing bleibt `roundId` gleich → Effekt läuft nicht neu → `timeRemaining` (null→Zahl) wird ignoriert. **Fix:** `resetKey` muss Phase/Wert enthalten (z.B. `roundId + state + (timeRemaining??'∞')`) ODER Ticker bei Wert-Wechsel null→Zahl neu initialisieren.
- **Stoppuhr:** Bei `timeLimit === null` **hochzählende verstrichene Zeit** statt „∞". Client zählt ab Playing-Start; für Reconnect `elapsed`/`startedAt` in `gameState`-Payload ergänzen (Backend `buildGameState` + `GameStatePayload`).
- **Roter Rand letzte 5s:** Nur bei Zeitlimit: wenn `timeLeft <= 5 && > 0` → roter Screen-Rand (z.B. `ring`/`border` Overlay, ggf. pulsierend).
- Dateien: `src/pages/game/GameScreen.tsx`; Backend `internal/game/models.go` (GameStatePayload), `internal/websocket/game_util.go` (buildGameState) für elapsed.

### 11. Leere Inputs erscheinen im Review
- **Fix Backend:** `storeAnswer` (game_util.go): bei leerem/Whitespace-Wert den Eintrag **löschen** statt speichern. Und/oder `buildReviewState` Antworten mit `Normalize(value)==""` herausfiltern. Damit erscheinen nur echte Abgaben.
- Dateien: `internal/websocket/game_util.go` (+ ggf. `game_handlers.go`).

### 3. Toggle-Styling (Settings-Switch, im Darkmode komplett weiß)
- **Fix:** Den `showLetterDuringCountdown`-Switch in `Lobby.tsx` mit kontrastreichen Farben in beiden Themes neu stylen (Track an/aus klar unterscheidbar, Thumb sichtbar). Am besten eine wiederverwendbare `components/ui/switch.tsx` bauen (Track: `bg-primary` an / `bg-input` aus; Thumb: `bg-background` mit Border). Auch die Zeitlimit-Chips prüfen.
- Dateien: `src/pages/Lobby.tsx`, neu `src/components/ui/switch.tsx`.

### 6. Review-Icons korrigieren
- Im `ReviewScreen.tsx` Toggle-Icon auf **Aktions-Semantik** umstellen: `a.valid ? X : Check` (gültig → X zum Entfernen; ungültig → Haken zum Akzeptieren). Farbe/Variant entsprechend (z.B. gültig = grün hinterlegt, Button zeigt X).
- Datei: `src/pages/game/ReviewScreen.tsx`.

### 5. Desktop: Antwortfelder in Spalten
- In `GameScreen.tsx` (Playing) die Kategorie-Inputs als responsives Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (klassisches SLF nebeneinander auf Desktop, gestapelt auf Mobile). Ggf. auch Review-Layout auf Desktop breiter.
- Datei: `src/pages/game/GameScreen.tsx`.

### 8. Pfeiltasten-Navigation im Review (Host)
- In `ReviewScreen.tsx` `useEffect` mit `keydown`: `ArrowLeft` → `previousCategory`, `ArrowRight` → `nextCategory` (nur Host, nur wenn nicht in einem Input-Fokus). Cleanup beim Unmount.
- Datei: `src/pages/game/ReviewScreen.tsx`.

---

## B. Interaktions-Redesigns

### 1. Login: 2 Buttons + mehrstufige Flows
- `Home.tsx` umbauen zu Schritt-State (`step`):
  - Start: nur **Create** und **Join** (+ später QR-Button, siehe 2).
  - Create: → Name-Input → „Weiter" → `createLobby`.
  - Join: → Code-Input → „Weiter" → Name-Input → „Weiter" → `joinLobby`.
  - Zurück-Navigation zwischen Schritten. `/join/:code` Deeplink → direkt in Join-Flow mit Code, nur Name fehlt.
- Datei: `src/pages/Home.tsx`.

### 7. Zusammenführen per Button (statt Dropdown)
- `ReviewScreen.tsx`: lokaler State `mergeSourceId`. Klick „Zusammenführen" auf Antwort A → A markiert (highlight) → Klick auf Antwort B → `mergeAnswers(target, source)` (Konvention festlegen: erstklick = Ziel-Gruppe). Erneuter Klick auf A bricht ab. Bereits gemergte: **„Trennen"-Button** (Link2Off) → `unmergeAnswers`. Dropdown entfernen.
- Datei: `src/pages/game/ReviewScreen.tsx`.

### 10. Client-seitige Zod-Validierung fürs Buzzern
- Buzz-Button nur aktiv, wenn **alle** Antworten client-seitig valide: nicht leer, 1–30 Zeichen, beginnt (nach Normalisierung) mit dem aktuellen Buchstaben. Zod-Schema im Frontend (zod ist vorhanden); Normalisierung wie Backend (`engine.go` Normalize) spiegeln. Falsche Inputs blockieren Buzz. Server validiert weiterhin (bleibt Source of Truth).
- Dateien: `src/pages/game/GameScreen.tsx`, neu z.B. `src/lib/answerValidation.ts`.

---

## C. Spielfluss-Änderungen (Backend + Frontend)

### 12. Spielende → Endstand → „Zurück zur Lobby"
- **Backend:** neuer host-only Handler `returnToLobby` (nur in `RoundResult`/`GameOver`): `lobby.State = Lobby`, `lobby.Game = nil`, Scores auf 0. Broadcast `lobbyState`. Dispatch in `handlers.go`, Event in `shared/events` + Frontend-Typen.
- **Frontend:** `GameOverScreen.tsx`: Endstand bleibt, Host-Button **„Zurück zur Lobby"** → `returnToLobby` statt „Neues Spiel". Alphabet-leer geht bereits korrekt nach GameOver (kein Auto-Restart prüfen).
- Dateien: `internal/websocket/{handlers,game_handlers}.go`, `internal/game/state.go` (ok), `shared/events/*`, `src/types/events.ts`, `src/pages/game/GameOverScreen.tsx`.

### 13. Verlassende Spieler bleiben in der Tabelle, nicht im Review
- **Backend `handleLeaveLobby`:** wenn `lobby.State != Lobby` (Spiel läuft) und Spieler ist **nicht** Host → Spieler **nicht löschen**, sondern `Left=true` (neues Feld in `Player`, serialisieren) + `Connected=false`. Bleibt für Ranking erhalten. Im Zustand `Lobby` weiterhin echtes Entfernen. Host-Leave schließt weiterhin die Lobby.
- **Review-Ausschluss:** `buildReviewState` Antworten von `Left`-Spielern überspringen (bzw. deren Round-Answers beim Leave entfernen → 0 Punkte diese Runde, Gesamtpunkte bleiben).
- **Frontend:** verlassene Spieler in RoundResult/GameOver-Tabelle anzeigen (sind in `lobby.players`), Markierung „(verlassen)". In der Lobby-Spielerliste ggf. ausblenden/markieren.
- Annahme: laufende-Runde-Antworten des Verlassenden zählen nicht (0 diese Runde), bisheriger Gesamtscore bleibt. Bei Unklarheit User fragen.
- Dateien: `internal/game/models.go` (Player.Left), `internal/websocket/handlers.go` (handleLeaveLobby), `game_util.go` (buildReviewState), Frontend-Tabellen.

---

## D. QR-Feature (zuletzt — neue Dependency)

### 2. QR scannen (Start) + QR/Link anzeigen (Lobby)
- **Lobby anzeigen:** „QR anzeigen"-Button → QR-Code des Join-Links `${location.origin}/join/${code}` (Dependency `qrcode` ist bereits installiert → in Canvas/DataURL rendern). Darunter den Link als Text; Klick kopiert ihn (`navigator.clipboard.writeText`) mit „kopiert"-Feedback.
- **Start scannen:** „QR scannen"-Button → Kamera-Scanner. **Neue Dependency nötig** (z.B. `qr-scanner` oder `@yudiel/react-qr-scanner`). Scan liefert URL → Code extrahieren → in Join-Flow mit vorausgefülltem Code (nur Name fehlt). Kamera-Zugriff funktioniert auf `localhost`/https.
- Dateien: `src/pages/Home.tsx` (Scanner), `src/pages/Lobby.tsx` (QR + Copy), neu `src/components/QrCode.tsx`.

---

## Abschluss
- Nach jeder Gruppe: `go test ./...` + Frontend `bun run build` (tsc) + gezielte Playwright-Checks.
- Memory `project_slf.md` und diese Datei am Ende aktualisieren.
- Offen unabhängig von TODO: Host-Disconnect-30s-Timeout (SRS 4.6/8.5), SRS 9.4 (auto neue Lobby nach komplettem Alphabet).
