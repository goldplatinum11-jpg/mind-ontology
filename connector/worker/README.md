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
   Action `/get_context`. Exit `0` = healthy. This is **local-only** — it never
   leaves the process (see [Local-only vs remote-ready vs remote](#local-only-vs-remote-ready-vs-remote)).

3. **Configure wrangler**: copy `wrangler.toml.example` to `wrangler.toml` and fill
   in your own `name` / account / route. A real `wrangler.toml` must **never** be
   committed (it is gitignored).

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

   ```sh
   wrangler deploy
   ```

6. **Remote-smoke the deployed endpoint** — real HTTP against your live host. This
   is the step that proves *remote*, not just *remote-ready*:

   ```sh
   # public endpoint (no bearer):
   node scripts/smoke-remote.mjs --url https://<your-host>

   # private endpoint (bearer required) — pass via env so it never hits your shell history:
   CONNECTOR_BEARER_TOKEN=… node scripts/smoke-remote.mjs --url https://<your-host> --require-auth

   # from the repo root, equivalently:
   npm run smoke:connector:remote -- --url https://<your-host>
   ```

   It hits the real endpoint and checks: `/health` returns ok; `/mcp` `initialize`
   negotiates a protocol version and reports `serverInfo agentctx`; `tools/list`
   exports `get_context` + `list_constraints`; `tools/call get_context` returns
   deterministic context (compiled twice, identical modulo the `Generated:` line);
   `tools/call list_constraints` returns the constraint blocks; and — when a token
   is configured — an **un**authenticated `/mcp` is rejected `401`. The token value
   is never printed (only `<set>` / `<none>`). Exit `0` = the deployed connector is
   live and correct.

   With no `--url` (or `--dry-run`) it runs the same checks in-process over the
   example snapshot (public + guarded passes) — a network-free self-test, not proof
   of a deployment.

7. **Add the connector** to your client with the example manifests in
   `../../docs/agentctx-setup/` (`claude-ai-connector.example.json`,
   `chatgpt-connector.example.json`, `mind-ontology-connector.openapi.json`).
   Replace the placeholder host `https://YOUR-CONNECTOR-HOST.example` with your
   deployed endpoint in the client UI — not in any committed file.

## ChatGPT connector registration checklist

Do this only **after** step 6's remote smoke is green against your host — a failing
smoke means ChatGPT will fail to connect too. None of this lives in the repo; it is
operator UI configuration.

1. Remote smoke is green against `https://<your-host>` (step 6).
2. In ChatGPT, open **Settings → Connectors → Add / Create** (a remote MCP
   connector; requires a plan/workspace where custom MCP connectors are enabled).
3. Set the **MCP server URL** to `https://<your-host>/mcp` — the `/mcp` path, not
   the bare host. Cross-check the shape against
   `../../docs/agentctx-setup/chatgpt-connector.example.json` (`type: mcp`,
   `server_url` ends `/mcp`, `allowed_tools: [get_context, list_constraints]`).
4. **Auth**: if you set `CONNECTOR_BEARER_TOKEN`, configure the connector with the
   matching bearer; if the endpoint is public, leave auth as none.
5. Save, then let ChatGPT run its own connection/tool-discovery — it should list
   `get_context` and `list_constraints`.
6. In a chat, confirm the model can actually call `get_context` and gets a context
   pack back. **Only when ChatGPT itself returns a tool result is the connector
   "connected" for ChatGPT.** A green remote smoke proves the endpoint; it does
   *not* prove ChatGPT registration.

## Local-only vs remote-ready vs remote

| Stage | What it proves | How |
|---|---|---|
| **local-only** | The connector logic is correct in-process. | `node scripts/smoke-local.mjs` / `node scripts/smoke-remote.mjs --dry-run` — no network. |
| **remote-ready** | The code + deploy config are complete; nothing is deployed yet. | snapshot built, `wrangler.toml` configured, dry-run green. |
| **actual remote** | A deployed endpoint answers correctly over real HTTP. | `node scripts/smoke-remote.mjs --url https://<host>` green. |
| **ChatGPT connected** | ChatGPT itself discovered and called the tools. | the registration checklist above, confirmed in a chat. |

This repo only ever reaches **local-only / remote-ready** on its own. Deploying and
registering are operator steps; do not claim "remote" or "ChatGPT connected" without
the corresponding green check above.

## What never lives in this repo

- No real endpoint URL (manifests use `https://YOUR-CONNECTOR-HOST.example`).
- No credential / bearer value (the operator sets it as a Worker secret).
- No `wrangler.toml` (only `wrangler.toml.example`), no `.dev.vars`, no `.env`.
