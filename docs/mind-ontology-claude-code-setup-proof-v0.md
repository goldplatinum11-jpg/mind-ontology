# Mind Ontology — Claude Code Setup Proof v0

**Status:** Phase 3 / P3-PR01 (multi-client distribution)
**Client:** Claude Code
**Proof:** `tests/unit/agentctx-claude-code-setup-proof.test.mjs`

This document is a *setup proof*: it does not just describe how to wire the
agentctx local stdio MCP server into Claude Code — it ships an automated test
that launches the server exactly as Claude Code would and verifies the full MCP
handshake returns real context. If the proof test passes, Claude Code can use
Mind Ontology.

For the full multi-client setup walkthrough (Claude Code + Codex, repo-scope vs
global-scope, `AGENTCTX_HOME` pinning) see
[`agentctx-mcp-setup.md`](agentctx-mcp-setup.md). This doc is the Claude-Code
slice plus the executable proof.

---

## 1. Wire it (30 seconds)

Copy the shipped template to your repo root:

```sh
cp docs/agentctx-setup/claude-code.mcp.json .mcp.json
```

`.mcp.json`:

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

Claude Code launches this stdio server from the repo root, so the relative
server path and the default `.agentctx/` resolution both work with no env vars.
Prerequisite: Node.js on `PATH`. No `npm install` (the server uses only Node
built-ins).

---

## 2. Add the client instruction

Tell Claude Code to consult the ontology:

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

---

## 3. The proof

`agentctx-claude-code-setup-proof.test.mjs` reads the **same** template, spawns
`node scripts/agentctx/mcp-server.mjs` as a stdio child, and performs the exact
JSON-RPC exchange an MCP client performs:

| Step | Request | Verified |
|---|---|---|
| 1 | `initialize` | `serverInfo.name == "agentctx"`, a protocol version is returned |
| 2 | `tools/list` | advertises `get_context` and `list_constraints` |
| 3 | `tools/call get_context` | returns a pack with ≥1 selected block, constraints always included |
| 4 | `tools/call list_constraints` | returns `constraints.md` blocks |

Step 3 runs against a freshly scaffolded `.agentctx/` (via `agentctx init`),
using the per-call `cwd` override, so the proof exercises a real user project,
not just the repo's own ontology.

Run it:

```sh
npx vitest run tests/unit/agentctx-claude-code-setup-proof.test.mjs
```

A green run is the proof that the documented Claude Code wiring produces a
working Mind Ontology MCP connection end to end.

---

## What this proves (and does not)

- **Proves:** the template config names a server that starts, speaks MCP over
  stdio, lists the two tools, and returns compiled context + constraints.
- **Does not need:** any hosted SIRT account, database, network, or secret. The
  server is a local stdio process in the user's environment.
