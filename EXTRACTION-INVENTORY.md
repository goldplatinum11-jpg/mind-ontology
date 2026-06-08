# Mind Ontology — Standalone Extraction Inventory

Provenance record for the first standalone extraction of Mind Ontology / agentctx
out of `sirt-app-v2` into an independent product workspace.

- **Lane:** `MIND_ONTOLOGY_STANDALONE_EXTRACTION_V0`
- **Extraction date:** 2026-06-08
- **Worker:** Claude Code (Worker AI), Codex = Controller (did not implement)
- **Mode:** read/copy only from source; no source mutation, no remote, no push, no deploy

## Source

- **Source path:** `C:\Users\qmbqb\sirt-codex-clones\sirt-app-v2-pr08-acceptance`
- **Source branch:** `codex/mind-ontology-p5-launch-readiness-closeout`
- **Source HEAD:** `4fcc1ebf` — "docs: Mind Ontology Phase 5 launch readiness closeout"
- **Source working tree at extraction:** clean (nothing to commit)
- **Active Claude runway marker in source:** none active. CONTROL.md/MIGRATION-PLAN.md
  in the target referenced an `mind-ontology-seven-hour-runway`; the source tip is the
  Phase 5 launch-readiness *closeout* commit on a clean tree, i.e. the runway reached
  its closeout gate. No live runway state/lock file was present in the source.

## Target

- **Target path:** `C:\Users\qmbqb\sirt-product-workspaces\mind-ontology`
- **Target is sirt-app-v2:** NO (independent product workspace)
- **Target git at start:** not a git repository
- **Target git after extraction:** local git initialized for standalone provenance
  (no remote, no push, no PR, no merge)

## Extracted asset families

| Family | Count | Notes |
|---|---|---|
| `.agentctx/**` | 4 | architecture, constraints, decisions, direction |
| `templates/mind-ontology/**` | 10 | 9 `.agentctx/*.md` template sources + README |
| `scripts/agentctx/*.mjs` | 7 | acceptance-smoke, compile, init, mcp-server, metrics, risk, schema |
| `scripts/agentctx/adapters/*.mjs` | 5 | edge-model, enrichment, flags, memory-adapter, writeback-adapter (REVIEWED — see below) |
| `docs/agentctx*.md` | 4 | agentctx, agentctx-mcp, agentctx-mcp-setup, agentctx-phase-a-runbook |
| `docs/agentctx-setup/**` | 6 | connector + MCP client example configs |
| `docs/mind-ontology*.md` | 36 | full Mind Ontology doc set incl. hosted/SIRT boundary contract docs (REVIEWED) |
| `tests/unit/agentctx*.mjs` | 41 | all agentctx unit tests except phase-a-packet |
| `tests/fixtures/hosted-memory-enrichment.sample.json` | 1 | enrichment fixture |

New standalone scaffolding added (not copied): `package.json`, `vitest.config.mjs`,
`.gitignore`, `EXTRACTION-INVENTORY.md`.

## Reviewed assets (EXTRACT_WITH_REVIEW)

- **`scripts/agentctx/adapters/*.mjs` — INCLUDED.** All five reviewed line-by-line.
  Verdict: fail-closed contracts + null defaults + pure schema/validators. No `fetch`,
  no hosted endpoint URL, no credential material, no write execution, no file/network I/O.
  `flags.mjs` only reads boolean feature flags from env (default OFF). `writeback-adapter.mjs`
  is proposal-only with intentionally no `execute()`. Kept as local modules / contracts only.
- **Hosted / SIRT boundary docs — INCLUDED as docs/contracts only.** e.g.
  `mind-ontology-hosted-auth-tenant-boundary-v0.md`, `mind-ontology-sirt-memory-adapter-contract-v0.md`,
  `mind-ontology-sirt-writeback-proposal-contract-v0.md`, `mind-ontology-trust-security-model-v0.md`.
  These are design/contract documents; no live endpoint, write, or credential.
- **`tests/unit/agentctx-no-leakage-audit.test.mjs` — INCLUDED.** Actively enforces the
  hosted boundary (no embedded credential, no real URL, flags-off unreachable). Passes standalone.

## Excluded assets

- **`docs/operator/mind-ontology-autonomous-development-plan-v0.md` — EXCLUDED.** Reviewed.
  Describes the SIRT autonomous-development-line controller / worker-transport / seven-hour-runway
  orchestration — control-plane material, not product code or contract. No extracted test depends on it.
- **`scripts/operator/agentctx-phase-a-packet.mjs` — EXCLUDED.** Operator/control-plane infrastructure.
- **`tests/unit/agentctx-phase-a-packet.test.mjs` — EXCLUDED.** Sole dependency is the excluded
  `scripts/operator/agentctx-phase-a-packet.mjs` (control-plane). Per the extraction exception.
- **`agentctx:phase-a-packet` package script — EXCLUDED.** Pointed at the excluded operator script.
- **All other control-plane:** `scripts/operator/**`, runner/controller/launcher/watcher code,
  `.claude/skills/sirt-*`, SIRT ADL pending-stack artifacts, `migrations/**`,
  `deploy`/`env`/`wrangler`/live-write/production config, generic `src/**` app code.
  None copied. Verified: no extracted script or test imports from `scripts/operator`, `src/`,
  or any runner/controller/launcher/watcher path.

## Test results (standalone)

- `npm install` → 44 packages (vitest devDependency only). No hono/zod/wrangler needed —
  extracted scripts use only Node builtins; tests use only Node builtins + vitest.
- `npm run agentctx:proof` → **22/22 passed** (smallest viable validation).
- `npm test` (full `tests/unit`) → **41 files, 202 tests, all passed** (~9.5s).
- CLI entrypoints exercised: `agentctx:validate` (VALID, 0 errors), `agentctx:smoke` (12/12),
  `agentctx:compile` (renders pack) — all exit 0.

## Safety confirmations

No source mutation · no remote added · no push · no PR · no merge · no deploy · no migrations ·
no live writes · no credential access/printing · no production config change · no SIRT memory write ·
no SIRT control-plane/runner/operator infrastructure imported into the product.
