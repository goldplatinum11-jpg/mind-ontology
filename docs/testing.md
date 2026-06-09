# Testing

Mind Ontology ships its guarantees as tests. The suite is local-only — no
network, no account, no hosted SIRT — and runs in a few seconds.

## The four gates (smallest → fullest)

| Gate | Command | What it proves |
|---|---|---|
| **Proof** | `npm run agentctx:proof` | Smallest viable validation — one file (`tests/unit/agentctx-proof.test.mjs`). Fast smoke that the core compile/validate contract holds. Run this first. |
| **Validate** | `npm run agentctx:validate` | The shipped `.agentctx/` template conforms to the schema (`0 errors`). |
| **Smoke** | `npm run agentctx:smoke` | End-to-end free-layer journey (init → compile → idempotency guard → friendly errors) in a throwaway temp dir: `SMOKE PASS`. |
| **Full** | `npm test` | The entire `tests/unit` suite (407 tests across 77 files at last count). The release gate. |

Run order before a release is in [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md).

## Test categories

The `tests/unit/` files group by what they guard:

- **Schema conformance** — `agentctx-*-schema.test.mjs`, `agentctx-validate.test.mjs`,
  `cq-product-core.test.mjs`: each `.agentctx/` source schema and the validator.
- **Competency-question regression** — `cq-regression.test.mjs` (CQs name real,
  compiled sources), `cq-regression-table.test.mjs` (each CQ topic's task surfaces the
  file that answers it): the verification-core contract, regressed at retrieval. See
  [The CQ regression contract](#the-cq-regression-contract).
- **Compiler & CLI** — `agentctx-compile.test.mjs`, `agentctx-init.test.mjs`,
  `init-idempotency.test.mjs`, `agentctx-metrics.test.mjs`, `cli-ux-contract.test.mjs`,
  `agentctx-risk.test.mjs`, `risk-modes-doc.test.mjs`, `cli-wrapper.test.mjs`,
  `cli-error-ux.test.mjs` (in-process parse/validate errors),
  `cli-error-ux-catalog.test.mjs` (every failure mode driven end-to-end through the
  `mind-ontology` wrapper, asserting stable error-UX properties): compile scoring,
  init safety, metrics meaning, risk-mode forcing, and the friendly-error contract.
- **MCP transport** — `agentctx-mcp.test.mjs` (handlers) and
  `mcp-server-smoke.test.mjs` (real stdio JSON-RPC round-trip).
- **Connectors & client setup** — `agentctx-*-setup-proof.test.mjs`,
  `agentctx-connector-manifests.test.mjs`, `connector-surface-thin.test.mjs`,
  `mcp-setup-fixtures.test.mjs`: thin two-tool surface, placeholders only, and the
  full copied-config contract. See [The setup-fixture contract](#the-setup-fixture-contract).
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

## The CQ regression contract

Competency questions are Mind Ontology's verification core: the product promise is
that, given a task, the compiler surfaces the ontology file(s) needed to answer it.
`cq-regression-table.test.mjs` locks that promise against drift with a table — one
row per CQ topic family, each a task phrased the way an agent would actually ask it
(prose, no tag injection), plus the source file that must appear in the compiled pack.

| CQ topic family | Task style (example) | Must surface |
|---|---|---|
| project / scope | "What is the active project and which repos belong to it?" | `projects.md` |
| project / scope | "What is the current direction and near-term priorities?" | `direction.md` |
| constraints / safety | "What must the agent avoid, and which writes are forbidden?" | `constraints.md` (always) |
| vocabulary / glossary | "What does the term context pack mean?" | `glossary.md` |
| architecture / layering | "Explain the architecture layers and the layer map." | `architecture.md` |
| decisions / rationale | "Why did we decide to keep the free layer self-hosted?" | `decisions.md` |
| agent roles / delegation | "Which agent role handles code review and delegation?" | `agent-roles.md` |

The contract is **semantic, not numeric**: rows assert that the expected file appears
and *how* it appears (`matched` = earned by scoring the task; `always` = the
constraints.md safety floor), never exact scores — so the suite survives scorer tuning
but fails if a topic family stops being answerable. A negative-control row proves the
matches are earned (an unrelated task surfaces only the safety floor, not topic files),
and a bridge row asserts every source file the template's `cq.md` *names* is one a
regression task actually surfaces — so the CQ text and the compiler can't drift apart.

To extend coverage, add a row to `CASES` (and its family to `REQUIRED_FAMILIES` if
new); keep tasks in natural language and assertions on file + reason, not on scores.

## The setup-fixture contract

Mind Ontology's promise to setup-copiers: **every AI client points at the same
local MCP entrypoint and sees the same two read-only tools.** The copy-paste
configs that make that true live in [`agentctx-setup/`](agentctx-setup/) and are
guarded by `tests/unit/mcp-setup-fixtures.test.mjs` (the `FIXTURES_V1` block).

The test is driven by one declarative manifest — every file under
`docs/agentctx-setup/` with its *kind* — and the on-disk directory must equal that
manifest exactly. A new or removed copied config therefore fails the suite until
it is classified and validated; a fixture cannot land unaudited.

| Kind | Fixtures | Invariant the test enforces |
|---|---|---|
| `stdio-json` | `claude-code.mcp.json`, `cursor.mcp.json` | exactly one server `agentctx`; `command: node`; args launch exactly the canonical `scripts/agentctx/mcp-server.mjs`; no pinned tool subset |
| `stdio-toml` | `codex-config.toml` | exactly one `[mcp_servers.*]` table and it is `agentctx`; `command = "node"`; args include the canonical entry |
| `hosted-json` | `claude-ai-connector.example.json`, `chatgpt-connector.example.json` | placeholder host only; two-tool surface (`tools` / `allowed_tools` = `get_context, list_constraints`); auth declared but value-less |
| `openapi` | `mind-ontology-connector.openapi.json` | placeholder server; the two `operationId`s only; all-POST read-only shape |

On top of the per-kind checks, three sweeps run across **every** fixture:

- **One entry, no divergence** — all stdio clients (JSON + TOML) launch the
  *identical* args, so Claude Code, Cursor, and Codex cannot drift apart.
- **No tool sprawl** — the only tool tokens that appear in any config (tool lists
  or OpenAPI `operationId`s) are `get_context` and `list_constraints`; the check
  also proves both are actually surfaced (non-vacuous).
- **Placeholder-and-secret-free** — every `https://` host targets the reserved
  `.example` TLD (no Workers/`sirtai.org`/production host), no bearer/token/key
  value is embedded, and no fixture hard-codes `sirt-app-v2` or a private clone
  path.

To extend coverage, add a row to `FIXTURES` with its `kind` (and a `toolsKey` for
hosted JSON). Keep fixtures placeholder-only and credential-free — the sweeps
will hold every new fixture to the same contract.

## Conventions

- One behavior or claim per `it`; messages explain the failure.
- Docs get **guard tests** (assert key claims + that cited commands/files exist) so
  documentation can't drift from the code.
- Temp-dir tests clean up in `afterEach`; nothing mutates the repo.
- `vitest.config.mjs` strips a `#!` shebang at transform time so CLI `.mjs`
  modules can be imported directly.
