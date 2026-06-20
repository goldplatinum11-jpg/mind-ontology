# Mind Ontology — HTTP / Thin Endpoint Design v0

**Status:** Phase 3 / P3-PR05 (multi-client distribution) — **design only**
**Depends on:** the boundary fixed in
[`mind-ontology-thin-connector-strategy-v0.md`](mind-ontology-thin-connector-strategy-v0.md)
**Artifact:** [`agentctx-setup/mind-ontology-connector.openapi.json`](agentctx-setup/mind-ontology-connector.openapi.json)

This specifies the request/response shapes for the thin HTTP connector. It does
**not** implement or deploy anything (deployment is P3-PR06; the OSS project
hosts nothing). Both hosted surfaces map to the same two read-only operations.

---

## Operations (the whole surface)

| Operation | Input | Output |
|---|---|---|
| `get_context` | `{ task, scope? }` | a `ContextPack` (the compiled pack, incl. `risk`) |
| `list_constraints` | `{}` | a `ConstraintsResult` (all `constraints.md` blocks) |

Both are **read-only** and **stateless** — each call compiles fresh from
`.agentctx/` source files. There is no third operation; anything else is
`method not found` / `404`, matching the local stdio server.

---

## Surface A — GPT Action (classic custom GPTs)

ChatGPT custom GPTs call an OpenAPI-described HTTP API. The shipped spec is
`agentctx-setup/mind-ontology-connector.openapi.json` (OpenAPI 3.1).

```http
POST /get_context
Content-Type: application/json

{ "task": "Add OAuth PKCE flow", "scope": "auth,security" }
```

```http
200 OK
Content-Type: application/json

{
  "task": "Add OAuth PKCE flow",
  "scopes": ["auth", "security"],
  "generatedAt": "2026-06-08T00:00:00.000Z",
  "selected": [ { "file": "constraints.md", "title": "...", "score": "always", "reason": "always", "body": "..." } ],
  "omittedCount": 7,
  "sourceFiles": ["constraints.md", "identity.md", "..."],
  "risk": { "level": "safe", "mode": "auto", "signals": [] }
}
```

`POST /list_constraints` returns `{ file: "constraints.md", blockCount, blocks[] }`.

- `400` for a missing `task`.
- The `servers[0].url` is a **placeholder** (`https://YOUR-CONNECTOR-HOST.example/mco`);
  the operator replaces it with their deployed endpoint.

---

## Surface B — Remote MCP (Claude.ai connectors, ChatGPT developer-mode MCP)

The remote MCP surface speaks the same JSON-RPC the local stdio server speaks,
over HTTP (Streamable HTTP). The transport changes; the messages do not:

| JSON-RPC method | Behavior (identical to stdio server) |
|---|---|
| `initialize` | returns `serverInfo { name: "agentctx" }`, protocol version, `capabilities.tools` |
| `tools/list` | advertises `get_context`, `list_constraints` |
| `tools/call` | dispatches to the same two handlers; result is `{ content: [{ type: "text", text }] }` |

```http
POST /mcp
Content-Type: application/json

{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }
```

Because the handlers are the **same module** the stdio server uses, the remote
MCP surface cannot drift from the local one — the setup proofs (P3-PR01..03) that
exercise the stdio handlers also cover the remote behavior at the contract level.

---

## Status codes & errors

| Condition | GPT Action | Remote MCP |
|---|---|---|
| OK | `200` + body | JSON-RPC `result` |
| Missing `task` | `400` `{ error }` | JSON-RPC `error` (-32602) |
| Unknown operation | `404` | JSON-RPC `error` (-32601) |
| Compile/validation failure | `400` `{ error }` | JSON-RPC `error` (-32603) |

---

## Auth (operator-supplied, not shipped)

The OpenAPI declares an **optional** `bearerAuth` scheme with **no value**. Auth
is a deployment choice:

- Private workspace → require the operator's own bearer (set at deploy time).
- Local/dev → no auth.

No URL, bearer, or other credential is committed in this repo. (Consistent with
the ontology no-credential constraint and the thin-connector strategy.)

---

## Handoff

- **P3-PR06** — self-hosted Worker deployment **plan** built against these shapes
  (doc only; no wrangler/deploy/secret).
- **P3-PR07** — example connector manifests (GPT Action import + Claude.ai
  connector) with placeholders only.

## PR1 implementation note

The GPT-Action HTTP surface designed here is implemented in PR1 under
`connector/worker/`, serving a **bundled `.agentctx` snapshot adapter**: the
Worker has no filesystem, so it serves a deploy-time JSON snapshot instead of
reading `.agentctx/` directly. PR1 reuses the engine's `compileContext` /
`parseMarkdownBlocks` / `renderContextPackJson` verbatim, so the hosted JSON
cannot diverge from the local stdio server. PR1 covers `POST /get_context`,
`POST /list_constraints`, and `GET /health`. PR2 adds the Remote MCP transport
(`POST /mcp`, Streamable-HTTP JSON-RPC: `initialize` / `notifications/initialized`
/ `tools/list` / `tools/call`) over the same snapshot adapter — see
`connector/worker/lib/mcp.mjs`.
