# Kyma Ter

Kyma Ter is the local multi-agent terminal workspace in the Kyma product stack.

- `Kyma API` is the hosted backend platform
- `Kyma Agent` is the `kyma` coding agent
- `Kyma Ter` is the local workspace launched with `kyma-ter`

Kyma Ter runs a local Go server, serves an embedded frontend, and lets you run Kyma Agent and shell sessions side-by-side in a browser UI.

## How It Is Distributed

Kyma Ter is distributed through the `@kyma-api/agent` npm package.

Install:

```bash
npm install -g @kyma-api/agent
```

That package installs:

- `kyma`
- `kyma-ter`

The npm install step downloads the local `kyma-ter` binary into `~/.kyma/ter/bin/`.

## What Kyma Ter Does

Kyma Ter is built for local, parallel terminal work:

- multi-pane workspace UI
- Kyma Agent panes
- shell panes
- multiple workspaces
- keyboard shortcuts
- local config and local persistence
- browser UI connected over local HTTP and WebSocket routes

## Local Development

Backend:

```bash
go run ./cmd/kyma-ter/ serve --port 18800
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Useful shortcuts from the project root:

```bash
make run
make frontend
```

## Architecture At A Glance

Main entrypoints:

- `cmd/kyma-ter/main.go` - CLI entry and startup
- `internal/server/server.go` - HTTP and WebSocket routes, setup flow, session/task APIs
- `internal/config/config.go` - local config file and defaults
- `internal/updater/updater.go` - runtime self-update behavior
- `frontend/src/App.tsx` - main UI shell

Important behavior:

- `kyma-ter` starts a local server and opens the workspace UI
- the UI can spawn `kyma` sessions and normal shell sessions
- setup can install `@kyma-api/agent` if `kyma` is not present
- runtime updater can download a newer `kyma-ter` binary in the background

## Local Paths

Kyma Ter uses:

- `~/.kyma/ter/bin/kyma-ter`
- `~/.kyma/ter/version`
- `~/.config/kyma-ter/config.json`
- `~/.config/kyma-ter/*.db`

## Release Relationship

When releasing a new Kyma Ter build:

1. build new binaries from this repo
2. update the pinned `kymaTerminal` version in `kyma-api/packages/kyma-agent/package.json`
3. publish `@kyma-api/agent`
4. sync public docs and READMEs

See:

- `scripts/release.sh`
- `../kyma-api/docs/PACKAGING-AND-DISTRIBUTION.md`

## Docs

- Kyma Ter overview: `kyma-api/docs-site/guides/kyma-ter/overview.mdx`
- Kyma Ter quickstart: `kyma-api/docs-site/guides/kyma-ter/quickstart.mdx`
- Kyma Ter + Kyma Agent: `kyma-api/docs-site/guides/kyma-ter/kyma-integration.mdx`

## Notes

This repo is the runtime source of truth for Kyma Ter behavior.
Public docs should be derived from this codebase, not the other way around.
