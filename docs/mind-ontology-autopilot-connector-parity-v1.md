# Mind Ontology — Autopilot Connector Parity v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How a line keeps the same two-tool surface even for clients that cannot speak
stdio MCP — ChatGPT and Claude.ai — through a **thin self-hosted connector** that
mirrors *exactly* `get_context` and `list_constraints`. Parity means an autopilot
line behaves the same whether an agent is local-stdio or connector-backed.

The connector is **self-hosted by the operator**; it is not a hosted SIRT service.
The OSS layer ships only a placeholder manifest — no endpoint, no credential.

---

## What parity means

The thin connector exposes the same two read-only operations and nothing else:

| Local stdio MCP | Thin connector (OpenAPI) |
|---|---|
| `get_context(task, scope?)` | one read-only operation, same inputs/outputs |
| `list_constraints()` | one read-only operation, same outputs |

The connector adds **no** third operation, no write path, and no new axis. A
ChatGPT or Claude.ai agent reading through it follows the identical
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md): context at task
start, constraints before a risky write.

## Why parity matters for a line

- **Mixed clients stay consistent.** A connector-backed ChatGPT worker and a
  local Claude Code worker read the same constitution the same way — the
  [portability](mind-ontology-autopilot-portability-v1.md) guarantee extends to
  hosted-only clients.
- **No surface creep at the edge.** It would be tempting to add convenience
  operations to a connector; parity forbids it. The connector is a transport for
  the two tools, not a richer API.

## What the OSS layer ships (and does not)

- **Ships:** a placeholder OpenAPI manifest with exactly the two operations, a
  placeholder host on the reserved `.example` TLD, and an auth field with no value.
- **Does not ship:** a real endpoint, a token, or a running service. The operator
  self-hosts the connector; the repo stays credential-free.

The two-operation, placeholder-only shape is held by the connector/setup tests
(`connector-surface-thin`, `mcp-setup-fixtures`). See the
[two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md) for the local
side of the same guarantee.
