# TODO

Stand 2026-10-22. Alle alten Punkte (SEC-1, UX-1/2, A11Y-1/2, CI-1, CONC-1,
DOC-2, TEST-1, Kompression, Ping, Deadline, zod/mini) sind erledigt. Die
Punkte unten stammen aus einer Messreihe gegen slf.coprime.tech und gegen
einen lokalen Nachbau (`/tmp/slfperf`: Perf-Client mit Szenarien fanout, hol,
freeze, bytes, late, join, comm; netns mit MTU 1500 für realistische
TCP-Puffer). Sortiert nach Wirkung.

Ausgangslage: bei moderater Last ist der Server unkritisch (live 20 Lobbys x
10 Spieler avg 30 ms bei 22 ms RTT, RSS 5 MB). Die Probleme sind Blockaden
durch einzelne langsame Clients, verlorene Eingaben und O(n²)-Broadcasts.
Binary statt JSON lohnt **nicht**: eine Runde mit 8 Spielern sind 28 KB JSON
bzw. 9 KB deflated pro Spieler.

---

## PERF-1. Alter Build nach Deploy bleibt hängen

Live nachgewiesen: Browser lief mit `index-LYMNjlTT.js`, live ausgeliefert wird
`index-B9n0T5HE.js`. `reloadIfUpdated` (`lib/ws.ts`) erkennt den neuen Build,
aber `location.reload()` revalidiert `index.html` und bekommt **304**:
`spaHandler` (`cmd/server/main.go`) nutzt `http.ServeFile`, und im Nix-Store
ist jede mtime 1970-01-01, also ist `Last-Modified` nach jedem Deploy gleich.
Zusätzlich liefert ein fehlendes `/assets/*.js` `200 text/html` (SPA-Fallback)
statt 404, der alte Chunk-Import scheitert dann mit MIME-Fehler.

**Fix:** `index.html` mit `Cache-Control: no-cache` und einem `ETag` aus dem
Inhaltshash (beim Start einmal berechnen) ausliefern, `Last-Modified`
weglassen. Unter `/assets/` kein SPA-Fallback, sondern 404.

## PERF-2. Globaler Hub-Lock während eines Socket-Writes

`sendCurrentGameStateTo` (`game_handlers.go`) ruft `c.sendV` mit gehaltenem
`hub.mu`. Ein langsamer Mid-Game-Joiner (commentatorState 78 KB bei 50
Spielern x 100 Kategorien) blockiert damit **alle** Lobbys. Gemessen im netns
(MTU 1500): ein gestauter Joiner fror eine unbeteiligte Lobby ein, deren max
Latenz 14,99 s (= `writeTimeout`).

**Fix:** Payload unter dem Lock bauen und marshallen, Write nach dem Unlock.
Grundsätzlich gelöst durch PERF-3.

## PERF-3. Sequenzielles `writeAll` mit 15 s Timeout (Head-of-Line)

`writeAll` (`game_util.go`) schreibt nacheinander, jeder Write darf 15 s
blockieren. 1 toter Client (TCP-Puffer voll) verzögerte den Broadcast an alle
gesunden Spieler um 14,955 s.

**Fix:** pro Client ein gepufferter Outbound-Channel (z. B. 64 Nachrichten)
und eine Writer-Goroutine; `writeAll` macht nur nicht-blockierende Sends. Ist
die Queue voll, den Client schließen (er reconnectet und bekommt den
Snapshot). Snapshots (`lobbyState`, `commentatorState`) in der Queue
zusammenfassen: nur der neueste zählt. Damit gibt es nirgends mehr I/O unter
`hub.mu`.

## PERF-4. Letzte Tastendrücke gehen am Rundenende verloren

`handleAnswerUpdate` verwirft Updates, sobald die Lobby nicht mehr
`StatePlaying` ist. Der Client debounced 250 ms (`flushAnswers` in
`GameScreen.tsx`). Nachgewiesen: ein `answerUpdate` 30 ms nach dem Buzz fehlte
in der Bewertung. Wer bis zur letzten Sekunde tippt oder beim Buzz anderer
noch schreibt, verliert die letzten bis zu 250 ms + RTT.

**Fix:** Server nimmt `answerUpdate` noch ~500 ms nach Rundenende an (Grace
nach `endRound`, bevor Review/Scoring die Antworten einfriert). Client flusht
sofort ohne Debounce, wenn `endsAt` erreicht ist oder ein `roundEnded`/Buzz
eintrifft.

## PERF-5. Stiller Antwortverlust bei halb-offenem Socket

