# Mind Ontology — Phase 2 Closeout (Ontology Schema & Context Quality)

**Status:** Phase 2 / P2-PR10 (closeout — documentation only, no behavior change)
**Scope:** Phase 2 of the Mind Ontology autonomous development plan
(`docs/operator/mind-ontology-autonomous-development-plan-v0.md`).

Phase 2 turned the free-layer ontology from "four scored files" into a **typed,
validated, measurable, risk-aware** context layer. This document indexes that
work and records the new surface so Phase 3 (multi-client distribution) can build
on a stable contract.

---

## What Phase 2 delivered

| PR | Lane | Result |
|---|---|---|
| P2-PR01 | `identity.md` schema | Personal-relationship layer contract + conformance test |
| P2-PR02 | `projects.md` schema | Work-inventory layer with `Name`/`Status` fields |
| P2-PR03 | `glossary.md` source support | Shared-vocabulary `#term` blocks |
| P2-PR04 | `agent-roles.md` schema | Role-routing layer; required coding/review roles |
| P2-PR05 | `cq.md` competency questions | Self-test layer (question-phrased CQs) |
| P2-PR06 | Compiler source-list expansion | All nine sources compiled; constraints stays always-included |
| P2-PR07 | Schema validation | `agentctx:validate` — executable schema checks |
| P2-PR08 | Context quality metrics | `agentctx:metrics` — selection ratio, compression, coverage |
| P2-PR09 | Task-risk modes | `--risk` flag; safety context forced into risky packs |
| P2-PR10 | Schema closeout | This document |

---

## Source schema index

Each `.agentctx/` source now has a versioned schema spec and a conformance test
that pins the shipped template to it (the template and its schema cannot drift):

| Source | Schema doc | Conformance test |
|---|---|---|
| `constraints.md` | (always-included; required by compile) | `agentctx-source-validation.test.mjs` |
| `identity.md` | `mind-ontology-identity-schema-v0.md` | `agentctx-identity-schema.test.mjs` |
| `projects.md` | `mind-ontology-projects-schema-v0.md` | `agentctx-projects-schema.test.mjs` |
| `glossary.md` | `mind-ontology-glossary-schema-v0.md` | `agentctx-glossary-schema.test.mjs` |
| `agent-roles.md` | `mind-ontology-agent-roles-schema-v0.md` | `agentctx-agent-roles-schema.test.mjs` |
| `cq.md` | `mind-ontology-cq-schema-v0.md` | `agentctx-cq-schema.test.mjs` |

Validation reference: `mind-ontology-schema-validation-v0.md`.
Metrics reference: `mind-ontology-context-quality` (see `metrics.mjs`).
Risk modes reference: `mind-ontology-task-risk-modes-v0.md`.

---

## New command + flag surface

| Command | Purpose |
|---|---|
| `npm run agentctx:compile -- --task <t> [--scope <csv>] [--risk auto\|safe\|risky]` | Compile a task-scoped context pack (now nine sources, risk-aware). |
| `npm run agentctx:validate [-- --cwd <path>]` | Validate `.agentctx/` against the schemas (exit 0/1). |
| `npm run agentctx:metrics -- --task <t> [--scope <csv>] [--format json]` | Report focus/compression/coverage for a task's pack. |
| `npm run agentctx:smoke` | Free-layer acceptance smoke (from P1-PR08). |
| `npm run agentctx:init [-- --cwd <path>] [--force]` | Scaffold a `.agentctx/` from the template. |

Pack output gained a `risk: { level, mode, signals }` field; the compiler source
list is `constraints, identity, direction, projects, decisions, architecture,
agent-roles, glossary, cq` with only `constraints.md` always-included.

---

## Backward-compatibility guarantees held through Phase 2

- A minimal project shipping only `constraints.md` still validates and compiles.
- Safe tasks compile to the same selection they did before task-risk modes.
- Files absent from a project's `.agentctx/` contribute no blocks.

---

## Verification at Phase 2 tip

Full agentctx suite: **17 test files / 110 tests pass**, with no regressions to
the relevance-scoring (`agentctx-proof`) or MCP (`agentctx-mcp`) suites.

---

## Handoff to Phase 3

Phase 3 (multi-client distribution: Claude Code / Codex / Cursor setup proofs,
thin HTTP connector, manifests) can rely on:

- a stable nine-file source contract with per-file schemas,
- an executable validator and a metrics tool for CI gating,
- risk-aware compilation that never drops safety context on destructive tasks.

No open schema decisions block Phase 3. Remaining Phase 2 plan rows (none) are
complete.
