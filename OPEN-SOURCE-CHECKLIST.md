# Kyma Ter Open-Source Checklist

This checklist is for making `kyma-ter` clean, credible, and contributor-friendly as a public repo.

Current repo strengths:

- public GitHub Releases already exist under `kyma-api/kyma-ter`
- Windows binaries are already published
- Windows CI already exists in `.github/workflows/windows.yml`
- the root `README.md` already explains install, Windows beta status, and local development
- module path now uses `github.com/kyma-api/kyma-ter`
- `LICENSE`, `CONTRIBUTING.md`, and `SECURITY.md` now exist
- issue templates and a PR template now exist
- the root `README.md` now links to releases, docs, and Windows setup

Current repo gaps:

- repo contents still include internal-looking artifacts that should be reviewed before broad public promotion

## Must-Have Before Open Source

### 1. Canonical Identity

- [x] change `go.mod` module path from `github.com/sonpiaz/kyma-ter` to `github.com/kyma-api/kyma-ter`
- [x] update all internal Go imports to the org-owned module path
- [x] re-run `go test ./...` after the path migration
- [ ] verify release scripts and docs still point to `kyma-api/kyma-ter`

Why this matters:

- external tools and AI agents use module paths as a strong source of truth
- leaving the personal namespace here makes the repo look half-migrated

### 2. License And Legal Baseline

- [x] add a `LICENSE`
- [ ] confirm all bundled frontend/backend dependencies are compatible with the chosen license
- [ ] confirm embedded assets and screenshots are safe to publish

Why this matters:

- a public repo without a license is not a clean open-source repo

### 3. Contributor Baseline

- [x] add `CONTRIBUTING.md`
- [ ] document exact local dev steps for backend and frontend
- [ ] document how to run tests
- [ ] document how releases work at a high level

Minimum contents for `CONTRIBUTING.md`:

- repo layout
- install prerequisites
- `go test ./...`
- `cd frontend && npm install && npm run build`
- coding expectations for UI and backend changes

### 4. Security Policy

- [x] add `SECURITY.md`
- [ ] define where to report vulnerabilities
- [ ] state supported release lines, if any

Why this matters:

- `kyma-ter` is a local runtime with shell execution and file-system access
- public repos in this category should not leave vuln reporting ambiguous

### 5. Public Repo Hygiene

- [x] review top-level files and folders for internal-only material
- [ ] decide whether `video-footage/` belongs in the public repo
- [x] decide whether `.codex-context.md` belongs in the public repo
- [x] review `.playwright-mcp/` and remove generated artifacts if they are not intentionally public
- [ ] review scripts and docs for personal paths like `/Users/sonpiaz/...`

Why this matters:

- public repos should not feel like a working directory snapshot
- internal operating docs now live under `kyma-api/docs/internal/kyma-ter`

### 6. Public Support Boundary

- [x] add a short support policy section to `README.md`
- [x] clearly state:
  - macOS: native
  - Linux: native
  - Windows: beta
  - WSL2: recommended for shell panes
- [x] clearly state where the user-facing install flow lives: `@kyma-api/agent`

Why this matters:

- users and AI tools should not have to infer support status from scattered docs

## Strongly Recommended Right After Open Source

### 7. Community Workflow

- [x] add `.github/ISSUE_TEMPLATE/bug_report.yml`
- [x] add `.github/ISSUE_TEMPLATE/feature_request.yml`
- [x] add `.github/pull_request_template.md`

Suggested issue template sections:

- platform
- `kyma` version
- `kyma-ter` version
- reproduction steps
- logs or screenshots

### 8. Better Root README

- [x] add one strong product definition near the top
- [ ] add a screenshot or GIF of the real workspace
- [ ] add a short “Why Kyma Ter exists” section
- [x] add direct links to:
  - releases
  - docs
  - Windows setup

Suggested README structure:

1. What Kyma Ter is
2. Install
3. Platform support
4. Screenshot / GIF
5. Local development
6. Release flow
7. Contributing

### 9. Regression Protection

- [ ] add regression coverage for workspace switching preserving terminal state
- [ ] add at least one smoke-level frontend check for tab/workspace behavior
- [ ] document any behavior that intentionally depends on xterm lifecycle

Why this matters:

- the workspace/history bug is exactly the kind of UI regression open-source contributors can reintroduce

### 10. Docs Split

- [ ] keep user docs in `kyma-api` docs site
- [ ] keep contributor and architecture docs in this repo
- [ ] link them clearly from `README.md`

Suggested repo-local docs:

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/RELEASES.md`

## Nice-To-Have After Open Source

### 11. CI Expansion

- [ ] add Linux checks
- [ ] add macOS checks
- [ ] add a release build check for all target platforms

### 12. Public Demo Assets

- [ ] add a short demo GIF in the README
- [ ] add one screenshot showing:
  - agent panes
  - shell panes
  - multi-workspace tabs

### 13. Versioning Clarity

- [ ] explain relation between:
  - `kyma-ter` binary version
  - `@kyma-api/agent` package version
- [ ] link to the canonical release flow

## Recommended Order

Do these first:

1. module path migration
2. `LICENSE`
3. `CONTRIBUTING.md`
4. `SECURITY.md`
5. repo hygiene sweep
6. `README.md` support policy + screenshot

Then do:

7. issue templates
8. regression protection
9. docs split
10. CI expansion

## Practical Definition Of “Ready”

`kyma-ter` is ready to present as a serious open-source repo when:

- the repo identity is fully under `kyma-api`
- the legal and contribution baseline exists
- public-facing docs are clear
- internal debris is removed
- release flow and Windows beta support are explained without ambiguity
