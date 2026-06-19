# Mind Ontology hosted connector (Worker)

A thin, self-hosted HTTP connector so hosted chat clients (Claude.ai, ChatGPT) can
reach the same Mind Ontology context as the local stdio MCP server. It serves a
deploy-time **snapshot** of one `.agentctx/` workspace — the Worker has no
filesystem, so it never reads `.agentctx/` directly.

> This package ships **no deploy, no real endpoint URL, and no credential**. Every
> value below is a placeholder. Hosting is the operator's step, done outside this
> repo / under a separately reviewed change.

## Surfaces

- `GET  /health` — liveness probe.
- `POST /get_context`, `POST /list_constraints` — **GPT Action** HTTP JSON
  (JSON-only; stable request/response contract).
- `POST /mcp` — **remote MCP** (Streamable-HTTP JSON-RPC): `initialize`,
  `notifications/initialized`, `tools/list`, `tools/call` for the two tools
  (`get_context`, `list_constraints`). `get_context` honors `format: markdown|json`.

GPT Action and remote MCP are two transports over the **same** snapshot adapter
and the same two read-only tools — see `../../docs/mind-ontology-http-endpoint-design-v0.md`.

## Operator deploy steps (nothing here runs in CI)

1. **Build a snapshot** of your workspace's `.agentctx/`:

   ```sh
   node scripts/build-agentctx-snapshot.mjs --cwd <your-project> --out agentctx.snapshot.json
   ```

   Then point `lib/index.mjs`'s snapshot import at `agentctx.snapshot.json`. The
   committed `agentctx.snapshot.example.json` is only a placeholder for the tests.

2. **Smoke it locally** — no Cloudflare, no network, no deploy:

   ```sh
   node scripts/smoke-local.mjs
   ```

   It runs the connector's request handler in Node against the example snapshot and
   checks `/health`, `/mcp` (`initialize`, `tools/list`, `tools/call`), and the GPT
   Action `/get_context`. Exit `0` = healthy.

3. **Configure wrangler**: copy `wrangler.toml.example` to `wrangler.toml` and fill
   in your own `name` / account / route. A real `wrangler.toml` must **never** be
   committed.

4. **Set the bearer token — only if your workspace is private** — as a Worker
   secret (never commit it):

   ```sh
   wrangler secret put CONNECTOR_BEARER_TOKEN
   ```

   When unset, the connector serves without auth (fine for a public dev endpoint).
   When set, every `/mcp`, `/get_context`, and `/list_constraints` request must
   carry `Authorization: Bearer <token>`.

5. **Deploy** with wrangler. This is operator-gated and out of scope for this repo;
   the repo hosts nothing and pays for no traffic.

6. **Add the connector** to your client with the example manifests in
   `../../docs/agentctx-setup/` (`claude-ai-connector.example.json`,
   `chatgpt-connector.example.json`, `mind-ontology-connector.openapi.json`).
   Replace the placeholder host `https://YOUR-CONNECTOR-HOST.example` with your
   deployed endpoint in the client UI — not in any committed file.

## What never lives in this repo

- No real endpoint URL (manifests use `https://YOUR-CONNECTOR-HOST.example`).
- No credential / bearer value (the operator sets it as a Worker secret).
- No `wrangler.toml` (only `wrangler.toml.example`), no `.dev.vars`, no `.env`.
