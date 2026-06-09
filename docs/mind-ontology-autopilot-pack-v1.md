# Mind Ontology — Autopilot Integration Pack v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

The Autopilot Integration Pack is a small, self-contained bundle of docs, tests,
fixtures, and templates that makes Mind Ontology **easy for AI development lines
to consume automatically** — without a hosted SIRT dependency.

It answers one question for an autonomous agent line: *when, why, and how should
each agent read `.agentctx/` so it reasons on the right axis and stops at the
right boundary?*

---

## What Mind Ontology is (and is not)

Mind Ontology is a **portable semantic constitution** for AI agents: a curated,
file-based source of *what you are doing and why* — identity, direction,
decisions, constraints, projects, roles, vocabulary — plus a **context compiler**
that emits a task-scoped slice of it on demand through two read-only tools,
`get_context(task)` and `list_constraints()`.

It is explicitly **not a memory app**. It does not store conversation history,
grow durable memory from every session, embed a vector store, or persist learning
across agents. Those are hosted-SIRT concerns (see the boundary table below).
Mind Ontology is the *constitution and compiler*; it is read-oriented and
git-native. Calling it a "memory app" mis-frames the product and invites the
wrong-axis reasoning this pack exists to prevent.

The constitution is portable because it is plain Markdown under `.agentctx/` that
any MCP-capable agent can read the same way — Claude Code, Codex, Cursor, and,
through a thin self-hosted connector, ChatGPT and Claude.ai.

---

## Who uses the pack

The pack targets an AI development *line* — multiple cooperating agents — not a
single chat session:

| Role | Agent (example) | How it consumes the pack |
|---|---|---|
| Controller / Planner / Reviewer | Codex | reads `constraints.md` + scoped direction before planning a lane; checks stop policy before approving continuation |
| Worker | Claude Code | calls `get_context(task)` at task start, `list_constraints()` before destructive/structural writes |
| Any MCP client | Cursor, ChatGPT (via connector) | same two-tool surface; no special-casing |

Every agent points at the **same** local MCP entrypoint and sees the **same** two
read-only tools. The pack's job is to make that wiring obvious and to encode
*when* each agent should reach for context, so autopilot lines don't have to
re-derive it.

---

## How it differs from SIRT Brain and SIRT Runway

The pack may *describe* how SIRT Runway uses Mind Ontology, but the local product
must remain self-hosted and portable. The three are distinct layers:

| Layer | What it is | Where it runs | In this pack? |
|---|---|---|---|
| **Mind Ontology** | portable semantic constitution + local context compiler (`.agentctx/`, `get_context`, `list_constraints`) | locally, file-based, no account | **yes** — this is the product |
| **SIRT Brain** | hosted durable memory: graph storage, vector retrieval, typed-edge inference, writeback execution, cross-agent persistence | operator/vendor-hosted service | **no** — described only, never imported |
| **SIRT Runway** | hosted autonomous runner / control plane: lanes, runway sessions, repair judges, result-pack ingestion, watchdogs | operator/vendor-hosted service | **no** — described only, never imported |

The rule the pack holds to: **anything local and file-based is in scope; anything
that requires running a service, storing data, executing writes, or isolating
tenants is hosted SIRT and stays out.** The pack must not import or embed SIRT
runner / control-plane internals. It compiles and ships without any SIRT package,
endpoint, credential, or network call.

---

## What is in the pack

The Autopilot Pack adds, on top of the existing Mind Ontology product surface:

1. **This frame doc** — the productization frame: what the pack is, who uses it,
   and the SIRT Brain / SIRT Runway boundary.
2. **An agent reading protocol** — when each agent should call `get_context` and
   `list_constraints`, expressed so any MCP line can adopt it. See
   [reading-protocol](mind-ontology-autopilot-reading-protocol-v1.md).
3. **Stop-policy and product-boundary context** — so autopilot lines distinguish
   *valid* terminal stops (deploy/secrets/irreversible/forbidden-scope) from
   *invalid* ones (one task done, tests green, no remote) without a human. See
   [stop-policy](mind-ontology-autopilot-stop-policy-v1.md).
4. **Wrong-axis guards** — fixtures and tests that catch an agent reasoning on the
   wrong axis (treating the constitution as memory, or the local layer as hosted).
5. **Templates** — drop-in `.agentctx/` autopilot blocks an adopting line can copy.

Each artifact ships with a guard test so the pack cannot drift from its own claims.

---

## Local-first guarantee

Everything in the pack runs with no account, no database, and no network:

- The compiler reads only local `.agentctx/` Markdown.
- The two tools are read-only and make no outbound calls.
- Hosted SIRT, where mentioned, is an *optional, fail-closed, off-by-default*
  on-ramp — never load-bearing for the pack to function.

This is open-core, not crippleware: the autopilot line works end-to-end on the
free local layer alone. See
[commercial positioning](mind-ontology-commercial-positioning-v0.md) and the
[trust & security model](mind-ontology-trust-security-model-v0.md) for the full
posture, and the [docs index](mind-ontology.md) for everything else.
