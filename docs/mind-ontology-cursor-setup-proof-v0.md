# Mind Ontology — Cursor Setup Proof v0

**Status:** Phase 3 / P3-PR03 (multi-client distribution)
**Client:** Cursor
**Template:** `docs/agentctx-setup/cursor.mcp.json`
**Proof:** `tests/unit/agentctx-cursor-setup-proof.test.mjs`

A *setup proof* for Cursor: it ships the Cursor MCP config template plus an
automated test that launches the agentctx stdio server named by that template
and verifies the same MCP handshake returns real context. Same server and tools
as the Claude Code and Codex proofs.

---

## 1. Wire it

Cursor reads MCP servers from `.cursor/mcp.json` (project scope) or
`~/.cursor/mcp.json` (global). Copy the shipped template:

```sh
mkdir -p .cursor && cp docs/agentctx-setup/cursor.mcp.json .cursor/mcp.json
```

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentctx": {
      "command": "node",
      "args": ["scripts/agentctx/mcp-server.mjs"]
    }
  }
}
```

The config shape is the same `mcpServers` object Claude Code uses, so a project
can keep both `.mcp.json` and `.cursor/mcp.json` pointing at the identical
server. Prerequisite: Node.js on `PATH`. No `npm install`.

For a global `~/.cursor/mcp.json`, use an absolute server path and set
`AGENTCTX_HOME` to the repo path (see `agentctx-mcp-setup.md`).

---

## 2. Add the client instruction

In Cursor Rules (or the project rules file), add:

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

The same instruction used by Claude Code and Codex — one source of truth across
all three.

---

## 3. The proof

`agentctx-cursor-setup-proof.test.mjs`:

1. validates `cursor.mcp.json` is valid JSON naming the real server script;
2. spawns that server as a stdio child and runs the JSON-RPC exchange
   (`initialize` → `tools/list` → `tools/call get_context` → `tools/call
   list_constraints`) against a freshly scaffolded `.agentctx/`.

```sh
npx vitest run tests/unit/agentctx-cursor-setup-proof.test.mjs
```

A green run proves the documented Cursor wiring produces a working Mind Ontology
MCP connection — identical behavior to Claude Code and Codex, from the same
server.
