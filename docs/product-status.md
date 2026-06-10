# Product Status

A plain snapshot of what Mind Ontology can do **today**, what is deliberately
held closed, and what comes next. This is the standalone, local-first product;
a hosted backend is **not** available from this repository.

---

## Usable now (local, no account, no network)

- **Context compiler** — `agentctx:compile` turns a `.agentctx/` folder into a
  task-scoped pack: constraints always included, other sources scored against the
  task and `--scope`, risky tasks force safety blocks in.
- **Nine-file schema** — constraints, identity, direction, projects, decisions,
  architecture, agent-roles, glossary, competency questions; each with a schema
  doc and a conformance test.
- **Local MCP server** — `agentctx:mcp` exposes exactly `get_context` and
  `list_constraints` over stdio JSON-RPC; proven end-to-end by a real round-trip
  smoke test.
- **CLI tooling** — `init` (non-destructive scaffold), `compile`, `validate`,
  `metrics` (pack-focus measurement), `smoke` (one-command acceptance), `proof`
  (smallest gate).
- **Client setup** — copy-paste configs for Claude Code, Codex, Cursor, and a thin
  OpenAPI/connector surface for ChatGPT / Claude.ai (placeholders only).

## Fail-closed by design

- **License** — settled: **Apache-2.0** (`LICENSE` + `NOTICE` shipped, SPDX id in
  `package.json`). See [`../LICENSE-DECISION.md`](../LICENSE-DECISION.md).
- **Distribution** — release-prepared and publish-ready, but unpublished:
  version `0.1.0`, the `files` allowlist, and the local release gates (full
  suite, proof, validate, smoke, dry-run pack) are in place, and the `private`
  flag has been removed. Running `npm publish` remains a separate, explicit
  operator decision, after the public GitHub repository exists and its URL is
  added to `package.json`.
- **Hosted memory & writeback** — adapter **contracts only**. Feature flags
  default **off**; the writeback adapter is **proposal-only** (no `execute()`);
  no adapter performs network I/O. The local path never depends on the hosted one.
- **Deployment** — the self-host connector is a **plan**, not a runtime: no
  `wrangler.toml`, no Worker source, no deploy command, no secret.

## Verification

| Gate | Command | Current |
|---|---|---|
| Proof | `npm run agentctx:proof` | 22/22 |
| Validate | `npm run agentctx:validate` | VALID (0 errors) |
| Smoke | `npm run agentctx:smoke` | SMOKE PASS (12/12) |
| Full | `npm test` | 1205 tests across 170 files, green |

See [`testing.md`](testing.md) for the test taxonomy. The suite has been hardened
with guard/audit tests so docs, fixtures, and the fail-closed boundary cannot
drift from the code (link/anchor/script audits, control-plane import audit, CLI
error-UX, scoring/compile/metrics determinism, doc↔code consistency bindings).

## What's next

The local product is complete enough to dogfood. Candidate next lanes (none of
which require deploy, secrets, or live writes) are tracked in
[`../NEXT-LANES.md`](../NEXT-LANES.md). The hosted on-ramp remains a future,
opt-in, fail-closed step — not part of this repository.
