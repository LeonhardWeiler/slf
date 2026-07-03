# Stadt Land Fluss — Multiplayer

Eine Echtzeit-Multiplayer-Version des Klassikers **Stadt Land Fluss**. Ein
Go-Backend und ein React-Frontend kommunizieren ausschließlich über WebSockets;
der Server ist die einzige Wahrheitsquelle, es gibt keine Datenbank – der
gesamte Spielzustand liegt im RAM.

## Features

- **Lobbys** mit 6-stelligem alphanumerischem Code, QR-Code und Teilen-Link
- **Host-Steuerung**: Kategorien anlegen/bearbeiten/löschen, Zeitlimit,
  Buchstaben ab-/auswählen, Spieler entfernen, laufende Runde beenden
- **Rundenablauf**: Countdown → Antworten → Buzzern → Bewertung → Ergebnis
- **Live-Bewertung** durch den Host inkl. Zusammenführen gleicher Antworten
- **Optionale Spielmodi** (pro Lobby schaltbar):
  - **Kommentator-Host** – der Host spielt nicht mit, sieht stattdessen eine
    Live-Übersicht, welche Kategorien jeder Spieler ausgefüllt hat
  - **Letzter statt erster Buchstabe** – Antworten müssen auf den Buchstaben
    _enden_ statt mit ihm zu beginnen
  - **Flammen** – einmal pro Runde auf „einzige Antwort" wetten (+5, siehe unten)
- **Punktevergabe** nach klassischen Regeln (siehe unten)
- **Reconnect**: Reload, Tab-Schließen oder kurzer Verbindungsabbruch führen
  zurück ins Spiel; sobald Netzwerk oder Tab wieder da sind, verbindet der Client
  sofort neu (die Session liegt in `localStorage`, siehe Architektur)
- **Jederzeit beitreten**: Man kann einer bereits laufenden Lobby beitreten. Wer
  mitten im Spiel dazukommt, wartet als Zuschauer (sieht die Ausfüll-Übersicht,
  taucht noch nicht in der Tabelle auf) und spielt ab der nächsten Runde mit
- **Host-Disconnect-Schutz**: Verliert der Host die Verbindung, sehen alle
  Spieler einen 15-Sekunden-Countdown; kehrt er zurück, geht es weiter, sonst
  wird die Lobby geschlossen (SRS 4.6/8.5)
- Hell-/Dunkel-Theme, responsives Layout, Tastatur-Steuerung

## Tech-Stack

