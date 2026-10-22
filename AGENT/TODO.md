# TODO

Zusammengeführt am 2026-10-22 aus der alten TODO (Netz-Performance, gemessen
2026-08-07), `project-health-report.html` (Scan 2026-08-07) und
`performance-report.html`. Jeder Punkt wurde gegen den aktuellen Code geprüft
und ist noch offen. Reihenfolge nach Wirkung/Aufwand.

Ausgangslage Netz: die Serialisierung ist **nicht** das Problem
(JSON-Marshalling = 0,6 % der Roundtrip-Latenz, Loadtest mit 500 Spielern:
avg 2,27 ms). Der Schmerz auf schmalen Leitungen (EDGE/3G) kommt aus
unkomprimierten Bytes, zu harten Timeouts und stillen Verbindungsabbrüchen.
Punkte 1 und 2 senken den Kaltstart um ~70 % und den laufenden Traffic um
68-91 %, ohne Spiellogik anzufassen.

---

## 1. HTTP-Kompression für die statischen Assets

`spaHandler` in `backend/cmd/server/main.go` liefert über `http.FileServer`
**roh** aus, obwohl der Browser gzip/br anbietet. Kaltstart: 445 KB statt
~133 KB, bei EDGE (~12,5 KB/s) **36 s statt 10 s** bis zum ersten Bild.

- Assets zur Buildzeit vorkomprimieren (`.br` + `.gz` in der
  `frontend`-Derivation in `flake.nix` nach `bun run build`), maximale Stufe.
- `spaHandler`: bei passendem `Accept-Encoding` die vorkomprimierte Variante
  ausliefern, sonst das Original.
- `Content-Encoding` **und** `Vary: Accept-Encoding` setzen;
  `Cache-Control: immutable` für `/assets/` bleibt.
- `index.html` mit abdecken.

## 2. WebSocket-Kompression (permessage-deflate)

`coder/websocket` hat `CompressionDisabled` als Default, der Code setzt nie
etwas anderes.

| Payload                    | roh     | deflate        |
| -------------------------- | ------- | -------------- |
| typisch (6 Spieler/3 Kat.) | 1096 B  | 353 B (-68 %)  |
| 25 Spieler                 | 3273 B  | 520 B (-84 %)  |
| Cap (200 Spieler/100 Kat.) | 27162 B | 2352 B (-91 %) |

- `CompressionMode` in den `AcceptOptions` in
  `internal/websocket/client.go` (`ServeWS`) setzen.
- **`CompressionNoContextTakeover`**, nicht ContextTakeover (~1,2 MB
  `flate.Writer` pro Verbindung, bei 500 Spielern ~600 MB).
- Mit `go run ./cmd/loadtest -players 500` gegenmessen: Latenz und Speicher.

## 3. `writeTimeout` von 5 s auf 15-20 s

`writeRaw` (`internal/websocket/client.go`) schließt die Verbindung, wenn ein
Write nicht in 5 s durchgeht. Große Lobby über EDGE: 27 KB / 12,5 KB/s = 2,2 s
plus Radio-Promotion (1-2 s), RTT und Retransmits -> Kick, Reconnect, gleicher
großer State, Schleife. Risiko skaliert mit der Spielerzahl; Punkt 2 entschärft
es zusätzlich.

## 4. Heartbeat gegen halb-tote Verbindungen

Kein Ping/Pong, `coder/websocket` pingt nicht selbst. Mobilfunk-NAT räumt
stille Verbindungen weg (Lobby/Bewertung: minutenlang kein Traffic).
`ensureConnected` in `lib/ws.ts` prüft nur `readyState === WebSocket.OPEN`,
und das bleibt bei half-open stehen.

- Server-seitig alle ~25 s `conn.Ping(ctx)` mit Deadline; scheitert er,
  Verbindung schließen und `onDisconnect` normal laufen lassen. Damit greift
  der bestehende Reconnect-Pfad (Backoff + Jitter).

