# Contributing

## Repo Layout

- `cmd/kyma-ter` — CLI entrypoint
- `internal/` — backend runtime
- `frontend/` — Vite + React UI
- `scripts/` — release helpers

## Prerequisites

- Go
- Node.js 22+
- npm
- CGO-capable toolchain for local Go builds

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

From the repo root:

```bash
make frontend
make backend
make build
```

## Validation

Backend:

```bash
go test ./...
```

Frontend:

```bash
cd frontend
npm run build
```

## Release Shape

1. Build binaries from this repo
2. Publish GitHub Release assets in `kyma-api/kyma-ter`
3. Bump `kymaTerminal` in `@kyma-api/agent`
4. Publish `@kyma-api/agent`

## Notes

- Keep user-facing docs in `kyma-api` docs site
- Keep this repo focused on runtime code and contributor-facing notes
