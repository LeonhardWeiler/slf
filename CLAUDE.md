# CLAUDE.md

Stadt-Land-Fluss — Echtzeit-Multiplayer im Browser. Go-WebSocket-Backend
(server-autoritativ) + React-SPA-Frontend. Details in der `README.md`.

## Stack

- **Backend:** Go, WebSocket (`coder/websocket`), In-Memory-State (kein Persistenz-Layer).
- **Frontend:** React 19, Vite, TypeScript (`strict`), Tailwind CSS 4, shadcn/ui
  (Radix + CVA + `cn`), Zustand, React Router 7, Zod.
- **Package-Manager: Bun** (nicht npm/yarn; `npx` ist **nicht** verfügbar).
- Lint: Biome. Frontend-Tests: Vitest. Backend-Tests: `go test`.

## Befehle

Immer im jeweiligen Unterordner ausführen:

```bash
# Backend (in backend/)
gofmt -l .            # muss leer sein (Format-Gate)
go vet ./...
go test ./...         # bei Nebenläufigkeit: go test ./... -race

# Frontend (in frontend/)
bun install
bun run lint          # Biome
bun run test          # Vitest
bun run build         # tsc -b && vite build (typecheckt + baut)
bun dev               # Dev-Server
```

Vor jedem Commit die passenden Checks grün machen. Es gibt keine `npx`; nutze
`bun run <script>` oder die Binaries in `frontend/node_modules/.bin/`.
Die CI (`.gitlab-ci.yml`) läuft auf `oven/bun` **ohne node** — Vitest läuft dort
unter der Bun-Runtime. Deshalb ist `zod` in `frontend/vite.config.ts`
(`test.server.deps.inline`) inlined; sonst schlägt der zod-Import fehl. Cold prüfen
lässt sich das lokal mit `bun --bun run test` (erzwingt die Bun-Runtime).

## Konventionen

- **Direkt auf `master` committen** (Solo-Projekt); nicht ohne Aufforderung branchen.
- Ein Commit pro logischer Änderung, aussagekräftige Message.
- Server ist Single Source of Truth: Regeln/Scoring/State nur serverseitig; jede
  eingehende Nachricht wird per Zod validiert (`frontend/src/lib/serverEvents.ts`).
- `frontend/src/lib/answerValidation.ts` **spiegelt** die Backend-Engine-Regeln
  (`backend/internal/game/engine.go`) — bei Änderungen beide synchron halten
  (Vitest deckt das ab).

## Architektur (Kurz)

- Zustandsautomat pro Lobby: `Lobby → Countdown → Playing → Reviewing →
  RoundResult → GameOver → Lobby`.
- Nachrichten: JSON über `/ws`, Client→Server `{type, payload, sessionId}`,
  Server→Client `{type, payload, stateVersion}`.
- Backend: `cmd/server` (Einstieg + Security-Header/SPA-Serving),
  `internal/game` (Engine/State), `internal/websocket` (Hub, Handler).
- `sessionId` liegt in `sessionStorage` (pro Tab, übersteht Reload).

## prompts/

`project-health-report.html` = laufender Health-Report, `TODO.md` = Arbeitsliste.
Gepflegt über die Skills `/review-and-update-report` und `/implement-todo`.
