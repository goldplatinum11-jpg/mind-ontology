# Mind Ontology — Demo: One Ontology, Claude Code + Codex v0

**Status:** Phase 5 / P5-PR03 (launch readiness)
**Proof:** `tests/unit/agentctx-shared-ontology-demo.test.mjs`

The whole pitch in one demo: **the same `.agentctx/` gives Claude Code and Codex
the same context.** No per-tool memory, no drift.

---

## The demo

1. Scaffold one workspace:

   ```sh
   npm run agentctx:init -- --cwd ./demo
   ```

2. Wire Claude Code (`.mcp.json`) and Codex (`.codex/config.toml`) — both ship
   templates that name the **same** server:

   ```json
   // .mcp.json (Claude Code)
   { "mcpServers": { "agentctx": { "command": "node", "args": ["scripts/agentctx/mcp-server.mjs"] } } }
   ```

   ```toml
   # .codex/config.toml (Codex)
   [mcp_servers.agentctx]
   command = "node"
   args = ["scripts/agentctx/mcp-server.mjs"]
   ```

3. Ask each agent the same task. Each calls
   `get_context("Decide which agent role handles code review")` and receives the
   **identical** selected blocks — same constraints (always), same matched
   `#review` role from `agent-roles.md`.

---

## What the automated demo asserts

`agentctx-shared-ontology-demo.test.mjs`:

- both client configs name the same server script;
- launching the server via the **Claude Code** config and via the **Codex**
  config, against one shared workspace and the same task, returns **identical**
  selected blocks (deterministic fields; only the timestamp differs).

```sh
npx vitest run tests/unit/agentctx-shared-ontology-demo.test.mjs
```

---

## Why it matters

This is the payoff of the whole design: meaning is kept once and compiled the
same way for every agent. Change a decision in `.agentctx/` and both Claude Code
and Codex see it on their next task — no syncing `CLAUDE.md` against `AGENTS.md`.
Cursor, ChatGPT, and Claude.ai join the same way (local stdio or the thin
connector).
