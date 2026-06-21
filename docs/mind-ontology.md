# Mind Ontology

Mind Ontology is the product surface for a personal meaning layer that AI
agents can share across tools.

It gives ChatGPT, Claude Code, Codex, Cursor, and other MCP clients the same
portable understanding of a user's identity, direction, vocabulary,
constraints, current projects, and agent operating rules.

```text
Product surface:
  Mind Ontology

Core engine:
  SIRT memory, graph, retrieval, writeback, and control-plane semantics

Execution compiler:
  agentctx context packs for task-scoped AI injection
```

The important distinction is that Mind Ontology is not a generic note app, a
RAG store, or another hand-written static instruction file. It is a personal
operating ontology for AI agents: a curated meaning system plus the rules that
decide which context an agent receives for a specific task. Static instruction
files (`AGENTS.md`, `CLAUDE.md`) are not competitors to this layer — they are
its **compile targets**: `mind-ontology emit` builds them from the same
ontology, and `emit --check` fails CI when they drift from it
(["static files as targets, not sources"](workbench-w1-emit-target-spec.md)).

---

## Documentation map

Start here, then follow the path that matches what you're doing.

### For users (run it locally)

- [Top-level README](../README.md) — product surface and 60-second start.
- [Quickstart](mind-ontology-quickstart.md) — install-first local flow.
- [Quickstart examples](mind-ontology-quickstart-examples-v0.md) — concrete runs.
- [Competency Questions schema](mind-ontology-cq-schema-v0.md) — the verification core.
- [How the compiler scores blocks](how-scoring-works.md) — why a block is in or out.
- [Concepts](concepts.md) — the product's own vocabulary.
- [Task risk modes](mind-ontology-task-risk-modes-v0.md) — fail-closed guardrails.
- [Emit target spec](workbench-w1-emit-target-spec.md) — compile `AGENTS.md` / `CLAUDE.md` (default) plus, on demand via `--target`, a `cursor` `.mdc` and a ChatGPT/Claude.ai paste-block; headers, drift classes, CI recipe.
- [Operator CLI spec](workbench-w2-cli-spec.md) — `emit` flags, exit codes, and JSON shapes.
- [CLI error reference](cli-errors.md) — every failure mode and its fix.

### Client setup

The product contract is the same two tools — `get_context(task)` and
`list_constraints()` — across every agent. Setup pages stay thin:

- [Claude Code setup proof](mind-ontology-claude-code-setup-proof-v0.md)
- [Codex setup proof](mind-ontology-codex-setup-proof-v0.md)
- [Cursor setup proof](mind-ontology-cursor-setup-proof-v0.md)
- [MCP setup](agentctx-mcp-setup.md) · [MCP server reference](agentctx-mcp.md)
- [Connector manifests](mind-ontology-connector-manifests-v0.md) · [thin connector strategy](mind-ontology-thin-connector-strategy-v0.md)
- [Hosted connector setup & troubleshooting](mind-ontology-connector-setup-v0.md) — operator guide for the GPT Action / remote MCP surfaces (no live endpoint)

### Autopilot integration (for AI development lines)

The [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md) makes Mind
Ontology easy for autonomous agent lines to consume — local-first, no hosted SIRT.

