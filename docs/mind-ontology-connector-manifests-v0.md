# Mind Ontology — Connector Manifest Examples v0

**Status:** Phase 3 / P3-PR07 (multi-client distribution)
**Templates:**
- GPT Action (classic): [`agentctx-setup/mind-ontology-connector.openapi.json`](agentctx-setup/mind-ontology-connector.openapi.json) (P3-PR05)
- ChatGPT developer-mode MCP: [`agentctx-setup/chatgpt-connector.example.json`](agentctx-setup/chatgpt-connector.example.json)
- Claude.ai custom connector: [`agentctx-setup/claude-ai-connector.example.json`](agentctx-setup/claude-ai-connector.example.json)

Ready-to-adapt manifests for wiring a **self-hosted** thin connector into hosted
chat clients. Every example uses a **placeholder URL** and ships **no
credential** — you replace the host with your own deployed endpoint (see the
[deployment plan](mind-ontology-selfhost-deployment-plan-v0.md)).

All three expose only the two read operations: `get_context`, `list_constraints`.

---

## ChatGPT — classic custom GPT (GPT Action)

1. In the GPT editor → **Actions** → **Import**, paste/import
   `mind-ontology-connector.openapi.json`.
2. Replace `servers[0].url` with your endpoint.
3. Authentication: **None** for a public dev endpoint, or **API Key →
   Bearer** with the operator's value (entered in the GPT editor, never
   committed).

---

## ChatGPT — developer mode / Responses API MCP

Use `chatgpt-connector.example.json`:

```json
{
  "type": "mcp",
  "server_label": "agentctx",
  "server_url": "https://YOUR-CONNECTOR-HOST.example/mcp",
  "require_approval": "always",
  "allowed_tools": ["get_context", "list_constraints"]
}
```

Replace `server_url`. `allowed_tools` pins the surface to the two read tools.

---

## Claude.ai — custom connector

Use the values in `claude-ai-connector.example.json` when adding a custom
connector (Settings → Connectors → Add custom connector):

| Field | Value |
|---|---|
| Name | `agentctx` |
| Remote MCP URL | your endpoint (`…/mcp`) |
| Transport | Streamable HTTP |
| Auth | None, or operator bearer/OAuth entered in the Claude.ai UI |

---

## The client instruction (all clients)

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

The same instruction the local clients (Claude Code, Codex, Cursor) use — one
ontology, every agent.

---

## Safety

- **No secrets here.** Every manifest carries a placeholder URL and `auth: none`
  / `require_approval: always`. Real URLs and any bearer/OAuth values are entered
  in the client UI or the operator's secret store, never committed.
- **Read-only.** `allowed_tools` / the OpenAPI paths expose only `get_context`
  and `list_constraints`.
