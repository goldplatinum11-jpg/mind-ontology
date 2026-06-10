# Mind Ontology — Commercial Positioning v0

**Status:** Phase 5 / P5-PR07 (launch readiness) · updated for the emit
compile-target strategy (Workbench W10; operator-approved per the
[design packet](mind-ontology-workbench-design-v1.md) Q2/Q3)

How Mind Ontology is positioned as **open-core**: a genuinely useful free OSS
layer, with an optional hosted layer (SIRT) for teams that want managed memory.
The free layer is not crippleware — it stands on its own.

---

## The line

| | Free OSS layer (Mind Ontology) | Hosted layer (SIRT) |
|---|---|---|
| What | `.agentctx/` schema, compiler, MCP server, `emit` compile targets + drift check, multi-client setup, thin connector contract | managed memory retrieval, writeback execution, multi-tenant, graph, autonomy/council |
| Runs | locally, file-based, no account | operator-hosted or vendor-hosted service |
| Cost | free, forever | paid (you host, or a managed plan) |
| Trust | fully auditable; just files | operator/vendor-owned data plane |

The rule: **anything local and file-based is free; anything that requires
running a service, storing data, or isolating tenants is the hosted layer.**

---

## The adoption wedge: emit — static files as targets, not sources

The sharpest free-layer pitch is no longer "stop using static instruction
files" — it is **"stop hand-writing them; compile them."**
`mind-ontology emit` compiles the ontology into the per-tool static artifacts
users already maintain by hand (`AGENTS.md`, `CLAUDE.md`), each with a
fingerprint header, and `emit --check` fails CI the moment an artifact drifts
from its sources (see the [emit target spec](workbench-w1-emit-target-spec.md)).

Why this wedge matters commercially:

- **Zero-MCP on-ramp.** The minimum viable adoption drops from "wire an MCP
  server" to "run one command, get a better AGENTS.md than you'd write by
  hand". Value lands before any agent config changes; MCP becomes the
  *upgrade* (live, task-scoped), not the entry fee.
- **It fixes a pain users already have** — N hand-synced instruction files —
  mechanically, even for users who never adopt MCP.
- **It is free by the standing rule**, deliberately: emit is local and
  file-based, so charging for it would break the boundary rule and the
  no-crippleware commitment (option C was considered and rejected in the
  [Workbench design packet](mind-ontology-workbench-design-v1.md), A5).

The paid counterpart is not the feature itself but its **team-scale
extension**: every teammate's agents compiling from the same synced ontology,
org policy overlays, fleet-wide drift observability. The hosted distribution
story is a natural extension of the free emit feature, not a fence around it.

---

## Why open-core fits here

1. **Trust is the product.** Agents act on this context, so the layer they
   depend on must be small and auditable. That argues for a free, file-based
   core that anyone can read in a PR.
2. **The adoption wedge is a one-liner.** "Call `get_context(task)` at task
   start." Once multiple agents share one ontology, the value compounds — and
   the natural next want (shared/team memory across machines) is exactly the
   hosted layer.
3. **The on-ramp is opt-in, not a wall.** Hosted features are fail-closed and
   reversible (Phase 4). Nobody is forced across the line to keep using the free
   layer.

---

## What stays free forever

- The source schema and the local compiler.
- `get_context` / `list_constraints` and the local stdio MCP server.
- `mind-ontology emit` — compiling `AGENTS.md` / `CLAUDE.md` as deterministic
  build artifacts — and the `emit --check` CI drift gate.
- Multi-client setup (Claude Code, Codex, Cursor) and the thin-connector
  contract for self-hosting ChatGPT / Claude.ai access.
- Validation, metrics, and risk-aware compilation.

A team can run all of this with no account and no payment, indefinitely.

---

## What the hosted layer adds (paid)

- Shared, durable memory across machines and teammates.
- Team-wide distribution of the meaning layer: a shared, synced ontology that
  every member's agents compile from (the team-scale extension of free emit).
- Retrieval enrichment and writeback **execution** (the OSS layer only proposes).
- Multi-tenant isolation, identity, and managed auth.
- The deeper SIRT graph, council, and autonomy features.

---

## Honesty commitments

- No crippleware: the free layer is fully functional standalone.
- No surprise lock-in: ontology source files are plain Markdown you own and can
  take anywhere.
- No hidden data flow: the free layer makes no network calls; hosted calls
  happen only behind an explicit, default-off flag.

See the license boundary and trust & security docs for the legal and technical
backing of these claims.