Nur im Code nachgewiesen. Der Server pingt alle 25 s, der Client hat keinen
eigenen Heartbeat: ein half-open Socket (Mobilfunk-NAT, WLAN-Wechsel) bleibt
auf dem Client `OPEN`, Antworten landen im Nichts. Nach dem Reconnect sendet
`GameScreen` kein `inputSync`, weil der Effekt nur einmal pro `roundId` läuft
(`loadedRound.current === roundId`).

**Fix:** App-Level-Ping vom Client (alle 10 s, Antwort binnen 3 s, sonst
Socket schließen und den bestehenden Reconnect-Pfad nehmen). Bei jedem
`sessionCreated` während `Playing` alle aktuellen Antworten per `inputSync`
neu senden.

## PERF-6. Kommentator-Board ist O(n²)

`notifyCommentator` baut bei **jedem** `answerUpdate` den kompletten
`buildCommentatorState` und schickt ihn. Gemessen: 20 Spieler -> 80 msg/s,
316 KB/s; 40 Spieler -> 160 msg/s, 1,25 MB/s an den Kommentator.

**Fix:** pro Lobby auf ~4 Hz drosseln (dirty-Flag + Timer, nur letzter Stand
geht raus) und nur geänderte Zellen als Delta schicken
(`commentatorUpdate {playerId, category, answer}`); Vollstand nur beim
Einstieg/Reconnect.

## PERF-7. Kompression pro Empfänger statt pro Broadcast

`prepareBroadcast` marshallt einmal, aber `coder/websocket` deflated jede
Nachricht pro Verbindung neu. Lokal 3 Lobbys x 150 Spieler: CPU 382 vs 133
Ticks mit/ohne Kompression, avg 19 vs 11 ms. 20 x 200: avg 95 ms, max 315 ms.
Prod hat 2 vCPU.

**Fix:** einmal pro Broadcast komprimieren. `coder/websocket` 1.8.15 kann das
nicht; `gorilla/websocket` mit `PreparedMessage` schon. Wenn kein Library-Wechsel:
`CompressionThreshold` auf ~1 KB heben, damit kleine Events (die Mehrheit)
roh gehen, und die Payloads per PERF-8 verkleinern.

## PERF-8. Vollständige Snapshots bei jeder Änderung

`broadcastLobbyState` (`hub.go`) schickt bei jedem Join/Leave/Ready alle
Spieler + Kategorien an alle. Join-Sturm: 30 Spieler -> 465 Nachrichten,
1,2 MB JSON; 100 -> 39,7 MB; 200 -> 308 MB JSON und 2,2 CPU-s. Pro Runde geht
`lobbyState` zusätzlich 4x raus (~21 % der Bytes einer Runde), obwohl
`gameState` den Stand schon trägt.

**Fix:** Delta-Events `playerJoined` / `playerLeft` / `playerUpdated`,
Vollstand nur beim Einstieg/Reconnect. Kein `lobbyState` bei Phasenwechseln,
die bereits ein `gameState` senden. Die Zod-Schemas in `serverEvents.ts`
entsprechend ergänzen.

## PERF-9. Initial-Bundle

Main-Chunk 352 KB roh / 95 KB br: react-dom 51 %, TanStack Router 23 %
(80 KB für 2 Routen), tailwind-merge 8 %, zod/mini 4,9 %, eigener Code 7,6 %.
Room-Chunk 62 KB / 16 KB br.

**Fix:** TanStack Router durch einen kleinen `pathname`-Switch mit
`history.pushState` ersetzen (-~20 KB br). `tailwind-merge` raus, `cn` nur
noch als `clsx`-Join (Klassenkonflikte in den UI-Bausteinen von Hand
auflösen). Extravagant: Preact/compat statt react-dom (-~40 KB br), braucht
einen Test der Base-UI-Komponenten.

## PERF-10. Verbindungs-Wasserfall beim Laden

Der WebSocket baut eine eigene HTTP/1.1-Verbindung auf (58 ms statt 21 ms
über die bestehende H2-Verbindung) und startet erst, nachdem das Bundle
ausgeführt wurde. Reload in einer Lobby: Room-Chunk wird erst bei 191 ms
angefordert, fertig bei 249 ms.

**Fix:** `ws.connect()` auf Modul-Top-Level in `main.tsx` anstoßen, vor dem
ersten Render. Ist eine `sessionId` im `localStorage`, sofort
`import("./pages/Room")` starten. `preloadRoom` in `Home.tsx` zusätzlich auf
`touchstart`. Optional `<link rel="modulepreload">` für den Room-Chunk per
Vite-Plugin in `index.html`.

---

## Kleinkram

- **LOADTEST-1:** `cmd/loadtest` meldet unsinnige avg/max (z. B.
  44816457 ms): Join-Broadcasts, die noch unterwegs sind, werden als Antwort
  gezählt, und `startNanos` hat einen Race. Nur Antworten mit passender
  Request-ID messen, `startNanos` atomar setzen.
