# Concepts

The vocabulary of Mind Ontology itself — the product's own terms, not the terms
*you* put in your `.agentctx/glossary.md`. Each entry links to where it is
specified or implemented.

## Source & schema

- **`.agentctx/`** — the folder of Markdown **source files** that hold your
  meaning. The unit of input. See [schema authoring](schema-authoring.md).
- **Source file** — one `.agentctx/*.md` file (constraints, identity, direction,
  projects, decisions, architecture, agent-roles, glossary, cq). All nine are
  compiled; `constraints.md` is required.
- **Block** — a `##` heading plus its body inside a source file. The unit the
  compiler scores and selects.
- **Tag** — an inline `#token` on a block heading. Tags are the strongest scoring
  signal and how `--scope` targets blocks.
- **Constraint / always-included** — a block in `constraints.md`. Every constraint
  is included in every pack (`reason: "always"`); they are never scored away.
- **Competency Question (CQ)** — a question in `cq.md` the ontology must be able
  to answer; the verification core. See [CQ schema](mind-ontology-cq-schema-v0.md).

## Compilation

- **Context pack** — the task-scoped output of the compiler: the selected blocks
  for one task. The unit of output. See [how scoring works](how-scoring-works.md).
- **Scope** — a tag passed as `--scope` to focus a pack; scope matches outscore
  task-word matches at every tier.
- **Scoring** — the deterministic, additive ranking of blocks against the task
  and scope. See [how scoring works](how-scoring-works.md).
- **Risk forcing** — on a destructive/structural task, safety-tagged blocks are
  forced into the pack regardless of score. See [task risk modes](mind-ontology-task-risk-modes-v0.md).
- **agentctx** — the compiler/CLI/MCP implementation label under the Mind Ontology
  product. See the [docs index](mind-ontology.md).

## Surfaces

- **MCP tool** — a callable the local MCP server exposes. There are exactly two,
  both read-only. See [MCP server](agentctx-mcp.md).
- **`get_context(task, scope?)`** — compile a task-scoped pack.
- **`list_constraints()`** — return every constraint block.
- **Thin connector** — the small read-only HTTP surface (OpenAPI) mirroring the
  two tools for hosted clients. See [connector manifests](mind-ontology-connector-manifests-v0.md).

## Hosted boundary (optional, fail-closed)

- **Adapter** — an interface to an optional hosted capability. The OSS layer ships
  contracts and null defaults only.
- **Memory adapter** — read-only retrieval contract; default returns nothing. See
  [memory adapter contract](mind-ontology-sirt-memory-adapter-contract-v0.md).
- **Writeback proposal** — an inert description of a candidate hosted write.
  Proposal-only; there is no execute path in the OSS layer. See
  [writeback proposal contract](mind-ontology-sirt-writeback-proposal-contract-v0.md).
- **Feature flag** — env toggle gating an adapter; **defaults off**. See
  [adapter feature flags](mind-ontology-adapter-feature-flags-v0.md).
- **Fail-closed** — the default behavior when something is missing, off, or
  errors: degrade to the pure local layer, never leak or block. See the
  [trust & security model](mind-ontology-trust-security-model-v0.md).
