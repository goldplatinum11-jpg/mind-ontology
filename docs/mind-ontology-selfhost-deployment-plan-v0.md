# Mind Ontology — Self-Hosted Connector Deployment Plan v0

**Status:** Phase 3 / P3-PR06 (multi-client distribution) — original deployment
plan, updated after the hosted connector source landed
**Builds on:** [`mind-ontology-http-endpoint-design-v0.md`](mind-ontology-http-endpoint-design-v0.md)
and [`agentctx-setup/mind-ontology-connector.openapi.json`](agentctx-setup/mind-ontology-connector.openapi.json)

This is a **deployment plan**, not a deployment. It describes how an operator
self-hosts the thin connector so ChatGPT / Claude.ai can reach their ontology.
The repository now includes the connector source under `connector/worker/`, but
still includes no real deployment config, no live endpoint, and no credentials.

> **Deployment is still operator-owned.** `connector/worker/` provides source,
> tests, and placeholder examples only. No real `wrangler.toml`, deploy command,
> secret, endpoint URL, or env binding is added or changed by this repository.
> The OSS project hosts nothing and pays for no one's traffic.

---

## What gets deployed (conceptually)

A small, stateless HTTP handler that wraps the **existing** compile contract:

```text
HTTP request ── thin handler ──> compileFromCwd / list_constraints handler
   (POST /get_context, /list_constraints, /mcp)        (scripts/agentctx, unchanged)
```

The handler adds transport only. It imports the compile/MCP handlers verbatim,
so it cannot diverge from the local stdio server the setup proofs cover.

---

## Option A — Cloudflare Worker (recommended for hosted chat clients)

A Worker is a good fit: globally reachable HTTPS, no server to run, cheap at low
volume.

**Plan (operator executes later, not in this repo):**

1. New, separate Worker project (out of this OSS repo, or a clearly-scoped
   `connector/` package added under its own reviewed PR).
2. Route the three POST paths to the shared handlers:
   - `POST /get_context`, `POST /list_constraints` (GPT Action surface);
   - `POST /mcp` (JSON-RPC: `initialize` / `tools/list` / `tools/call`).
3. Ship the `.agentctx/` workspace with the Worker (bundled asset) or read it
   from a binding (e.g. KV/R2). One Worker serves one workspace.
4. Auth: if the workspace is private, require a bearer the **operator** sets as a
   Worker secret (`wrangler secret put …` by the operator, never committed).
5. CORS: allow the hosted client origins that need browser access; deny others.
6. Publish; put the resulting URL into the OpenAPI `servers[0].url` and the
   client connector config.

**Explicitly out of scope of this repository:** a real `wrangler.toml`, running
`wrangler deploy`, committing endpoint URLs, or storing any secret.

---

## Option B — Node / any host

Any host that can run Node and expose HTTPS works:

1. A tiny HTTP server that parses JSON bodies and calls the same handlers.
2. Set `AGENTCTX_HOME` to the workspace path.
3. Terminate TLS (reverse proxy) and add the operator's own auth if needed.

Same contract, same read-only surface.

---

## Operating rules for any deployment

- **Read-only.** Expose only `get_context` and `list_constraints`. No writeback,
  graph, or mutation endpoints. Unknown routes return `404` / JSON-RPC
  `method not found`.
- **Stateless.** Compile fresh per request; keep no cross-request memory.
- **No committed credentials.** URLs and bearers live in the operator's
  environment / secret store. This repo holds placeholders only.
- **One workspace per deployment.** Multi-tenant / hosted-memory concerns are
  Phase 4, behind an explicit adapter contract.
- **Rate-limit** at the edge if the endpoint is public.

---

## Pre-flight checklist (operator)

- [ ] Endpoint serves only the two read operations.
- [ ] `.agentctx/` workspace contains no credentials (run `npm run agentctx:validate`).
- [ ] Auth decision made (public dev vs operator bearer).
- [ ] `servers[0].url` in the OpenAPI replaced with the real URL.
- [ ] No secret committed to any repo.

---

## Handoff

- **P3-PR07** — example connector manifests (GPT Action import + Claude.ai
  connector) using placeholders that point at *this* design, no secrets.
- **P3-PR08** — multi-client adoption closeout.

## PR1 implementation note (snapshot adapter)

The hosted connector's first implementation lands in `connector/worker/` as a
**bundled snapshot adapter**. Because a Cloudflare Worker has no filesystem, the
engine's `readAgentctx` cannot run there; instead, at deploy time the connector's
snapshot build step (under `connector/worker/`) serializes a project's
`.agentctx/` into a JSON snapshot, and the Worker serves `get_context` /
`list_constraints` from that snapshot — read-only, no second compiler.

PR1 implements only the GPT-Action HTTP JSON surface (`POST /get_context`,
`POST /list_constraints`, `GET /health`) plus a `wrangler.toml.example` template.
Remote MCP `/mcp`, real deploy, KV/R2/GitHub sourcing, multi-workspace hosting,
and any bearer/secret value stay out of scope and are never committed. The
runtime source is now present, but production operation remains outside this
repository until an operator explicitly deploys it.
