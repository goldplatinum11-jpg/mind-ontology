# Mind Ontology — ChatGPT / Claude.ai Thin Connector Strategy v0

**Status:** Phase 3 / P3-PR04 (multi-client distribution) — **strategy / design only**
**Scope:** how hosted chat clients (ChatGPT, Claude.ai) reach the same Mind
Ontology context without changing the OSS core or hosting anyone's secrets.

This document is design only. It defines the connector boundary so the HTTP
endpoint design (P3-PR05) and the self-hosted deployment plan (P3-PR06) have a
fixed contract to build against. **No endpoint, deploy, or secret is added here.**

---

## The problem hosted chat clients create

The local stdio server (used by Claude Code, Codex, Cursor) is launched as a
child process in the user's environment. Hosted chat clients cannot do that:

| Client | How it connects to tools |
|---|---|
| Claude Code / Codex / Cursor | spawn a local **stdio** MCP server |
| Claude.ai | **remote MCP connector** over HTTP (Streamable HTTP / SSE) |
| ChatGPT (developer mode) | **remote MCP** over HTTP |
| ChatGPT custom GPT (classic) | **GPT Action** (OpenAPI over HTTPS) |

So reaching ChatGPT / Claude.ai requires a **network endpoint**, not a local
process. The strategy is to add that endpoint as a *thin transport adapter* over
the existing compile contract — never as a second implementation of the ontology.

---

## Principle: thin transport, unchanged core

```text
.agentctx/ source files
  -> agentctx compiler (unchanged)
  -> get_context(task) / list_constraints()        <-- the contract
       |                                   \
    local stdio server                  thin HTTP adapter
   (Claude Code/Codex/Cursor)        (Claude.ai / ChatGPT)
```

- The thin connector exposes the **same two operations** and nothing else:
  `get_context(task, scope?, format?)` and `list_constraints(format?)`.
- It is **read-only**. No writeback, no graph, no mutation. (Hosted SIRT
  write/enrich features are Phase 4, behind an explicit adapter contract.)
- It reuses `compileFromCwd` / the compile module verbatim — no parallel logic
  that could drift from the local server.

---

## Two thin surfaces, one contract

| Surface | For | Maps to |
|---|---|---|
| Remote **MCP server** (Streamable HTTP) | Claude.ai connectors, ChatGPT developer-mode MCP | `tools/list` → `get_context`, `list_constraints`; `tools/call` → the handlers |
| **GPT Action** (OpenAPI 3.1) | ChatGPT classic custom GPTs | `POST /get_context`, `POST /list_constraints` |

Both surfaces are generated from the same operation definitions. P3-PR05
specifies the HTTP shapes; P3-PR07 ships example connector manifests (no
secrets).

---

## Boundary and safety rules

1. **Self-hosted, BYO endpoint.** The OSS project does not host a shared
   endpoint or pay for anyone's traffic. The operator deploys their own
   (Worker/Node) and supplies their own URL. Publishing the connector code does
   not make the project owner a host.
2. **No credentials in the repo.** The connector ships with config *placeholders*
   only. Endpoint URLs, bearer values, and any auth material live in the
   operator's environment, never committed. (Consistent with the ontology
   no-credential constraint.)
3. **Read-only, fail-closed.** The adapter advertises only the two read
   operations. A request for any other capability returns method-not-found, the
   same as the local server.
4. **Workspace scoping.** A hosted deployment serves one `.agentctx/` workspace
   (its `AGENTCTX_HOME`). Multi-tenant/hosted-memory concerns belong to Phase 4,
   not to this thin connector.
5. **Stateless.** Each call compiles fresh from source files; the connector
   keeps no session memory of its own.

---

## What this is NOT (explicit non-goals for Phase 3)

- Not an authentication/identity system — auth is an operator deployment concern,
  documented as a plan, not implemented here.
- Not hosted SIRT memory, retrieval, or writeback (Phase 4).
- Not a managed multi-tenant service.

---

## Handoff

- **P3-PR05** — HTTP / thin endpoint design (request/response shapes, the MCP and
  GPT-Action mappings).
- **P3-PR06** — self-hosted Worker deployment **plan** (doc only; no real deploy,
  wrangler, or secret config).
- **P3-PR07** — connector manifest examples with placeholders, no secrets.
