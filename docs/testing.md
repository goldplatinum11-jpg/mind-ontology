# Testing

Mind Ontology ships its guarantees as tests. The suite is local-only — no
network, no account, no hosted SIRT — and runs in a few seconds.

## The four gates (smallest → fullest)

| Gate | Command | What it proves |
|---|---|---|
| **Proof** | `npm run agentctx:proof` | Smallest viable validation — one file (`tests/unit/agentctx-proof.test.mjs`). Fast smoke that the core compile/validate contract holds. Run this first. |
| **Validate** | `npm run agentctx:validate` | The shipped `.agentctx/` template conforms to the schema (`0 errors`). |
| **Smoke** | `npm run agentctx:smoke` | End-to-end free-layer journey (init → compile → idempotency guard → friendly errors) in a throwaway temp dir: `SMOKE PASS`. |
| **Full** | `npm test` | The entire `tests/unit` suite (337 tests across 72 files at last count). The release gate. |

Run order before a release is in [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md).

## Test categories

The `tests/unit/` files group by what they guard:

- **Schema conformance** — `agentctx-*-schema.test.mjs`, `agentctx-validate.test.mjs`,
  `cq-product-core.test.mjs`: each `.agentctx/` source schema and the validator.
- **Compiler & CLI** — `agentctx-compile.test.mjs`, `agentctx-init.test.mjs`,
  `init-idempotency.test.mjs`, `agentctx-metrics.test.mjs`, `cli-ux-contract.test.mjs`,
  `agentctx-risk.test.mjs`, `risk-modes-doc.test.mjs`: compile scoring, init safety,
  metrics meaning, risk-mode forcing.
- **MCP transport** — `agentctx-mcp.test.mjs` (handlers) and
  `mcp-server-smoke.test.mjs` (real stdio JSON-RPC round-trip).
- **Connectors & client setup** — `agentctx-*-setup-proof.test.mjs`,
  `agentctx-connector-manifests.test.mjs`, `connector-surface-thin.test.mjs`:
  thin two-tool surface, placeholders only.
- **Hosted boundary & security** — `agentctx-no-leakage-audit.test.mjs`,
  `no-leakage-expansion.test.mjs`, `agentctx-adapter-flags.test.mjs`,
  `agentctx-memory-adapter.test.mjs`, `agentctx-writeback-adapter.test.mjs`,
  `adapter-no-write-path.test.mjs`, `agentctx-edge-model.test.mjs`,
  `edge-model-relations.test.mjs`: flags default-off, proposal-only writeback,
  no credentials/endpoints.
- **Docs & repo hygiene** — `agentctx-public-readme.test.mjs`,
  `license-boundary.test.mjs`, `schema-messages.test.mjs`,
  `docs-gates-ordering.test.mjs`, `release-contribution-readiness.test.mjs`,
  `doc-link-audit.test.mjs`, `control-plane-import-audit.test.mjs`: docs cite real
  commands/files, links resolve, license stays fail-closed, no control-plane imports.

## Conventions

- One behavior or claim per `it`; messages explain the failure.
- Docs get **guard tests** (assert key claims + that cited commands/files exist) so
  documentation can't drift from the code.
- Temp-dir tests clean up in `afterEach`; nothing mutates the repo.
- `vitest.config.mjs` strips a `#!` shebang at transform time so CLI `.mjs`
  modules can be imported directly.