| Bereich  | Technologien                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------ |
| Backend  | Go, [`coder/websocket`](https://github.com/coder/websocket), In-Memory                           |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Zustand, React Router 7, Zod      |
| Tooling  | Bun (Package-Manager), [air](https://github.com/air-verse/air) (Go Live-Reload), Nix (Dev-Shell) |

## Architektur

- **Server = Single Source of Truth.** Clients schicken Aktionen, der Server
  validiert, verändert den Zustand und broadcastet den neuen Stand. Kein
  Client-Vertrauen für Punkte/Regeln.
- **Zustandsautomat pro Lobby:**
  `Lobby → Countdown → Playing → Reviewing → RoundResult → GameOver → Lobby`
- **Nachrichtenformat** (JSON über `/ws`):
  - Client → Server: `{ "type": ..., "payload": ..., "sessionId": ... }`
  - Server → Client: `{ "type": ..., "payload": ..., "stateVersion": ... }`
    (`stateVersion` = monotoner Lobby-Zähler zum Erkennen veralteter Snapshots)
- **Session/Reconnect:** Die `sessionId` liegt in `localStorage` und übersteht
  damit auch das Schließen des Tabs: Beim nächsten Öffnen verbindet der Client
  automatisch wieder als derselbe Spieler (gleicher Name, Punkte, Rolle) –
  sofern die Lobby noch existiert. Ein Host behält seine Rolle innerhalb des
  15-Sekunden-Grace-Fensters. Trade-off (bewusst): Alle Tabs desselben Browsers
  teilen sich eine Identität; ein zweiter Tab verbindet in dieselbe Session statt
  ein eigener Spieler zu sein. Ein explizites **„Verlassen"** löscht die
  gespeicherte `sessionId` und ist damit ein endgültiger Austritt – nur
  Tab-Schließen/Verbindungsabbruch bleibt wieder-beitretbar.

### Punktevergabe (pro Kategorie)

| Punkte | Bedingung                                             |
| -----: | ----------------------------------------------------- |
|      0 | ungültig oder leer                                    |
|      5 | gültig, aber dieselbe Antwort wie ein anderer Spieler |
|     10 | gültige, eindeutige Antwort                           |
|     20 | einzige gültige Antwort der Kategorie                 |

Der Host kann während der Bewertung Antworten als gültig/ungültig markieren und
sinngleiche Antworten zusammenführen (zählen dann als eine Gruppe).

**Flammen** (falls aktiviert): Ein Spieler kann pro Runde eine Kategorie
„flammen" – eine Wette, dort die einzige gültige Antwort zu haben. Geht die
Wette auf, gibt es **+5** Punkte (eindeutige Antwort 10 → 15, einzige gültige
20 → 25); bei geteilter oder ungültiger Antwort zählt die Kategorie **0**.

### Sicherheit

- **Server-autoritativ**: Regeln, Scoring und Zustand werden ausschließlich
  serverseitig erzwungen; eingehende Events werden validiert (Backend + Zod).
- **WebSocket-Origin-Prüfung** gegen Cross-Site-Hijacking (Same-Origin +
  localhost/LAN erlaubt, sonst 403; `WS_ALLOWED_ORIGINS` als Override).
- **Rate-Limiting** pro Verbindung, Join-Backoff und Obergrenzen für Lobbys,
  Spieler und Kategorien; verwaiste Lobbys werden automatisch abgeräumt.
- **Security-Header** (CSP, HSTS mit `preload`, COOP, u. a.) für die ausgelieferte
  SPA; content-gehashte Assets werden `immutable` gecacht, `index.html`/`robots.txt`
  revalidieren. `sessionId` wird nie an andere Clients geleakt und in Logs nur gehasht.

## Projektstruktur

```
backend/
  cmd/server/        Einstiegspunkt (HTTP-Server + /ws + optional Frontend)
  cmd/loadtest/      Last-/Latenz-Messwerkzeug (siehe „Performance")
  internal/game/     Domänenlogik: Modelle, Engine (Buchstaben, Regeln, Scoring)
  internal/websocket/ Hub, Clients, Message-Handler, Broadcasts
frontend/
  src/pages/         Home, Lobby und Spielscreens (game/)
  src/components/     UI-Bausteine (inkl. ui/ = shadcn)
  src/store/         Zustand-Stores (lobby, game)
  src/lib/           WebSocket-Client, Theme, Session, Validierung
  src/types/         Gemeinsame Event-/Payload-Typen
Dockerfile           Multi-Stage-Build → ein Image (Frontend + Go-Server)
docker-compose.yml   Start des veröffentlichten Images
.gitlab-ci.yml       CI: Tests + Image-Build/-Push nach Docker Hub
flake.nix            Nix-Dev-Shell (Go, Bun, air, …)
```

## Erste Schritte

### Voraussetzungen

- Go (siehe `backend/go.mod`) und [air](https://github.com/air-verse/air)
- [Bun](https://bun.sh)

Alternativ stellt die Nix-Flake alles bereit:

```bash
nix develop
```

### Backend starten (Port 8080)

```bash
cd backend
air                 # Live-Reload bei Dateiänderungen
# oder ohne air:
go run ./cmd/server
```

### Frontend starten (Port ab 5173)

```bash
cd frontend
bun install
bun dev
```

Danach die angezeigte URL im Browser öffnen. Für ein lokales Mehrspieler-Spiel
mehrere Tabs/Geräte im selben Netzwerk verbinden (der Join-Link/QR-Code zeigt
auf `‹host›/join/‹code›`).

## Entwicklung

```bash
# Backend: Format-Check, Vet, Tests (inkl. WS-Integrationstests)
cd backend && gofmt -l . && go vet ./... && go test ./...

# Frontend: Biome-Lint, Unit-Tests (Vitest), Typecheck + Production-Build
cd frontend && bun run lint && bun run test && bun run build
```

Dieselben Schritte laufen in der CI (`.gitlab-ci.yml`): `gofmt`-Gate + `go vet`

- `go test` fürs Backend, Biome-Lint + Vitest + Build fürs Frontend.

## Deployment mit Docker

Backend und Frontend stecken in **einem** Image (Multi-Stage-Build): Das
Frontend wird gebaut und vom Go-Server als statische Dateien zusammen mit `/ws`
auf Port `8080` ausgeliefert.

```bash
docker compose up -d        # zieht weilerleonhard/slf:latest → http://localhost:8080
docker compose up --build   # stattdessen lokal bauen (build:-Zeile in compose aktivieren)
```

Die GitLab-CI baut nach jedem Commit auf `master` das Image und pusht es nach
`weilerleonhard/slf` (Tags `latest` + Commit-SHA). Dafür müssen in GitLab unter
**Settings → CI/CD → Variables** die Variablen `DOCKERHUB_USERNAME` und
`DOCKERHUB_TOKEN` (Docker-Hub-Access-Token, „Masked") gesetzt sein.

### Konfiguration (Umgebungsvariablen)

| Variable             | Default                     | Bedeutung                                                                                                                                                                                          |
| -------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STATIC_DIR`         | –                           | Verzeichnis mit dem gebauten Frontend; leer = nur `/ws` (Dev)                                                                                                                                      |
| `LOG_LEVEL`          | `info`                      | `debug` \| `info` \| `warn` \| `error`                                                                                                                                                             |
| `LOG_FORMAT`         | `text`                      | `text` \| `json`                                                                                                                                                                                   |
| `LOG_FILE`           | –                           | zusätzlich in Datei loggen (in Docker auf dem `slf-logs`-Volume)                                                                                                                                   |
| `WS_ALLOWED_ORIGINS` | Same-Origin + localhost/LAN | Zusätzlich erlaubte WebSocket-Origins (kommagetrennt). Standardmäßig sind Same-Origin sowie localhost/private LAN-IPs erlaubt; setzen, um das Frontend von einer **anderen** Domain aus zuzulassen |

## Performance

Zwei isolierte, reproduzierbare Messungen (Ziele: Ø < 80 ms, max < 150 ms
Roundtrip, ≥ 500 gleichzeitige Spieler):

```bash
# 1) Reine Logik (ohne Netz): Scoring & Ranking
cd backend && go test -bench=. -benchmem -run=^$ ./internal/game/

# 2) End-to-End-Roundtrip unter Last (Server muss laufen)
go run ./cmd/server &
go run ./cmd/loadtest -players 500     # verbindet 500 Spieler, misst Broadcast-Latenz
```

Das Werkzeug öffnet die Spieler über viele Lobbys, lässt alle Hosts gleichzeitig
eine Zustandsänderung auslösen und misst je Client die Zeit bis zum
resultierenden `lobbyState`-Broadcast (Ø/p50/p95/p99/max).

## Bewusste Entscheidungen & bekannte Einschränkungen

Diese Punkte sind bekannt und bewusst so gewählt – sie sind **kein Problem** für
den vorgesehenen Einsatz (LAN-/Party-Spiel):

- **Ein globaler Mutex im Hub** serialisiert alle Lobbys. Für die aktuelle Skala
  unkritisch (Loadtest: 500 Spieler, Ø < 5 ms Roundtrip); ein Sharding pro Lobby
  wäre erst bei sehr vielen gleichzeitigen Spielen nötig und wurde daher bewusst
  nicht umgesetzt.
- **Clipboard-Fallback über `document.execCommand("copy")`**: Über plain-HTTP im
  LAN (typisch: Handy verbindet per lokaler IP) ist `navigator.clipboard` nicht
  verfügbar. Der Fallback nutzt das offiziell veraltete, aber weiterhin breit
  unterstützte `execCommand` – bewusst als pragmatischer Kompromiss.
- **Kein Host-Handoff**: Kehrt ein getrennter Host nicht innerhalb der 15 s
  zurück, wird die Lobby geschlossen (keine Übertragung der Host-Rolle) – für ein
  Party-Spiel gewollt einfach gehalten.
- **Kein Persistenz-Layer**: Der gesamte Zustand liegt im RAM. Nach einem
  Server-Neustart sind Lobbys weg; Clients werden sauber getrennt und kehren zur
  Startseite zurück.
