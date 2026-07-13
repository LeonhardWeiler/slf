# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers were reconstructed from the Git history; the project has not been
formally released yet, so all versions are in the `0.x` range.

## [0.9.2] - 2026-07-13

### Added

- `CHANGELOG.md` reconstructed from the Git history.

### Changed

- Declared the project license as `GPL-3.0-or-later`.
- Translated the developer-facing documentation and remaining code comments to English.
- Replaced em/en dashes and unicode arrows across the repository with plain ASCII.
- Set the `frontend` package version to `0.9.2` (was `0.0.0`) to follow semantic versioning.

## [0.9.1] - 2026-07-09

### Changed

- Cleaned up the round-result screen and made kicking a player more robust.
- Reworked the QR-code scanning UI.
- Normalized the casing of the join code.
- Adjusted the Biome configuration.

### Removed

- Removed the flame icon in favor of a text-based indicator.

## [0.9.0] - 2026-07-08

### Added

- Host can kick a player directly from the standings table (between rounds).

### Changed

- Start-screen buttons are narrower and centered on mobile.
- Left arrow key steps back through the login flow.
- Removed self-explanatory subtitles and labels across screens.
- Toast popups moved to the top center; secondary buttons use a transparent fill.
- Letter and time controls shown without a surrounding card.

### Fixed

- Final standings show "(left)" for disconnected players as well.

## [0.8.0] - 2026-07-07

### Added

- Tooltips for all lobby settings with wider tooltip panels.
- Per-field validation checkmarks and a progress bar in the answer input.

### Changed

- Optimistic connection status removes the error flash during page load.
- Room view is lazy-loaded (code splitting); QR scanner and generator load on demand.
- Confirmation dialog buttons are 50/50 full width; back buttons use an outline.
- Numerous animation refinements (letter toggles, toasts, countdown, ranking count-up).

### Fixed

- Raised amber text contrast to at least 4.5:1.
- Zod runs in jitless mode to avoid a CSP `eval` violation.
- Tooltips and info hints stay within the viewport.

## [0.7.0] - 2026-07-05

### Added

- Optional game modes are configurable per lobby.
- The active lobby lives under `/join/:code`, so the address bar doubles as a join link.

### Changed

- Ported the UI components from Radix/shadcn to Base UI.
- Replaced React Router with TanStack Router (code-based routing).
- Smart defaults: letter reveal during the countdown is off by default; no example code in the join field.

## [0.6.0] - 2026-07-04

### Changed

- Fine-grained Zustand selectors instead of whole-store subscriptions, reducing re-renders.

## [0.5.0] - 2026-07-02

### Added

- Host can end a running round; the review shows who stopped it.
- Confirmation dialogs for destructive actions (kick, end round, end game).
- Join anytime: players who join mid-game wait as spectators and play from the next round.
- Persistent session in `localStorage` for automatic reconnect as the same player.

### Changed

- Join name errors are shown inline instead of as a toast.
- Start-screen actions are disabled while there is no server connection.

### Fixed

- Focus trap in the confirmation dialog; global Enter/Copy shortcuts pause while a dialog is open.
- No "connection lost" toast on a cold start.

## [0.4.0] - 2026-07-01

### Added

- Game modes: commentator host, last-letter mode, and the once-per-round "flames" bet.
- Unified, stackable toast system for game and lobby events.
- `ErrorBoundary` to prevent a white screen on render or lazy-load errors.
- Host-disconnect protection: a visible 15-second grace countdown before the lobby closes.

### Changed

- Reconnect uses exponential backoff with jitter and reconnects immediately on online/focus/visibility.

## [0.3.0] - 2026-07-01

### Added

- Configurable server logging, a load-test tool, and engine benchmarks.
- Single-image Docker build and GitLab CI/CD pipeline.

### Changed

- Incoming server events are validated with Zod on the client.
- Server-side answer validation with explicit error codes; `stateVersion` on every message.
- Player broadcast DTO no longer leaks `sessionId`.

### Security

- `sessionId`/`playerId` generated from `crypto/rand`; `sessionId` only logged hashed.
- Per-connection rate limiting (token bucket) and join backoff.
- Caps for lobbies, players, and categories; a janitor cleans up orphaned lobbies.
- Secure WebSocket origin checks instead of the default wildcard.
- Security headers (CSP, HSTS with preload, COOP) for the served SPA.
- HTTP read/idle timeouts against Slowloris; explicit 64 KiB WebSocket read limit.
- Graceful shutdown that closes WebSockets cleanly.

## [0.2.0] - 2026-07-01

### Added

- Multi-step create/join flow on the home screen.
- QR-code sharing in the lobby and QR scanning to join.
- Letter overview: the host can disable individual letters.
- Connection indicator in the lobby and during the game.
- Project README and a unit test for the alphabet helper.

### Changed

- Return to the lobby after a game and keep leaving players in the standings.
- Review polish: click-to-merge equal answers and Enter to advance.
- Respect device safe areas on all screens; sort lobby players alphabetically.
- Enabled TypeScript strict mode.

### Fixed

- Timer, review UI, and countdown flash; added client-side buzz validation.
- Deduplicated React in Vite to fix a Radix switch crash.

## [0.1.0] - 2026-06-30

### Added

- Initial project structure with a Go WebSocket backend and a React frontend.
- End-to-end WebSocket connection between client and server.
- First playable round of the game.

[0.9.2]: https://gitlab.com/weilerle/slf
