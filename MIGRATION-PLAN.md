# Mind Ontology Migration Plan — COMPLETE

> **Status: the migration/extraction is complete.** This repository is the
> standalone Mind Ontology product workspace; no active migration is running.
> This file is retained as the historical record of the extraction plan.

## Outcome

The source Claude Code runway (Phase 5 launch readiness, P5-PR08/closeout)
reached its Result Pack, and the planned asset families were extracted into
this repository:

- `.agentctx/**`
- `docs/agentctx*.md`
- `docs/mind-ontology*.md`
- `scripts/agentctx/**`
- `tests/unit/agentctx*.mjs`
- `templates/mind-ontology/**`
- related package scripts such as `agentctx:*`

Provenance for what was moved is recorded in `EXTRACTION-INVENTORY.md` and
`docs/mind-ontology-extraction-map.md` (read-only history).

## Boundary held during extraction (and still enforced)

- No runner/controller infrastructure from the parent workspace unless
  required as an adapter boundary.
- No unrelated content.
- No production deploy/migration/secrets/live-write paths.

This file is internal: it is excluded from the npm tarball by the `files`
allowlist (regressed by `tests/unit/packaging-dry-run-contract.test.mjs`).
