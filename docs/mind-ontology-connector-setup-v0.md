# Mind Ontology — Hosted Connector Setup & Troubleshooting v0

**Status:** Phase 3 (multi-client distribution) · operator guide · **no live endpoint**

This is the operator-facing setup and troubleshooting guide for the self-hosted
connector that lets hosted chat clients reach your Mind Ontology context. The
repo **hosts nothing** and publishes no endpoint; every host below is the
placeholder `https://YOUR-CONNECTOR-HOST.example`, which you replace with your own
deployed endpoint in your client's UI — never in a committed file.

## Two surfaces, one ontology

Both surfaces serve the **same** two read-only tools (`get_context`,
`list_constraints`) from the **same** bundled `.agentctx` snapshot. Pick by client:

| Surface | Path(s) | For | Output |
|---|---|---|---|
| **GPT Action** (HTTP JSON) | `POST /get_context`, `POST /list_constraints`, `GET /health` | ChatGPT custom GPT (classic Action) | JSON only — a stable request/response contract |
| **Remote MCP** (Streamable-HTTP JSON-RPC) | `POST /mcp` | Claude.ai custom connector, ChatGPT developer-mode MCP | tool result; `get_context` honors `format: markdown` or `json` |

The GPT Action surface is deliberately JSON-only. The remote MCP surface speaks
`initialize`, `notifications/initialized`, `tools/list`, and `tools/call`, and
negotiates the protocol version (it echoes a supported requested version, else
returns a broadly-compatible one).

## Which surface do I use?

Pick by where you run the AI, then follow the matching setup path:

| Your client | Surface | How it connects | What to do |
|---|---|---|---|
| Claude Code, Codex, Cursor (local coding agents) | local **stdio MCP** | the agent starts the MCP server on your own machine | **Not this guide.** Run `mind-ontology agent-setup --target <client>` locally; no hosting needed. |
| **Claude.ai** (web) | **remote MCP** (`/mcp`) | add a custom connector pointing at your hosted endpoint | This guide → deploy → paste the Claude.ai connector. |
| **ChatGPT** developer mode | **remote MCP** (`/mcp`) | add an MCP server in developer mode | This guide → deploy → paste the ChatGPT MCP connector. |
| **ChatGPT** classic custom GPT | **GPT Action** (HTTP JSON) | import the OpenAPI file as a GPT Action | This guide → deploy → import the OpenAPI. |

If you only use local coding agents, you do **not** need to deploy anything — the
hosted connector exists only to reach the web chat clients above.

## Setup — the exact order

You do this once. Step 2 (deploy) is a developer task; if you are not comfortable
with the command line, hand steps 1–2 to a developer and do step 3 yourself in your
chat client's settings UI.

1. **Build a snapshot** of your project's `.agentctx/`, then **smoke it locally** —
   no Cloudflare, no account needed. The exact commands are in the connector
   package's own guide: [`connector/worker/README.md`](../connector/worker/README.md).
2. **Deploy the Worker** from `wrangler.toml.example` (operator step; out of scope
   for this repo). If your workspace is private, set the bearer token as a Worker
   secret — never type it into a committed file.
3. **Add the connector to your chat client** using the example manifest for your
   client, replacing the placeholder host with the endpoint from step 2 — in the
   client's settings UI, not in any committed file:
   - [Claude.ai custom connector](agentctx-setup/claude-ai-connector.example.json)
   - [ChatGPT developer-mode MCP](agentctx-setup/chatgpt-connector.example.json)
   - [ChatGPT GPT Action (OpenAPI)](agentctx-setup/mind-ontology-connector.openapi.json)

See also the [connector manifests guide](mind-ontology-connector-manifests-v0.md),
the [HTTP endpoint design](mind-ontology-http-endpoint-design-v0.md), and the
[self-host deployment plan](mind-ontology-selfhost-deployment-plan-v0.md).

## What to paste into your client's UI

Everything below uses the placeholder `https://YOUR-CONNECTOR-HOST.example`.
Replace it with your own endpoint from step 2. Never paste a real bearer token
into a committed file — only into the client's own auth field.

- **Claude.ai** → Settings → Connectors → **Add custom connector**. Use the values
  from [`claude-ai-connector.example.json`](agentctx-setup/claude-ai-connector.example.json):
  transport `streamable-http`, URL `https://YOUR-CONNECTOR-HOST.example/mcp`. If
  your endpoint is private, put the bearer in Claude.ai's auth field — not in the JSON.
- **ChatGPT (developer mode)** → add an MCP server with
  [`chatgpt-connector.example.json`](agentctx-setup/chatgpt-connector.example.json):
  `server_url` `https://YOUR-CONNECTOR-HOST.example/mcp`, `allowed_tools`
  `["get_context","list_constraints"]`.
- **ChatGPT (classic custom GPT)** → GPT editor → Actions → **Import** the OpenAPI
  [`mind-ontology-connector.openapi.json`](agentctx-setup/mind-ontology-connector.openapi.json),
  then set the server URL to your endpoint.

After adding the connector, your client should list the two tools (`get_context`,
`list_constraints`). If they do not appear, see Troubleshooting below.

## Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| **401** `unauthorized` | The Worker has `CONNECTOR_BEARER_TOKEN` set, but the request's `Authorization: Bearer <token>` is missing or wrong. | Send the matching bearer in your client's connector auth field, or unset the token for a public dev endpoint. |
| **404** `not_found` | The path is not one of `/health`, `/get_context`, `/list_constraints`, `/mcp`. | Point the client at the correct path. For MCP, the connector URL ends in `/mcp`. |
| **405** `method_not_allowed` | A non-`POST` request hit `/mcp`. | The remote MCP transport accepts `POST` JSON-RPC only. |
| **Protocol mismatch** | The MCP client requested a `protocolVersion` the server does not support (or sent an unsupported `MCP-Protocol-Version` header — that returns `400`). | At `initialize` the server replies with a protocol version it supports; a client that does not support that version **may disconnect**. Use a client/version the server supports (currently `2025-06-18`, `2025-03-26`, `2024-11-05`). |
| **Malformed JSON** | The body was not valid JSON. | On `/mcp` the server returns a JSON-RPC `-32700` parse error; on the GPT Action endpoints it returns `400`. Send a valid JSON body. |
| **Empty / `202` on a notification** | `notifications/initialized` (and other notifications) return `202` with no body, by design. | Expected; not an error. |
| **No tools showing up** | The client connected but `tools/list` returned nothing it could use — usually the connector URL is wrong (missing `/mcp`), auth failed silently, or the client cached an old session. | Confirm the URL ends in `/mcp`, re-check the bearer, then remove and re-add the connector. `GET /health` on the endpoint should return `{ ok: true }`. |

## What never lives in this repo

- No real endpoint URL — manifests use `https://YOUR-CONNECTOR-HOST.example`.
- No credential / bearer value — the operator sets it as a Worker secret.
- No live deploy — hosting is operator-gated and out of scope here.