## 5. Lobby-Erstellung drosseln (SEC-1)

`handleCreateLobby` (`internal/websocket/handlers.go`) ist der einzige
ungedrosselte Ressourcenpfad: nur das globale `maxLobbies = 10000`. Ein Socket
erzeugte 300 Lobbys in 8,5 s; bei voller Nachrichtenrate ist der Cap in ~4 min
erreicht, danach bekommt jeder "Server ausgelastet" für ~12 min pro Welle
(Janitor: 2-min-Pass + 10-min-TTL). Mit dem öffentlichen Deploy auf
slf.coprime.tech nicht mehr theoretisch.

- Pro Verbindung eine Quote oder wachsenden Backoff wie beim Join
  (`c.createdLobbies` neben `c.joinFails`).

## 6. Eigener Name bleibt nach dem Verlassen reserviert (UX-1)

Die Namensprüfung in `handleJoinLobby` scannt alle `lobby.Players` inklusive
`Left`; die fliegen erst bei `resetForNewGame` raus. Nach "Verlassen" oder Kick
mitten im Spiel scheitert der Rejoin mit `NAME_NOT_UNIQUE`, obwohl der Name in
der Lobby-Liste nirgends zu sehen ist. Mit anderem Namen steht man dann
doppelt in der Wertung.

- `Left`-Spieler aus der Eindeutigkeitsprüfung nehmen (die alte Zeile behält
  ihren Namen in der Wertung).

## 7. QR-Dialog ohne Fokus-Handling (A11Y-1)

Das QR-Popup in `pages/Lobby.tsx` hat `role="dialog" aria-modal="true"`, setzt
aber keinen Fokus, fängt Tab nicht und gibt den Fokus beim Schließen nicht
zurück. `ConfirmDialog.tsx` macht alle drei richtig.

- Die Dialog-Hülle aus `ConfirmDialog` in eine gemeinsame Komponente heben und
  im QR-Popup nutzen.

## 8. Format-, Lint- und Vet-Gate in den Build (CI-1)

CI ist nur noch `nix build` (`.github/workflows/deploy.yml`). Das läuft
`go test` und `bun test src`, aber **weder** `gofmt`, `go vet`, `biome lint`
noch einen Format-Check. `bun run lint` ist `biome lint src`, ohne Format.
`biome format .` meldet aktuell 8 Dateien: `biome.json`, `package.json`,
`tsconfig.json`, `vite.config.ts`, `src/index.css`,
`src/lib/answerValidation.ts`, `src/lib/serverEvents.ts`, `src/pages/Lobby.tsx`.

- `lint`-Script auf `biome ci .` umstellen und in der `frontend`-Derivation
  vor `bun test` laufen lassen; `gofmt -l` (muss leer sein) und `go vet` in den
  `preCheck` der Go-Derivation.
- Einmal formatieren, um den aktuellen Drift zu beseitigen.

## 9. Kurz getrennter Spieler gilt als "verlassen" (UX-2)

`hasLeft()` in `RoundResultScreen.tsx` und `GameOverScreen.tsx` ist
`p.left || !p.connected`. Ein 3-s-Abbruch zeigt "(verlassen)" für alle,
während die Lobby-Liste denselben Spieler mit pulsierendem Punkt zeigt. Das
Prädikat sperrt auch den Kick-Button genau dann, wenn der Host ihn am ehesten
braucht.

- "(verlassen)" nur bei `p.left`, für `!p.connected` die reversible Darstellung
  der Lobby-Liste; Kick nur über `p.left` sperren. Die doppelte Funktion dabei
  zusammenlegen.

## 10. Live-Regions erscheinen zusammen mit ihrem Inhalt (A11Y-2)

`Toaster.tsx` gibt bei leerer Queue `null` zurück, das `aria-live`-Element
entsteht also zeitgleich mit dem ersten Toast und wird oft nicht angesagt.
Gleich bei `ConnectionBadge.tsx` (`role="status"`, nur bei getrennt
gerendert). Der Kamerafehler in `QrScanner.tsx` ist ein `<p>` ohne
Live-Semantik.

