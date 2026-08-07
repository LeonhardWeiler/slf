# CLAUDE.md

Stadt Land Fluss, real-time multiplayer in the browser. Go WebSocket backend
(server-authoritative) + React SPA frontend. Details in the `README.md`.

## Stack

- **Backend:** Go, WebSocket (`coder/websocket`), in-memory state (no persistence layer).
- **Frontend:** React 19, Vite, TypeScript (`strict`), Tailwind CSS 4, UI building
  blocks in the shadcn style on top of **Base UI** (`@base-ui-components/react` + CVA + `cn`),
  Zustand, TanStack Router (code-based, `src/router.tsx`), Zod.
- **Package manager: Bun** (not npm/yarn; `npx` is **not** available).
- Lint: Biome. Frontend tests: `bun test`. Backend tests: `go test`.

## Commands

Always run inside the respective subfolder:

```bash
# Backend (in backend/)
gofmt -l .            # must be empty (format gate)
go vet ./...
go test ./...         # for concurrency: go test ./... -race

# Frontend (in frontend/)
bun install
bun run lint          # Biome
bun run test          # bun test (native runner)
bun run build         # tsc -b && vite build (typechecks + builds)
bun dev               # dev server
```

Make the relevant checks green before every commit. There is no `npx`; use
`bun run <script>` or the binaries in `frontend/node_modules/.bin/`.
Tests run on the **native `bun test`** runner, not Vitest — `vite.config.ts`
is therefore build-only and holds no test config. Test files import
`describe/expect/it` from `bun:test`; the `@/*` alias comes from tsconfig
`paths`, which bun reads natively. Ambient test types come from `@types/bun`
(listed in tsconfig `types`, which is explicit and thus opt-in).
Consequence for new tests: there is no Vite transform pipeline, so plain
logic tests are frictionless, while React component tests would need a
happy-dom preload and cannot rely on Vite-only features (`import.meta.env`,
CSS imports).

## Conventions

- **Commit directly to `master`** (solo project); do not branch without being asked.
- One commit per logical change, with a meaningful message.
- The server is the single source of truth: rules/scoring/state live only on the
  server; every incoming message is validated with Zod (`frontend/src/lib/serverEvents.ts`).
- `frontend/src/lib/answerValidation.ts` **mirrors** the backend engine rules
  (`backend/internal/game/engine.go`); keep both in sync when changing either one
  (`bun test` covers this).

## Architecture (brief)

- State machine per lobby: `Lobby -> Countdown -> Playing -> Reviewing ->
RoundResult -> GameOver -> Lobby`. Two shortcuts: an **empty round** (no active,
  non-left player submitted anything) skips `Reviewing` and goes
  `Playing -> RoundResult` directly; and `beginCountdown` falls back to `Lobby`
  instead of starting a round when the lobby has **no connected participant**.
- Messages: JSON over `/ws`, client->server `{type, payload, sessionId}`,
  server->client `{type, payload, stateVersion}`.
- Backend: `cmd/server` (entry point + security headers/SPA serving),
  `internal/game` (engine/state), `internal/websocket` (hub, handlers).
- `sessionId` lives in `localStorage` (per browser, survives closing the tab ->
  auto-reconnect as the same player; an explicit "leave" clears it).
- Joining is possible in **any** lobby state; whoever joins mid-game is
  `Pending` (spectator, not in scoring/ranking/review) and is activated at the
  next round start (`beginCountdown`). On the server, `isRoundSpectator`
  (commentator host **or** pending) encapsulates the exclusion.

## AGENT/

`project-health-report.html` = running health report, `TODO.md` = work list.
Maintained through the `/review-and-update-report` and `/implement-todo` skills.
