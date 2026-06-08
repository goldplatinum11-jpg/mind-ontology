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
RAG store, or another static instruction file. It is a personal operating
ontology for AI agents: a curated meaning system plus the rules that decide
which context an agent receives for a specific task.

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

- OSS: MCP server, schema, `.agentctx/` source layout, `get_context(task)`, and
  `list_constraints()`.
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
- one source of truth instead of maintaining `CLAUDE.md`, `AGENTS.md`, and
  editor rules separately;
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

The autonomous development plan for turning this prototype into an open-core
product is defined in
[`docs/operator/mind-ontology-autonomous-development-plan-v0.md`](operator/mind-ontology-autonomous-development-plan-v0.md).

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