- [Autopilot pack frame](mind-ontology-autopilot-pack-v1.md) — what it is, who uses it, the SIRT Brain / SIRT Runway boundary.
- [Reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) — when each agent calls `get_context` / `list_constraints`.
- [Stop policy](mind-ontology-autopilot-stop-policy-v1.md) — valid vs invalid terminal stop conditions.
- [Adoption walkthrough](mind-ontology-autopilot-adoption-v1.md) — copy-paste wiring, step by step.
- [Quickstart run](mind-ontology-autopilot-quickstart-run-v1.md) — worked compile runs, including the wrong-axis non-dump.
- [Autopilot concepts](mind-ontology-autopilot-concepts-v1.md) — line/runway vocabulary mapped onto the [product concepts](concepts.md).
- [Result Pack shape](mind-ontology-autopilot-result-pack-v1.md) — the locally-checkable worker→controller handoff.
- [Risk modes](mind-ontology-autopilot-risk-modes-v1.md) — automatic safety forcing on risky lane steps.
- [Controller checklist](mind-ontology-autopilot-controller-checklist-v1.md) — mechanical review before approve/commit.
- [Worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md) — faithful reporting before a checkpoint.
- [Failure modes](mind-ontology-autopilot-failure-modes-v1.md) — what breaks when a line skips the protocol, and how it's contained.
- [Minimal vs full ontology](mind-ontology-autopilot-minimal-vs-full-v1.md) — `constraints.md`-only line vs the nine-file line.
- [Two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md) — the exact read-only surface a line depends on.
- [Scope discipline](mind-ontology-autopilot-scope-discipline-v1.md) — keeping every edit inside the allowed write scope.
- [Checkpoint cadence](mind-ontology-autopilot-checkpoint-cadence-v1.md) — when to checkpoint, and why a checkpoint is not a stop.
- [Result Pack walkthrough](mind-ontology-autopilot-result-pack-walkthrough-v1.md) — an annotated, field-by-field example.
- [Portability across clients](mind-ontology-autopilot-portability-v1.md) — one constitution feeds every agent the same way.
- [Safe continuation](mind-ontology-autopilot-safe-continuation-v1.md) — why a runway optimizes for continuation, not stopping.
- [Glossary tie-in](mind-ontology-autopilot-glossary-tie-in-v1.md) — every autopilot term, with a source link.
- [Two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md) — why a small read-only surface is the trustable one.
- [Connector parity](mind-ontology-autopilot-connector-parity-v1.md) — the thin connector mirrors exactly the two tools.
- [Trust tie-in](mind-ontology-autopilot-trust-tie-in-v1.md) — how the pack inherits the product trust posture.
- [Why local-first](mind-ontology-autopilot-why-local-first-v1.md) — why a line runs on local files, not a hosted service.
- [Operator FAQ](mind-ontology-autopilot-operator-faq-v1.md) — pre-wiring questions, each answered from a local artifact.
- [Lane lifecycle](mind-ontology-autopilot-lane-lifecycle-v1.md) — open → work → checkpoint → handoff → close.
- [Autopilot vs single-shot](mind-ontology-autopilot-vs-single-shot-v1.md) — why a runway differs from a one-shot agent.
- [Why two roles](mind-ontology-autopilot-two-roles-v1.md) — why worker and controller are separate agents.
- [Common mistakes](mind-ontology-autopilot-common-mistakes-v1.md) — a one-line-each quick reference.
- [Pack versioning](mind-ontology-autopilot-versioning-v1.md) — the `-v1` convention and what a v2 would change.
- [Pack non-goals](mind-ontology-autopilot-non-goals-v1.md) — what the pack deliberately does not do.
- [Extending the pack](mind-ontology-autopilot-extending-v1.md) — the contributor checklist the guards enforce.
- [vs per-tool instruction files](mind-ontology-autopilot-vs-instruction-files-v1.md) — one constitution replaces N drifting `CLAUDE.md`/`AGENTS.md` files.
- [Pack changelog](mind-ontology-autopilot-changelog-v1.md) — append-only summary of what landed in v1.
- [Cost model](mind-ontology-autopilot-cost-model-v1.md) — the free local path has no per-call cost.
- [Observability](mind-ontology-autopilot-observability-v1.md) — the Result Pack + guard tests are the line's observability.
- [One-line instruction](mind-ontology-autopilot-one-line-instruction-v1.md) — the canonical two-sentence agent instruction.
- [Tool-call ordering](mind-ontology-autopilot-tool-call-ordering-v1.md) — the within-step sequence of the two calls.
- [Empty-ontology behavior](mind-ontology-autopilot-empty-ontology-v1.md) — what a bare constraints-only line does.
- [Maturity self-audit](mind-ontology-autopilot-maturity-audit-v1.md) — the structural guarantees the pack enforces.
- [Adopting incrementally](mind-ontology-autopilot-adopting-incrementally-v1.md) — the safe one-file-at-a-time on-ramp.
- [Guard glossary](mind-ontology-autopilot-guard-glossary-v1.md) — each structural guard explained in one line.
- [When NOT to use](mind-ontology-autopilot-when-not-to-use-v1.md) — the honest boundary of the pack's usefulness.
- [Pack principles](mind-ontology-autopilot-principles-v1.md) — the six principles every artifact embodies.
- [One-paragraph pitch](mind-ontology-autopilot-pitch-v1.md) — the whole pack in a paragraph.
- [Reviewer quickstart](mind-ontology-autopilot-reviewer-quickstart-v1.md) — review a Result Pack in five minutes.
- [Contributor FAQ](mind-ontology-autopilot-contributor-faq-v1.md) — quick answers before your first PR.
- [Onboarding a new client](mind-ontology-autopilot-onboarding-client-v1.md) — add a 4th/5th agent in three steps.
- [Principles applied](mind-ontology-autopilot-principles-applied-v1.md) — the six principles in one worked lane.
- [Cross-pack consistency](mind-ontology-autopilot-consistency-v1.md) — how the ten guards compose into one closed loop.
- [Line health signals](mind-ontology-autopilot-line-health-v1.md) — healthy vs drifting, read from local artifacts.
- [Reading paths](mind-ontology-autopilot-reading-paths-v1.md) — adopter / reviewer / contributor routes.
- [Quality bar](mind-ontology-autopilot-quality-bar-v1.md) — what "good enough to land" means for an artifact.
- [State of the pack](mind-ontology-autopilot-state-of-pack-v1.md) — what v1 ships, at a glance.
- [Pack at a glance](mind-ontology-autopilot-manifest-v1.md) — one-page manifest of every pack artifact.
- Drop-in kit: `templates/mind-ontology/autopilot/` (blocks, MCP configs, README, example agent prompt).