- **NET-1:** `net.ipv4.tcp_slow_start_after_idle = 0` in
  `server-config/configuration.nix` (`boot.kernel.sysctl`). Sonst fällt das
  cwnd nach jeder Pause in der Lobby/Bewertung zurück, und der nächste große
  Snapshot braucht wieder mehrere RTTs.
- **NET-2:** nginx liefert `/assets/` direkt aus dem Store
  (`root` + `gzip_static`/`brotli_static`, `expires max`) statt über Go;
  zusätzlich HTTP/3 (`quic` + `Alt-Svc`) im slf-vhost für schnellere
  Handshakes auf Mobilfunk.

---

# UI-Durchgang

Stand 2026-10-22. Alle Spielzustände live auf slf.coprime.tech durchgespielt
(Playwright 390 px und 1280 px, Bots per WebSocket als Mit-/Gegenspieler und
als Host). Ziel: alles Sichtbare hat direkten Nutzen, nichts ist nur Füllung.
Sortiert nach Wirkung. Nicht geprüft: Reconnect-Badge, Kick aus Sicht des
Gekickten, QR-Scanner, Dark Mode, viele Spieler/Kategorien.

## UI-1. Buchstaben-Raster im Rundenergebnis

`LetterOverview` in `RoundResultScreen.tsx` ist der größte Block und sagt
nur, welcher Buchstabe gespielt wurde. Eine Rundennummer gibt es nirgends.

**Fix:** Raster entfernen, stattdessen eine Zeile „Runde 2 · T“ über dem
Zwischenstand.

## UI-2. Lobby aus Spielersicht voller Standardwerte

Nicht-Hosts sehen 4x „Nein“, alle 26 aktiven Buchstaben plus „Aktive
Buchstaben für dieses Spiel.“ „Warte auf den Host…“ steht erst nach dem
Scrollen ganz unten.

**Fix:** Einstellungen für Nicht-Hosts als eine Zeile nur mit Abweichungen
vom Standard („60 s · Flammen · ohne Q X Y“), nichts wenn alles Standard ist.
„Warte auf den Host…“ fest am unteren Rand (wie UI-5).

## UI-3. Gültig/Ungültig in der Bewertung uneinheitlich

`SoloReviewScreen` nutzt Ja/Nein, `ReviewScreen` einen Icon-Knopf, der die
Aktion statt des Zustands zeigt (✕ auf gültigen, ✓ auf ungültigen Antworten).
Der Knopf hat nur `title`, kein `aria-label`.

**Fix:** In beiden Bewertungen schaltet ein Tipp auf die ganze Zeile die
Gültigkeit um (`role="switch"` + `aria-checked`), durchgestrichen = ungültig.
Icon-Knopf und Ja/Nein entfallen.

## UI-4. Punkte in der Bewertung unbegründet

Eine verlorene Flamme gibt 0 Punkte, die gleiche Antwort ohne Flamme 5; eine
Antwort mit falschem Buchstaben ist automatisch ungültig. Beides ohne Grund.

**Fix:** kurzer Grund in der Zeile unter der Antwort: „Flamme verloren“,
„Flamme +5“, „beginnt nicht mit T“ / „endet nicht auf S“.

## UI-5. „Spiel starten“ nur nach Scrollen erreichbar

Der Knopf liegt unter dem Buchstaben-Raster, auf dem Handy und auf dem
Desktop (1280x800) außerhalb des Viewports. Das Raster (26 Knöpfe + „26 von
26 aktiv“) braucht kaum jemand.

**Fix:** „Spiel starten“ `sticky bottom-0` in `Lobby.tsx`. Buchstaben-Raster
hinter einer zugeklappten Zeile „Buchstaben: alle ▸“ (bzw. „ohne Q X Y ▸“).

## UI-6. Lobby: Code-Karte

„Klicken oder Strg+C zum Kopieren“ ist auf dem Handy sinnlos und doppelt zu
„Link kopieren“.

**Fix:** Hinweistext entfernen. „Link kopieren“ nutzt `navigator.share`, wenn
vorhanden, sonst Clipboard.

## UI-7. Lobby: Spielerliste

Host steht unten (alphabetisch). Getrennte Spieler sind nur am grauen Punkt
erkennbar.

**Fix:** sortieren: du, Host, Rest alphabetisch. Getrennte Spieler mit
Text „offline“ statt nur grauem Punkt.

## UI-8. Desktop: eine 1000 px breite Spalte

Alle Screens sind einspaltig auf `max-w-5xl` gestreckt, die Lobby braucht
Scrollen.

