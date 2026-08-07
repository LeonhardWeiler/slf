# Performance auf schlechten Netzen (EDGE / 3G)

Gemessen am 2026-08-07 gegen den laufenden Server. Ausgangslage: die
Serialisierung ist **nicht** das Problem (JSON-Marshalling = 0,6 % der
Roundtrip-Latenz, Loadtest mit 500 Spielern: avg 2,27 ms). Der Schmerz auf
schmalen Leitungen kommt aus drei Ecken: unkomprimierte Bytes, zu harte
Timeouts und stille Verbindungsabbrüche.

Punkte 1 und 2 zusammen senken den Kaltstart um ~70 % und den laufenden
Traffic um 68-91 %, ohne eine Zeile Spiellogik anzufassen. Reihenfolge ist
nach Wirkung/Aufwand sortiert.

---

## 1. HTTP-Kompression für die statischen Assets

Der Server liefert die Assets **roh** aus, obwohl der Browser gzip/br anbietet:

```
curl -H "Accept-Encoding: gzip, br, zstd" .../assets/index-*.js
-> Content-Length: 401816, kein Content-Encoding
```

Grund: `spaHandler` in `cmd/server/main.go` benutzt `http.FileServer`, und der
komprimiert nicht. Beim Kaltstart gehen dadurch 445 KB statt ~133 KB über die
Leitung - bei EDGE (~12,5 KB/s) sind das **36 s statt 10 s** bis zum ersten
Bild.

- Assets zur Buildzeit vorkomprimieren (`.br` + `.gz` im Dockerfile, Stage 1
  nach `bun run build`) statt on-the-fly - dann kann die maximale
  Brotli-Stufe gefahren werden, ohne CPU pro Request zu zahlen.
- `spaHandler` erweitern: bei passendem `Accept-Encoding` die vorkomprimierte
  Variante ausliefern, sonst das Original.
- `Content-Encoding` **und** `Vary: Accept-Encoding` setzen. Das bestehende
  `Cache-Control: immutable` für `/assets/` bleibt korrekt.
- Auch `index.html` abdecken (klein, aber auf dem kritischen Pfad).

---

## 2. WebSocket-Kompression (permessage-deflate) aktivieren

`coder/websocket` hat `CompressionDisabled` als Default, und der Code setzt nie
einen anderen Modus. Gemessene Deflate-Raten auf den echten Payloads:

| Payload                    | roh     | deflate        |
| -------------------------- | ------- | -------------- |
| typisch (6 Spieler/3 Kat.) | 1096 B  | 353 B (-68 %)  |
| 25 Spieler                 | 3273 B  | 520 B (-84 %)  |
| Cap (200 Spieler/100 Kat.) | 27162 B | 2352 B (-91 %) |

- `CompressionMode` in den `AcceptOptions` in `internal/websocket/client.go`
  (`ServeWS`) setzen.
- **`CompressionNoContextTakeover` nehmen, nicht ContextTakeover.** Letzteres
  kostet laut Bibliothek ~1,2 MB `flate.Writer` pro Verbindung - bei 500
  Spielern also ~600 MB. Die Lib warnt ausdrücklich davor, das ungemessen zu
  aktivieren.
- Danach mit `go run ./cmd/loadtest -players 500` gegenmessen: Latenz darf
  sich nicht verschlechtern, Speicher im Blick behalten.

---

## 3. `writeTimeout` von 5 s ist für Mobilfunk zu knapp

`writeRaw` (`internal/websocket/client.go`) schließt die Verbindung, wenn ein
Write nicht in 5 s durchgeht. Rechnung für eine große Lobby über EDGE:
27 KB / 12,5 KB/s = 2,2 s Übertragung + Radio-Promotion (idle -> aktiv, 1-2 s)

- RTT + Retransmits. Das reißt - und der Spieler fliegt raus, reconnectet,
  bekommt denselben großen State und kann in einer Schleife landen.

* Timeout auf 15-20 s anheben. "Langsam" ist bei Mobilfunk kein Fehler.
* Bei kleinen Lobbys (6 Spieler, ~1 KB) war das nie ein Thema; das Risiko
  skaliert mit der Spielerzahl. Punkt 2 entschärft es zusätzlich fast
  vollständig.

---

## 4. Heartbeat gegen halb-tote Verbindungen

Es gibt keinen Ping/Pong-Keepalive, und `coder/websocket` pingt nicht von
selbst. Mobilfunk-NAT räumt stille Verbindungen weg - in der Lobby- oder
Bewertungsphase fließt minutenlang kein Traffic. Der Client merkt davon
nichts: `ensureConnected` in `lib/ws.ts` prüft nur
`readyState === WebSocket.OPEN`, und genau das bleibt bei einer half-open
connection stehen. Der Spieler erfährt es erst, wenn er buzzert und nichts
passiert.

- Server-seitig alle ~25 s `conn.Ping(ctx)` mit Deadline; scheitert der Ping,
  Verbindung schließen und `onDisconnect` normal laufen lassen.
- Damit greift auch der bestehende Reconnect-Pfad (Backoff + Jitter) wieder,
  statt dass der Client eine tote Verbindung für lebendig hält.

---

## 5. Initial-Bundle verkleinern (erst nach Punkt 1)

Sourcemap-Analyse des Initial-Chunks (401 KB roh):

```
174.1 KB  44.7%  react-dom
 64.8 KB  16.6%  zod            <- nur wegen serverEvents.ts im Initial-Chunk
 54.6 KB  14.0%  @tanstack/router-core
 26.5 KB   6.8%  tailwind-merge
 25.8 KB   6.6%  (eigener Code)
  2.6 KB   0.7%  lucide-react   <- Tree-Shaking greift, alles gut
```

- **Zod aus dem Initial-Chunk holen** (~18 KB gzip): Es hängt nur drin, weil
  `lib/ws.ts` sofort `parseServerEvent` braucht. Entweder die 13
  Event-Schemas in `lib/serverEvents.ts` durch handgeschriebene Validatoren
  ersetzen, oder auf `zod/mini` wechseln. Dann wandert Zod (das
  `answerValidation.ts` weiter nutzt) komplett in den Room-Chunk.
  Achtung: die Zod-Validierung ist eine dokumentierte Invariante
  (CLAUDE.md, SRS 13.5.3) - sie muss erhalten bleiben, nur die Umsetzung
  ändert sich.
- `tailwind-merge` (~7 KB gzip) wäre der nächste Kandidat, aber mit Risiko
  von Styling-Regressionen - nur angehen, wenn Punkt 1+2 nicht reichen.

---

## 6. Gefühlte Geschwindigkeit bei hoher Latenz

Bei 1 s RTT oft wichtiger als die Bytes:

- **Buzz-Feedback:** Der Button in `GameScreen.tsx` wartet stumm auf die
  Serverantwort. Ein sofortiger Pending-Zustand (Spinner / gedrückter Button)
  kostet nichts und ändert die Server-Autorität nicht.
- **Timer-Drift:** `timeRemaining` kommt in ganzen Sekunden, der Client tickt
  lokal weiter - bei 1 s RTT hinkt er dauerhaft ~1 s hinterher. Spürbar bei
  der roten 5-Sekunden-Zone (`dangerZone`) und unfair, wenn Sekunden zählen.
  Lösung: RTT/2-Kompensation oder absolute Deadline + Clock-Offset-Schätzung
  in `buildGameState`.
- Die 8-s-Timeouts in `Home.tsx` (`armTimeout`, `checkCode`) sind bei EDGE
  plus Radio-Promotion grenzwertig knapp - auf 15 s heben.