### For contributors

- [Contributing](../CONTRIBUTING.md) · [Release checklist](../RELEASE-CHECKLIST.md)
- [Testing & the four gates](testing.md)
- [Schema authoring guide](schema-authoring.md) · [Packaging (dry-run plan)](packaging.md)
- [Worked examples](examples/README.md)
- [Contribution guide plan](mind-ontology-contribution-guide-plan-v0.md)
- [Versioning & release checklist](mind-ontology-versioning-release-checklist-v0.md)
- [Schema validation](mind-ontology-schema-validation-v0.md)
- [Distribution & license boundary](mind-ontology-license-boundary.md) · [decision state](../LICENSE-DECISION.md)

### Architecture & boundary

- [Workbench v1 design packet](mind-ontology-workbench-design-v1.md) — the human-facing operator surface; the CLI track (`status`, `preview`, `cq`, `emit`, `review`) is shipped and guarded.
- [Emit target spec (W1)](workbench-w1-emit-target-spec.md) · [operator CLI spec (W2)](workbench-w2-cli-spec.md) — the shipped Workbench contract consumed by the engine scripts.
- [Typed edge model](mind-ontology-typed-edge-model-v0.md)
- [Adapter feature flags](mind-ontology-adapter-feature-flags-v0.md)
- [SIRT memory adapter contract](mind-ontology-sirt-memory-adapter-contract-v0.md)
- [SIRT writeback proposal contract](mind-ontology-sirt-writeback-proposal-contract-v0.md)
- [Hosted auth / tenant boundary](mind-ontology-hosted-auth-tenant-boundary-v0.md)
- [Trust & security model](mind-ontology-trust-security-model-v0.md)
- [Self-host deployment plan](mind-ontology-selfhost-deployment-plan-v0.md) (planned, no deploy executed)

### Provenance (read-only history)

- [Extraction inventory](../EXTRACTION-INVENTORY.md) · [extraction map](mind-ontology-extraction-map.md)
- [Phase A runbook](agentctx-phase-a-runbook.md) — historical/excluded control-plane.

---

## Product promise

```text
Mind Ontology
Your portable meaning layer for AI agents.
```

For operators:

```text
Give every AI the same understanding of your language, decisions, constraints,
projects, and current direction.
```

For developers:

```text
Personal ontology + operational policy + scoped context compiler for AI agents.
```

---

## Layer model

| Layer | Role | This repo artifact |
|---|---|---|
| Mind Ontology MCP | OSS product and adoption surface | `.agentctx/`, `scripts/agentctx/`, `docs/agentctx*.md` |
| SIRT hosted | Paid memory, graph, council, writeback, control plane | SIRT memory and runner stack |
| agentctx | Local compiler and MCP adapter | `scripts/agentctx/compile.mjs`, `scripts/agentctx/mcp-server.mjs` |

Mind Ontology should be presented externally. SIRT remains the deeper platform.
agentctx remains the repo-local implementation mechanism that turns ontology
source files into task-scoped context packs.

---

## Open-core distribution

Mind Ontology should use an open-core split, not a false choice between OSS,
SaaS, and one-time sales.

The OSS layer is the Mind Ontology MCP server and ontology schema. Users run it
in their own environment: local stdio MCP first, and later self-hosted Workers
or another HTTP transport if that becomes the right distribution path. The
operator does not pay for OSS users' infrastructure; self-hosted runtime cost
belongs to the user running the server.

The hosted layer is SIRT. That is where durable memory, graph storage, vector
retrieval, cross-agent persistence, writeback, typed edges, and autonomous
control-plane behavior live. Mind Ontology is the on-ramp: useful on its own as
a shared meaning layer, and more powerful when connected to hosted SIRT.

The boundary is deliberate:

- OSS: MCP server, schema, `.agentctx/` source layout, `get_context(task)`,
  `list_constraints()`, and the `emit` compile targets with their drift check
  (local and file-based, so free by the standing boundary rule).
