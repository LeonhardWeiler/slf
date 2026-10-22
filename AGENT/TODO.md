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