- Live-Region-Wrapper immer rendern, nur die Kinder tauschen; Scanner-Fehler
  bekommt `role="alert"`.

## 11. Rundenstart prüft die Vorbedingung in einem anderen Lock (CONC-1)

`handleStartGame` / `handleStartNextRound` prüfen den State, geben den Lock
frei und rufen dann `beginCountdown`, das nur `lobby.Game != nil` nachprüft
(`beginPlaying` und `endRound` prüfen `roundID` + State). 2 Sockets auf einer
Session (alle Tabs teilen die `sessionId`; ein ersetzter Socket bleibt bis zum
Schließen nutzbar) können so 2 Runden starten. Nicht reproduziert (8 Versuche),
struktureller Härtungspunkt.

- Erwarteten State an `beginCountdown` übergeben und unter demselben Lock
  prüfen. Optional in `lookupLocked` `h.clients[sessionID] == c` verlangen.

## 12. Initial-Bundle verkleinern (erst nach Punkt 1)

Initial-Chunk 401 KB roh / 124 KB gzip:

```
174.1 KB  44.7%  react-dom
 64.8 KB  16.6%  zod            <- nur wegen serverEvents.ts im Initial-Chunk
 54.6 KB  14.0%  @tanstack/router-core
 26.5 KB   6.8%  tailwind-merge
 25.8 KB   6.6%  (eigener Code)
```

- **Zod aus dem Initial-Chunk** (~18 KB gzip): hängt nur drin, weil `lib/ws.ts`
  sofort `parseServerEvent` braucht. Handgeschriebene Validatoren für die
  Event-Schemas in `lib/serverEvents.ts` oder `zod/mini`. Die Validierung jedes
  eingehenden Events ist Invariante (CLAUDE.md) und bleibt, nur die Umsetzung
  ändert sich.
- **Room-Chunk vorladen:** `Room` ist lazy (`router.tsx`); auf langsamer
  Leitung kurz leer. Bei Hover/Focus auf Erstellen/Beitreten den `import()`
  anstoßen.
- `tailwind-merge` (~7 KB gzip) nur, wenn das nicht reicht (Styling-Risiko).

## 13. Gefühlte Geschwindigkeit bei hoher Latenz

- **Buzz-Feedback:** der Button in `GameScreen.tsx` wartet stumm auf die
  Serverantwort. Sofortiger Pending-Zustand.
- **Timer-Drift:** `timeRemaining` kommt in ganzen Sekunden, der Client tickt
  lokal weiter und hinkt bei 1 s RTT ~1 s hinterher (spürbar in der
  `dangerZone`). RTT/2-Kompensation oder absolute Deadline + Clock-Offset in
  `buildGameState`.
- Die 8-s-Timeouts in `Home.tsx` (`armTimeout`, `checkCode`) auf 15 s heben.

## 14. Doku-Kleinkram (DOC-2)

- `frontend/public/llms.txt`: "Set the categories and number of rounds, then
  play rounds that share a letter" stimmt nicht. Es gibt keine Rundenzahl, jede
  Runde hat ihren eigenen Buchstaben. Die echten Einstellungen nennen
  (Zeitlimit, Kommentator-Modus, Flammen, Letzter-Buchstabe-Modus, gesperrte
  Buchstaben) und den Solo-Modus.
- `CLAUDE.md`: `cmd/loadtest` in der Backend-Übersicht ergänzen.

## 15. Render-Tests für die React-Screens (TEST-1)

Nur `answerValidation.test.ts` und `serverEvents.test.ts`; kein Test rendert
eine Komponente. A11Y-1 und UX-2 sitzen genau in dieser Schicht.

- happy-dom-Preload + Testing Library; abdecken: Host- vs. Nicht-Host-Aktionen
  pro Screen, das Buzz-Gate, das Mapping State -> Screen in `Room`.
