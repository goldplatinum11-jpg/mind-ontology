# Mind Ontology — Autopilot Two-Tool Contract v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The entire surface an autopilot line depends on is **two read-only tools**. This
doc states that contract precisely, so a line can wire any MCP client against it
and know nothing else is needed — and nothing else will appear. See the
[MCP server reference](agentctx-mcp.md) for the transport details.

The contract is local: both tools read local `.agentctx/` files and make no
network call.

---

## The two tools

### `get_context(task, scope?)`

- **Input:** a `task` string (natural language) and an optional `scope` tag.
- **Returns:** a task-scoped context pack — the selected blocks for that task,
  with the always-included constraints floor and any risk-forced safety blocks.
- **Reads only:** local `.agentctx/` source files.
- **Use:** at the start of every ADL / lane step.

### `list_constraints()`

- **Input:** none.
- **Returns:** every constraint block (`reason: "always"`) — the full
  non-negotiable floor, unscored.
- **Reads only:** local `.agentctx/constraints.md`.
- **Use:** before any destructive, structural, or irreversible action.

---

## What the contract guarantees

1. **Exactly two tools.** No third tool is exposed. There is no memory tool, no
   search tool, no writeback tool in this surface.
2. **Read-only.** Neither tool mutates anything. There is no write path in the OSS
   layer; writeback is a separate, proposal-only, fail-closed adapter.
3. **Identical across clients.** Claude Code, Codex, Cursor, and a thin
   self-hosted connector all see the same two tools with the same shapes.
4. **No hidden network.** Both calls resolve against local files; the free layer
   makes no outbound request.

---

## Why two is enough

An autopilot line needs exactly two questions answered per step: *what does this
task require?* (`get_context`) and *what must I never do?* (`list_constraints`).
Everything else in the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md)
and the [stop policy](mind-ontology-autopilot-stop-policy-v1.md) is *when* to ask
those two, not a new capability. Keeping the surface this small is what makes the
layer auditable and portable.

The two-tool surface is held to this contract by the connector/setup tests
(`connector-surface-thin`, `mcp-setup-fixtures`) and, for the autopilot kit, by
`tests/unit/autopilot-mcp-config.test.mjs`.
