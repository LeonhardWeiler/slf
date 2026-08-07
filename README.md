# Stadt Land Fluss - Multiplayer

A real-time multiplayer version of the classic game **Stadt Land Fluss**. A Go
backend and a React frontend communicate exclusively over WebSockets; the server
is the single source of truth, there is no database, the entire game state lives
in RAM.

## Features

- **Lobbies** with a 6-character alphanumeric code, QR code and share link
- **Host controls**: create/edit/delete categories, time limit, enable/disable
  letters, remove players, end the running round
- **Round flow**: countdown -> answers -> buzzing -> review -> result
- **Live review** by the host, including merging identical answers
- **Optional game modes** (toggleable per lobby):
  - **Commentator host**: the host does not play and instead sees a live
    overview of which categories each player has filled in
  - **Last letter instead of first**: answers must _end_ with the letter instead
    of starting with it
  - **Flames**: bet once per round on being the "only answer" (+5, see below)
- **Scoring** by classic rules (see below)
- **Reconnect**: a reload, tab close or brief connection drop lead back into the
  game; as soon as the network or tab is back, the client reconnects immediately
  (the session lives in `localStorage`, see Architecture)
- **Join anytime**: you can join a lobby that is already running. Whoever joins
  mid-game waits as a spectator (sees the fill-in overview, does not yet appear
  in the table) and plays from the next round on
- **Host disconnect protection**: if the host loses the connection, all players
  see a 15-second countdown; if the host returns, the game continues, otherwise
  the lobby is closed (SRS 4.6/8.5)
- Light/dark theme, responsive layout, keyboard controls

## Tech stack

