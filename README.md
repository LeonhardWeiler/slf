# Stadt Land Fluss

Real-time multiplayer Stadt Land Fluss in the browser. Go WebSocket backend,
React frontend, all state in memory.

Live: https://slf.coprime.tech

## Run

```bash
nix develop                          # Go, Bun, air
cd backend && air                    # :8080
cd frontend && bun install && bun dev  # :5173
```

## Check

```bash
cd backend && gofmt -l . && go vet ./... && go test ./...
cd frontend && bun run lint && bun run test && bun run build
```

`nix build` runs all of them. After changing `bun.lock` or `go.sum`, copy the
`got: sha256-…` from the hash mismatch into `flake.nix`.

## Deploy

A green push to `master` deploys. The server drains on `SIGHUP` and keeps idle
lobbies across the restart.

| Variable             | Meaning                                           |
| -------------------- | ------------------------------------------------- |
| `LISTEN_ADDR`        | listen address, default `0.0.0.0:8080`            |
| `STATIC_DIR`         | built frontend; empty = only `/ws`                |
| `STATE_DIRECTORY`    | saved lobbies and anonymous usage events          |
| `STATS_ADDR`         | stats dashboard, needs `STATE_DIRECTORY`          |
| `LOG_LEVEL`          | `debug` \| `info` \| `warn` \| `error`            |
| `LOG_FORMAT`         | `text` \| `json`                                  |
| `LOG_FILE`           | also log to this file                             |
| `WS_ALLOWED_ORIGINS` | extra WebSocket origins besides same-origin/LAN   |

## Data

No accounts, no database. The server logs names and lobby codes (session ids
only hashed) and records anonymous usage events. The browser keeps the session
id, draft answers and local best scores.

## License

GPL-3.0-or-later, see [`LICENSE`](LICENSE).