**Fix:** Lobby ab `lg` zweispaltig (links Code + Spieler, rechts Kategorien
+ Einstellungen). Übrige Screens auf `max-w-xl` begrenzen.

## UI-9. Spielrunde: doppelte Fortschrittsanzeige

Fortschrittsbalken und „2/3“ wiederholen die Häkchen in den Feldern.

**Fix:** Balken und Zähler in `GameScreen.tsx` entfernen.

## UI-10. Spielrunde: Timer ohne Zeitlimit

Ohne Limit zählt „0:41“ hoch, mit Limit „51s“ herunter. Der hochzählende
Timer hat keinen Nutzen.

**Fix:** Timer nur bei Zeitlimit anzeigen, einheitlich „0:51“.

## UI-11. Spielrunde: ungültige Antwort nicht am Feld markiert

„Xyz“ bei Buchstabe P hat kein Kennzeichen am Feld; nur unter dem gesperrten
STOPP-Knopf steht „„Fluss" muss mit P beginnen.“

**Fix:** Feld mit `aria-invalid` und rotem Rand markieren, den Hinweis
direkt unter das Feld setzen.

## UI-12. Solo: zwei Knöpfe für dasselbe

Solo zeigt „STOPP - Fertig!“ und „Runde beenden“; der Bestätigungsdialog von
„Runde beenden“ sagt „für alle“.

**Fix:** im Solo-Modus nur „STOPP - Fertig!“, ohne Füllpflicht (beendet die
Runde auch mit leeren Feldern), „Runde beenden“ ausblenden.

## UI-13. Flammen-Knopf unerklärt

Kein `aria-label`, Erklärung nur in der Lobby-Hilfe, `title` geht auf dem
Handy nicht.

**Fix:** `aria-label="Flamme setzen"`, beim ersten Spiel mit Flammen eine
einmalige Zeile über den Feldern: „🔥 Wette: einzige Antwort +5, sonst 0“
(per `localStorage` gemerkt).

## UI-14. „Letzter Buchstabe“ kaum sichtbar

Spielrunde zeigt nur ein winziges „AM ENDE“ über dem Buchstaben; Countdown
und Bewertung gar nichts.

**Fix:** überall „endet auf S“ in normaler Textgröße neben dem Buchstaben
(Countdown, Spielrunde, Bewertung).

## UI-15. Countdown: Buchstabe kleiner als die Zahl

Mit „Buchstabe während Countdown“ steht der Buchstabe klein unter der Zahl.

**Fix:** Buchstabe groß, Countdown-Zahl klein darunter.

## UI-16. Mitten im Spiel beigetreten

Titel „Gleich dabei“ ohne Erklärung.

**Fix:** Satz unter dem Titel: „Du spielst ab der nächsten Runde mit.“

## UI-17. Kommentator-Tabelle: Spalte „Fertig“

„x/3“ wiederholt die Häkchen; vollständige Zeilen sind schon grün.

**Fix:** Spalte in `CommentatorBoard.tsx` entfernen.

## UI-18. Zusammenführen überall

„Zusammenführen“ steht an jeder Zeile, auch bei nur einer Antwort. Der
Hinweis sagt „mit ‚Anna‘“ statt der Antwort „Tahn“ und steht unter der
Liste.

**Fix:** Knopf nur bei mindestens 2 verschiedenen gültigen Antworten. Hinweis
in die ausgewählte Zeile: „Antwort antippen, die gleich ‚Tahn‘ ist“.

## UI-19. Grund für das Rundenende nur bei STOPP

„Leo hat gestoppt“ erscheint, bei abgelaufener Zeit oder Host-Abbruch nichts.

**Fix:** gleicher Hinweis für alle 3 Fälle: „Zeit abgelaufen“, „Host hat die
Runde beendet“, „X hat gestoppt“ (Server liefert den Grund in
`reviewState`, analog `buzzedBy`).

## UI-20. Leere Runde ohne Erklärung

Ohne Antworten springt die Runde direkt ins Rundenergebnis.

**Fix:** Zeile im Rundenergebnis: „Niemand hat etwas eingetragen.“

## UI-21. Pokale bei 0 Punkten

Bei Gleichstand mit 0 sind alle „1.“ mit Pokal (Zwischenstand und
Endstand).

**Fix:** Pokal nur bei mehr als 0 Punkten.

## UI-22. Host-getrennt-Banner überdeckt den Header

`HostGraceBanner` ist `fixed top-0` und liegt über Titel und „Verlassen“.

**Fix:** Banner im Fluss unter `RoomHeader` statt `fixed`.

## UI-23. Platzhalter beim Beitreten

„ASKZF6“ sieht aus wie ein bereits eingetragener Code.

**Fix:** Platzhalter „6-stelliger Code“ in `Home.tsx`.