- Hosted SIRT: persistent memory graph, retrieval, writeback, multi-tenant
  storage, automation history, and cross-agent learning.
- Not v0: a closed black-box MCP that developers must trust without source, or
  a custom hosted backend that makes every OSS user depend on the operator's
  cloud bill.

This keeps trust and adoption in the open layer while keeping value capture in
the hosted memory layer.

---

## What belongs in Mind Ontology

Mind Ontology v0 should start small and operational:

- Identity: who the operator is and what role the AI should assume around them.
- Direction: what the operator is trying to build now.
- Projects: active products, repos, runways, and business contexts.
- Vocabulary: terms such as runway, lane, stage, closeout, writeback, SIRT, and agentctx.
- Constraints: what AI may do, must not do, and when it must fail closed.
- Agent roles: what ChatGPT, Claude Code, Codex, Cursor, and other agents are for.
- Context compiler: how to emit the right subset for a given agent and task.

The context compiler is the difference between a product and a profile file.
Without scoped output, the ontology becomes another long document. With scoped
output, it becomes infrastructure that every AI client can use.

---

## What not to build first

Do not start with a large philosophical ontology, a graph database, a custom UI,
or a full RDF/OWL implementation. Those can become adapters and exports after
the operating model proves value.

The first useful unit is:

```text
human-curated ontology source -> task-specific context pack -> AI agent action
```

That keeps the product legible while leaving room for future JSON-LD, RDF, SKOS,
SHACL, SIRT graph adapters, and automatic update proposals.

---

## Free-layer behavior

The free OSS layer should already be useful without hosted SIRT. A user installs
the repo-local ontology source and MCP server, then adds one instruction to each
agent:

```text
At task start, call get_context(task). Before destructive or structural changes,
call list_constraints().
```

That creates immediate value:

- cross-AI consistency across Claude Code, Codex, ChatGPT-compatible clients,
  Cursor, and other MCP clients;
- one source of truth instead of hand-maintaining `CLAUDE.md`, `AGENTS.md`, and
  editor rules separately — and where a tool *needs* a static file,
  `mind-ontology emit` compiles it from that source and `emit --check` keeps it
  provably fresh;
- queryable guardrails that agents can check before acting;
- smaller context packs because the compiler returns task-relevant blocks
  instead of dumping every rule.

The natural limit is also clear. The OSS file layer is mostly read-oriented and
git-native. It does not automatically grow durable memory from every session,
link similar prior decisions, infer typed graph relations, or persist learning
across all agents. Those limits become the hosted SIRT upgrade path.

---

## Relationship to Microsoft IQ and Palantir Ontology

Microsoft IQ-style systems organize enterprise knowledge and work signals inside
the Microsoft ecosystem. Palantir Ontology makes organizational objects,
properties, links, actions, and permissions operational.

Mind Ontology occupies a different layer:

- personal, not only enterprise;
- cross-agent, not vendor-specific;
- portable, not trapped in one AI client;
- action-aware, not just descriptive;
- explicit about constraints, agent roles, and stop conditions.

The closest pattern is a personal, AI-agent-oriented operational ontology:
meaning plus action policy, compiled into the form each AI tool can use.

---

## Development runway

The autonomous development plan that drove this work
(`docs/operator/mind-ontology-autonomous-development-plan-v0.md`) was **SIRT
control-plane material and was deliberately excluded** from the standalone
extraction — see [`EXTRACTION-INVENTORY.md`](../EXTRACTION-INVENTORY.md). It is
not shipped here and is not required to use the product. Long-running worker
lanes use the Claude Code interactive `/loop` transport described below.

The public-facing OSS product README draft is
[`docs/mind-ontology-mcp-readme.md`](mind-ontology-mcp-readme.md). It defines
the adoption promise, free-layer behavior, hosted SIRT boundary, source layout,
quickstart, and long-run slash-loop expectation.

The standalone package boundary and future extraction sequence are defined in
[`docs/mind-ontology-extraction-map.md`](mind-ontology-extraction-map.md).

The OSS license recommendation and hosted SIRT commercial boundary are defined
in [`docs/mind-ontology-license-boundary.md`](mind-ontology-license-boundary.md).

The local stdio MCP quickstart is defined in
[`docs/mind-ontology-quickstart.md`](mind-ontology-quickstart.md).

Long-running worker lanes should use the Claude Code interactive `/loop`
transport (`claude_code_interactive_slash_loop`). Non-interactive `claude -p`
does not process slash commands and is not the right transport for a seven-hour
slash-loop runway.
