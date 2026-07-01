# Stadt Land Fluss — Multiplayer

Eine Echtzeit-Multiplayer-Version des Klassikers **Stadt Land Fluss**. Ein
Go-Backend und ein React-Frontend kommunizieren ausschließlich über WebSockets;
der Server ist die einzige Wahrheitsquelle, es gibt keine Datenbank – der
gesamte Spielzustand liegt im RAM.

## Features

- **Lobbys** mit 6-stelligem Code, QR-Code und Teilen-Link zum Beitreten
- **Host-Steuerung**: Kategorien anlegen/bearbeiten, Zeitlimit, Buchstaben
  ab-/auswählen, Spieler entfernen
- **Rundenablauf**: Countdown → Antworten → Buzzern → Bewertung → Ergebnis
- **Live-Bewertung** durch den Host inkl. Zusammenführen gleicher Antworten
- **Punktevergabe** nach klassischen Regeln (siehe unten)
- **Reconnect**: Reload oder kurzer Verbindungsabbruch führt zurück ins Spiel
- Hell-/Dunkel-Theme, responsives Layout, Tastatur-Steuerung

## Tech-Stack

| Bereich   | Technologien |
|-----------|--------------|
| Backend   | Go, [`coder/websocket`](https://github.com/coder/websocket), In-Memory |
| Frontend  | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Zustand, React Router 7, Zod |
| Tooling   | Bun (Package-Manager), [air](https://github.com/air-verse/air) (Go Live-Reload), Nix (Dev-Shell) |

## Architektur

- **Server = Single Source of Truth.** Clients schicken Aktionen, der Server
  validiert, verändert den Zustand und broadcastet den neuen Stand. Kein
  Client-Vertrauen für Punkte/Regeln.
- **Zustandsautomat pro Lobby:**
  `Lobby → Countdown → Playing → Reviewing → RoundResult → GameOver → Lobby`
- **Nachrichtenformat** (JSON über `/ws`):
  - Client → Server: `{ "type": ..., "payload": ..., "sessionId": ... }`
  - Server → Client: `{ "type": ..., "payload": ... }`
- **Session/Reconnect:** Die `sessionId` liegt bewusst in `sessionStorage`
  (pro Tab, übersteht Reload) statt `localStorage`, damit sich mehrere Tabs
  desselben Browsers als verschiedene Spieler verbinden können.

### Punktevergabe (pro Kategorie)

| Punkte | Bedingung |
|-------:|-----------|
| 0  | ungültig oder leer |
| 5  | gültig, aber dieselbe Antwort wie ein anderer Spieler |
| 10 | gültige, eindeutige Antwort |
| 20 | einzige gültige Antwort der Kategorie |

Der Host kann während der Bewertung Antworten als gültig/ungültig markieren und
sinngleiche Antworten zusammenführen (zählen dann als eine Gruppe).

## Projektstruktur

```
backend/
  cmd/server/        Einstiegspunkt (HTTP-Server + /ws)
  internal/game/     Domänenlogik: Modelle, Engine (Buchstaben, Regeln, Scoring)
  internal/websocket/ Hub, Clients, Message-Handler, Broadcasts
frontend/
  src/pages/         Home, Lobby und Spielscreens (game/)
  src/components/     UI-Bausteine (inkl. ui/ = shadcn)
  src/store/         Zustand-Stores (lobby, game)
  src/lib/           WebSocket-Client, Theme, Session, Validierung
  src/types/         Gemeinsame Event-/Payload-Typen
srs/                 Spezifikation (Anforderungen, Events, Zustände)
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
# Backend-Tests
cd backend && go test ./...

# Frontend: Typecheck + Production-Build
cd frontend && bun run build
```

## Spezifikation

Detaillierte Anforderungen, WebSocket-Events, Zustände und Fehlerbehandlung
liegen im Ordner [`srs/`](./srs).
