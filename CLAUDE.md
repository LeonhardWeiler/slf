# CLAUDE.md

Stadt Land Fluss, real-time multiplayer in the browser. Go WebSocket backend
(server-authoritative) + React SPA frontend. Details in the `README.md`.

## Stack

- **Backend:** Go, WebSocket (`coder/websocket`), in-memory state (no persistence layer).
- **Frontend:** React 19, Vite, TypeScript (`strict`), plain CSS (`src/index.css`),
  lucide-react icons, Zustand, routing via the History API (`src/lib/nav.ts`,
  `src/router.tsx`), Zod. UI primitives live in `src/components/kit.tsx`
  (Btn, IconBtn, Toggle, Slider, Mascot, Tiles, Av); `Shell` adds the global
  tap sound/haptic, tooltips (`data-tip`, hover and long-press), the per-round
  world (`lib/feel.ts`: shape, palette, particles via `lib/fx.ts`, timbre via
  `lib/sound.ts`) and the music scene per lobby state. Light only, no dark mode.
- Lint + format: Biome. Frontend tests: `bun test`. Backend tests: `go test`.

## Commands

Always run inside the respective subfolder:

```bash
# Backend (in backend/)
gofmt -l .            # must be empty (format gate)
go vet ./...
go test ./...         # for concurrency: go test ./... -race

# Frontend (in frontend/)
bun install
bun run lint          # biome ci: lint + format check (fix: node_modules/.bin/biome check --write .)
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
There is no Vite transform pipeline, so tests cannot rely on Vite-only
features (`import.meta.env`, CSS imports). `bunfig.toml` preloads
`src/test/setup.ts`, which registers happy-dom globals, so component tests
render with `@testing-library/react`. Screens need `mock.module` for `@/lib/nav`, imported after the mock; `ws.send` is a
`spyOn` restored in `afterAll`, since a module mock of `@/lib/ws` leaks into
`ws.test.ts` (see `src/pages/screens.test.tsx`). Adding a dependency changes
the `nodeModules` `outputHash` in `flake.nix`.

## Conventions

- The server is the single source of truth: rules/scoring/state live only on the
  server; every incoming message is validated with Zod (`frontend/src/lib/serverEvents.ts`).
- `frontend/src/lib/answerValidation.ts` **mirrors** the backend engine rules
  and word values (`backend/internal/game/engine.go`); keep both in sync when changing either one
  (`bun test` covers this). Mind the JS/Go semantics gap: Go maps case rune by
  rune and counts runes, JS `toUpperCase()` expands (`ß` -> `SS`) and `.length`
  counts UTF-16 units. Use the file's `mapCase`/`upperRunes` helpers and
  `[...s].length`, never the raw JS methods.

## Architecture (brief)

- State machine per lobby: `Lobby -> Countdown -> Playing -> Reviewing ->
RoundResult -> GameOver -> Lobby`. Two shortcuts: an **empty round** (no active,
  non-left player submitted anything) skips `Reviewing` and goes
  `Playing -> RoundResult` directly; and `beginCountdown` falls back to `Lobby`
  instead of starting a round when the lobby has **no connected participant**.
- Messages: JSON over `/ws`, client->server `{type, payload, sessionId}`,
  server->client `{type, payload, stateVersion}`. A client gets one full
  `lobbyState` per session (and per `reconnect`), then `lobbyPatch` (only
  changed players + `removed`, merged by `applyLobbyPatch`); the commentator
  board likewise gets `commentatorState` once, then `commentatorUpdate` rows.
  All room messages go through `reduceRoom` (`store/room.ts`): it drops a
  message older than the last `stateVersion` (0 = unversioned, never dropped),
  clears round data on a phase or round change, and `Room` shows a loading view
  until `phaseReady`.
- Backend: `cmd/server` (entry point + security headers/SPA serving),
  `cmd/loadtest` (WebSocket load generator),
  `internal/game` (engine/state), `internal/websocket` (hub, handlers).
- `sessionId` lives in `localStorage` (per browser, survives closing the tab ->
  auto-reconnect as the same player). An explicit "leave" clears it **and** the
  server drops the session, so leaving is final on both sides - a replayed id
  for a player marked `Left` is refused.
  A newer socket for the same session closes the old one with code 4000; that
  tab does not auto-reconnect, only on focus/visibility (`ws.replaced`).
- **Solo** (`soloPlayer` in `game_util.go`: exactly 1 non-left player who is no
  spectator): buzz skips the fill and rule checks, and `finishPlaying` scores
  the round without review and goes straight to `nextRound`.
  A joiner ends solo on the spot.
- **Deploy**: `SIGHUP` drains (no new games until no lobby is mid-game), then
  `Hub.Shutdown` refuses new sockets/messages and closes all sockets, then
  idle lobbies are saved to `$STATE_DIRECTORY/lobbies.json` and restored on
  start (`persist.go`). The client reloads on reconnect when `index.html`
  references a new build (`ws.ts`).
- **Sprint** (every solo game, `beginCountdown`): one round over a shuffled letter sequence
  (`Round.Letters`, `sprintLetters`: one cycle untimed, which ends the round
  after the last prompt; with a time limit enough shuffled cycles to outlast
  it); prompt `pos` is letter `pos/n`, category `pos%n`, sent as
  `sprintWord`. Answers are keyed `letterIndex:categoryId`. Review and scoring walk
  `Round.Slots` (fixed in `finishPlaying`; classic = one slot per category, key
  = categoryId), so a sprint reuses scoring unchanged. A rejoin replays
  `sprintWords`, one entry per prompt, "" for a skipped one.
- **Stats** (`internal/stats`): game start/end and the client `track` message
  (`world`, `leave`, `mute`, `musicOff`, whitelisted in `handleTrack`) append
  anonymous events to `$STATE_DIRECTORY/events.jsonl`; `STATS_ADDR` serves the
  dashboard on a separate listener (production: tailnet only).
- Joining is possible in **any** lobby state; whoever joins mid-game is
  `Pending` (spectator, not in scoring/ranking/review) and is activated at the
  next round start (`beginCountdown`).
- **Round participation** is decided only by the predicates in
  `internal/websocket/game_util.go` - never re-derive it from
  `Left`/`Pending`/`Connected` at a call site, that drift is what once let a
  departed player's answers be scored while review filtered them out:
  - `isRoundSpectator` - watches instead of playing (commentator host or
    pending joiner)
  - `playsThisRound` - answers count this round (review, scoring, commentator
    board, empty-round check)
  - `canPlayNextRound` - could play a round starting now (gates `startGame`
    and `beginCountdown`)

  The standings (`buildRoundResult`) are the documented exception: they drop
  only spectators, because a player who left stays in the ranking.
