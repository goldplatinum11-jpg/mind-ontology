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
returns the latest it supports).

## Setup (three steps)

1. **Build a snapshot** of your project's `.agentctx/` and **smoke it locally** —
   no Cloudflare needed. The exact commands live in the connector package's own
   guide: [`connector/worker/README.md`](../connector/worker/README.md).
2. **Configure and deploy** the Worker from `wrangler.toml.example` (operator
   step, out of scope for this repo). If your workspace is private, set the bearer
   token as a Worker secret — never commit it.
3. **Add the connector** to your client using the example manifests, replacing the
   placeholder host with your endpoint:
   - [Claude.ai custom connector](agentctx-setup/claude-ai-connector.example.json)
   - [ChatGPT developer-mode MCP](agentctx-setup/chatgpt-connector.example.json)
   - [ChatGPT GPT Action (OpenAPI)](agentctx-setup/mind-ontology-connector.openapi.json)

See also the [connector manifests guide](mind-ontology-connector-manifests-v0.md),
the [HTTP endpoint design](mind-ontology-http-endpoint-design-v0.md), and the
[self-host deployment plan](mind-ontology-selfhost-deployment-plan-v0.md).

## Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| **401** `unauthorized` | The Worker has `CONNECTOR_BEARER_TOKEN` set, but the request's `Authorization: Bearer <token>` is missing or wrong. | Send the matching bearer in your client's connector auth field, or unset the token for a public dev endpoint. |
| **404** `not_found` | The path is not one of `/health`, `/get_context`, `/list_constraints`, `/mcp`. | Point the client at the correct path. For MCP, the connector URL ends in `/mcp`. |
| **405** `method_not_allowed` | A non-`POST` request hit `/mcp`. | The remote MCP transport accepts `POST` JSON-RPC only. |
| **Protocol mismatch** | The MCP client requested a `protocolVersion` the server does not support. | This is **not** an error — the server replies with the latest version it supports; modern clients accept that. No action needed. |
| **Malformed JSON** | The body was not valid JSON. | On `/mcp` the server returns a JSON-RPC `-32700` parse error; on the GPT Action endpoints it returns `400`. Send a valid JSON body. |
| **Empty / `202` on a notification** | `notifications/initialized` (and other notifications) return `202` with no body, by design. | Expected; not an error. |

## What never lives in this repo

- No real endpoint URL — manifests use `https://YOUR-CONNECTOR-HOST.example`.
- No credential / bearer value — the operator sets it as a Worker secret.
- No live deploy — hosting is operator-gated and out of scope here.