| Area     | Technologies                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------- |
| Backend  | Go, [`coder/websocket`](https://github.com/coder/websocket), in-memory                             |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, Base UI (shadcn style), Zustand, TanStack Router, Zod  |
| Tooling  | Bun (package manager), [air](https://github.com/air-verse/air) (Go live-reload), Nix (dev shell)   |

## Architecture

- **Server = single source of truth.** Clients send actions, the server
  validates them, mutates the state and broadcasts the new state. No client is
  trusted for points/rules.
- **State machine per lobby:**
  `Lobby -> Countdown -> Playing -> Reviewing -> RoundResult -> GameOver -> Lobby`
- **Message format** (JSON over `/ws`):
  - Client -> Server: `{ "type": ..., "payload": ..., "sessionId": ... }`
  - Server -> Client: `{ "type": ..., "payload": ..., "stateVersion": ... }`
    (`stateVersion` = monotonic lobby counter for detecting stale snapshots)
- **Session/reconnect:** the `sessionId` lives in `localStorage` and therefore
  survives closing the tab: on the next open the client reconnects automatically
  as the same player (same name, points, role), as long as the lobby still
  exists. A host keeps its role within the 15-second grace window. Trade-off
  (deliberate): all tabs of the same browser share one identity; a second tab
  connects into the same session instead of becoming its own player. An explicit
  **leave** is a final exit: the client clears the stored `sessionId` and the
  server invalidates the session, so a replayed id cannot bring the player back.
  Only a tab close/connection drop remains re-joinable.

### Scoring (per category)

| Points | Condition                                              |
| -----: | ------------------------------------------------------ |
|      0 | invalid or empty                                       |
|      5 | valid, but the same answer as another player           |
|     10 | valid, unique answer                                   |
|     20 | only valid answer in the category                      |

During review the host can mark answers as valid/invalid and merge answers that
mean the same thing (they then count as one group).

**Flames** (if enabled): once per round a player can "flame" a category, a bet
that they hold the only valid answer there. If the bet pays off, it gives **+5**
points (unique answer 10 -> 15, only valid 20 -> 25); with a shared or invalid
answer the category counts **0**.

### Security

- **Server-authoritative**: rules, scoring and state are enforced only on the
  server; incoming events are validated (backend + Zod).
- **WebSocket origin check** against cross-site hijacking (same-origin +
  localhost/LAN allowed, otherwise 403; `WS_ALLOWED_ORIGINS` as an override).
- **Rate limiting** per connection, join backoff and caps for lobbies, players
  and categories; orphaned lobbies are cleaned up automatically.
- **Security headers** (CSP, HSTS with `preload`, COOP, and more) for the served
  SPA; content-hashed assets are cached `immutable`, `index.html`/`robots.txt`
  revalidate. `sessionId` is never leaked to other clients and only logged hashed.

## Project structure

```
backend/
  cmd/server/        Entry point (HTTP server + /ws + optional frontend)
  cmd/loadtest/      Load/latency measurement tool (see "Performance")
  internal/game/     Domain logic: models, engine (letters, rules, scoring)
  internal/websocket/ Hub, clients, message handlers, broadcasts
frontend/
  src/pages/         Home, Lobby and game screens (game/)
  src/components/     UI building blocks (incl. ui/ = shadcn style on Base UI)
  src/store/         Zustand stores (lobby, game)
  src/lib/           WebSocket client, theme, session, validation
  src/types/         Shared event/payload types
Dockerfile           Multi-stage build -> one image (frontend + Go server)
docker-compose.yml   Starts the published image
.gitlab-ci.yml       CI: tests + image build/push to Docker Hub
flake.nix            Nix dev shell (Go, Bun, air, ...)
```

## Getting started

### Prerequisites

- Go (see `backend/go.mod`) and [air](https://github.com/air-verse/air)
- [Bun](https://bun.sh)

Alternatively the Nix flake provides everything:

```bash
nix develop
```

### Start the backend (port 8080)

```bash
cd backend
air                 # live-reload on file changes
# or without air:
go run ./cmd/server
```

### Start the frontend (port 5173 and up)

```bash
cd frontend
bun install
bun dev
```

Then open the shown URL in the browser. For a local multiplayer game, connect
several tabs/devices on the same network (the join link/QR code points to
`<host>/join/<code>`).

## Development

```bash
# Backend: format check, vet, tests (incl. WS integration tests)
cd backend && gofmt -l . && go vet ./... && go test ./...

# Frontend: Biome lint, unit tests (bun test), typecheck + production build
cd frontend && bun run lint && bun run test && bun run build
```

The same steps run in CI (`.gitlab-ci.yml`): `gofmt` gate + `go vet`

- `go test` for the backend, Biome lint + `bun test` + build for the frontend.

## Deployment with Docker

Backend and frontend sit in **one** image (multi-stage build): the frontend is
built and served by the Go server as static files together with `/ws` on port
`8080`.

```bash
docker compose up -d        # pulls weilerleonhard/slf:latest -> http://localhost:8080
docker compose up --build   # build locally instead (enable the build: line in compose)
```

The GitLab CI builds the image after every commit on `master` and pushes it to
`weilerleonhard/slf` (tags `latest` + commit SHA). For that, the variables
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (Docker Hub access token, "masked")
must be set in GitLab under **Settings -> CI/CD -> Variables**.

### Configuration (environment variables)

| Variable             | Default                     | Meaning                                                                                                                                                                                           |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STATIC_DIR`         | -                           | Directory with the built frontend; empty = only `/ws` (dev)                                                                                                                                      |
| `LOG_LEVEL`          | `info`                      | `debug` \| `info` \| `warn` \| `error`                                                                                                                                                           |
| `LOG_FORMAT`         | `text`                      | `text` \| `json`                                                                                                                                                                                 |
| `LOG_FILE`           | -                           | additionally log to a file (in Docker on the `slf-logs` volume)                                                                                                                                  |
| `WS_ALLOWED_ORIGINS` | Same-origin + localhost/LAN | Additionally allowed WebSocket origins (comma-separated). By default same-origin as well as localhost/private LAN IPs are allowed; set this to allow the frontend from a **different** domain    |

## Performance

Two isolated, reproducible measurements (targets: avg < 80 ms, max < 150 ms
roundtrip, >= 500 concurrent players):

```bash
# 1) Pure logic (no network): scoring & ranking
cd backend && go test -bench=. -benchmem -run=^$ ./internal/game/

# 2) End-to-end roundtrip under load (server must be running)
go run ./cmd/server &
go run ./cmd/loadtest -players 500     # connects 500 players, measures broadcast latency
```

The tool spreads the players across many lobbies, has all hosts trigger a state
change at the same time and measures, per client, the time until the resulting
`lobbyState` broadcast (avg/p50/p95/p99/max).

## Deliberate decisions & known limitations

These points are known and chosen deliberately; they are **not a problem** for
the intended use (LAN/party game):

- **A single global mutex in the hub** serializes all lobbies. Not critical at
  the current scale (load test: 500 players, avg < 5 ms roundtrip); sharding per
  lobby would only be needed with very many concurrent games and was therefore
  deliberately not implemented.
- **Clipboard fallback via `document.execCommand("copy")`**: over plain HTTP on
  the LAN (typical: phone connects via a local IP) `navigator.clipboard` is not
  available. The fallback uses the officially deprecated but still widely
  supported `execCommand`, a deliberate pragmatic compromise.
- **No host handoff**: if a disconnected host does not return within the 15 s,
  the lobby is closed (no transfer of the host role), kept deliberately simple
  for a party game.
- **No persistence layer**: the entire state lives in RAM. After a server
  restart the lobbies are gone; clients are disconnected cleanly and return to
  the home screen.

## License

This project is licensed under the terms of the GNU General Public License,
version 3 or (at your option) any later version (`GPL-3.0-or-later`). See the
[`LICENSE`](LICENSE) file for the full license text.
