# Kyma-ter Project Guide

## Product Stack
- **Kyma API** — hosted backend platform (separate repo: `kyma-api`)
- **Kyma Agent** — `kyma` coding agent CLI (distributed via `@kyma-api/agent` npm)
- **Kyma Ter** — local multi-agent terminal workspace (this repo)

Kyma Ter is a Go HTTP server + embedded React SPA. Single binary, no Electron.

## Architecture
```
cmd/kyma-ter/main.go        Entry point (cobra CLI)
internal/
  config/config.go           Config: ~/.config/kyma-ter/config.json
  server/server.go           HTTP + WebSocket server (gorilla/mux)
  ptymanager/                PTY session management (creack/pty)
  wsbridge/                  WebSocket event broadcasting
  db/                        SQLite persistence (mattn/go-sqlite3)
  updater/                   Background auto-update (two-phase: download → apply on restart)
  tray/                      System tray icon (fyne.io/systray)
  web/embed.go               go:embed frontend/dist into binary
frontend/                    React 19 + Vite + TypeScript
  src/store/settings.ts      Keyboard shortcuts (Zustand + localStorage)
  src/hooks/useKeyboardShortcuts.ts  Shortcut handler
  src/utils/spawn.ts         Kyma Agent spawn logic
```

## Key Paths
| Path | Purpose |
|---|---|
| `~/.config/kyma-ter/config.json` | User config (port, agents, API keys) |
| `~/.config/kyma-ter/*.db` | SQLite databases |
| `~/.kyma/ter/bin/kyma-ter` | Global binary (auto-updater target) |
| `~/.kyma/ter/version` | Installed version tracking |
| `/opt/homebrew/bin/kyma-ter` | Symlink/copy from npm global install |
| `~/Library/LaunchAgents/com.sonpiaz.kyma-ter.plist` | macOS auto-start (launchd) |

## Build & Install

```bash
make build      # Frontend + Go binary (local ./kyma-ter)
make install    # build + copy to ~/.kyma/ter/bin/kyma-ter
make frontend   # Vite build only
make backend    # Go build only
make dev        # Instructions for dev mode (2 terminals)
make clean      # Remove artifacts
```

**IMPORTANT:** After any code change, use `make install` for local verification. The binary you should test is:
- `~/.kyma/ter/bin/kyma-ter`

Do **not** assume `/opt/homebrew/bin/kyma-ter` is the fresh binary. On machines with `@kyma-api/agent` installed globally, that path can be a Homebrew/npm shim pointing to the Node launcher. Overwriting that shim is a bug.

Local verification flow:

```bash
cd /Users/sonpiaz/kyma-ter
make install
pkill -f "/Users/sonpiaz/.kyma/ter/bin/kyma-ter" || true
nohup /Users/sonpiaz/.kyma/ter/bin/kyma-ter >/tmp/kyma-ter.log 2>&1 &
```

If the UI still looks stale after a rebuild:
- restart `kyma-ter`
- hard-reload the browser tab
- check `/tmp/kyma-ter.log`

## Keyboard Shortcuts (Frontend)
| Shortcut | Action | Defined in |
|---|---|---|
| Ctrl+K | New Kyma Agent pane | settings.ts → useKeyboardShortcuts.ts → spawn.ts |
| Ctrl+A | Agent Workspace modal | |
| Ctrl+T | New workspace tab | |
| Ctrl+W | Close pane / dismiss settings | |
| Ctrl+, | Settings modal | |

## System Tray (Menu Bar)
Uses `fyne.io/systray`. Icon: Ψ template icon (monochrome, macOS auto dark/light).
- Requires main OS thread (`runtime.LockOSThread()` in tray package init)
- HTTP server runs in goroutine when tray is enabled
- `--no-tray` flag disables tray for headless/SSH usage
- Menu: Open Dashboard, Launch at Login, Quit

## Release Process
1. `./scripts/release.sh <version>` — cross-compile binaries to `dist/`
2. Create/update GitHub Release `ter-v{version}` in `kyma-api/kyma-ter`
3. Upload release assets there
4. In `kyma-api` repo: bump `kymaTerminal` in `packages/kyma-agent/package.json`
5. `npm publish @kyma-api/agent`

Auto-updater checks the canonical `kyma-api/kyma-ter` GitHub Release for latest version, downloads in background, and applies on next restart.
It must only upgrade when `latest > current`; downgrade paths are a bug.

## First-Run Testing

To replay onboarding/setup intentionally:

- reset `kyma-agent` onboarding:
  - `rm -f ~/.kyma/agent/.onboarded ~/.kyma/agent/auth.json`
- reset `kyma-ter` setup:
  - `rm -f ~/.config/kyma-ter/config.json`

Then relaunch `~/.kyma/ter/bin/kyma-ter`.

## Conventions
- Commits: conventional format (`feat:`, `fix:`, `chore:`, `docs:`)
- Branding: Ψ symbol, color #eab308 (yellow/gold)
- CGO required (sqlite3 + systray)
- Default port: 18800
- Config defaults in code, not env vars
