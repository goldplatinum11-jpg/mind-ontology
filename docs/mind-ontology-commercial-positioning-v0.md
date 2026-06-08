# Mind Ontology — Commercial Positioning v0

**Status:** Phase 5 / P5-PR07 (launch readiness)

How Mind Ontology is positioned as **open-core**: a genuinely useful free OSS
layer, with an optional hosted layer (SIRT) for teams that want managed memory.
The free layer is not crippleware — it stands on its own.

---

## The line

| | Free OSS layer (Mind Ontology) | Hosted layer (SIRT) |
|---|---|---|
| What | `.agentctx/` schema, compiler, MCP server, multi-client setup, thin connector contract | managed memory retrieval, writeback execution, multi-tenant, graph, autonomy/council |
| Runs | locally, file-based, no account | operator-hosted or vendor-hosted service |
| Cost | free, forever | paid (you host, or a managed plan) |
| Trust | fully auditable; just files | operator/vendor-owned data plane |

The rule: **anything local and file-based is free; anything that requires
running a service, storing data, or isolating tenants is the hosted layer.**

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
- Multi-client setup (Claude Code, Codex, Cursor) and the thin-connector
  contract for self-hosting ChatGPT / Claude.ai access.
- Validation, metrics, and risk-aware compilation.

A team can run all of this with no account and no payment, indefinitely.

---

## What the hosted layer adds (paid)

- Shared, durable memory across machines and teammates.
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
