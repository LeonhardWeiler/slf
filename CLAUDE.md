# CLAUDE.md

Stadt Land Fluss, real-time multiplayer in the browser. Go WebSocket backend
(server-authoritative) + React SPA frontend. Details in the `README.md`.

## Stack

- **Backend:** Go, WebSocket (`coder/websocket`), in-memory state (no persistence layer).
- **Frontend:** React 19, Vite, TypeScript (`strict`), Tailwind CSS 4, UI building
  blocks in the shadcn style on top of **Base UI** (`@base-ui-components/react` + CVA + `cn`),
  Zustand, TanStack Router (code-based, `src/router.tsx`), Zod.
- **Package manager: Bun** (not npm/yarn; `npx` is **not** available).
- Lint: Biome. Frontend tests: Vitest. Backend tests: `go test`.

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
bun run test          # Vitest
bun run build         # tsc -b && vite build (typechecks + builds)
bun dev               # dev server
```

Make the relevant checks green before every commit. There is no `npx`; use
`bun run <script>` or the binaries in `frontend/node_modules/.bin/`.
The CI (`.gitlab-ci.yml`) runs on `oven/bun` **without node**, so Vitest runs there
under the Bun runtime. That is why `zod` is inlined in `frontend/vite.config.ts`
(`test.server.deps.inline`); otherwise the zod import fails. You can check this
locally with `bun --bun run test` (forces the Bun runtime).

## Conventions

- **Commit directly to `master`** (solo project); do not branch without being asked.
- One commit per logical change, with a meaningful message.
- The server is the single source of truth: rules/scoring/state live only on the
  server; every incoming message is validated with Zod (`frontend/src/lib/serverEvents.ts`).
- `frontend/src/lib/answerValidation.ts` **mirrors** the backend engine rules
  (`backend/internal/game/engine.go`); keep both in sync when changing either one
  (Vitest covers this).

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
