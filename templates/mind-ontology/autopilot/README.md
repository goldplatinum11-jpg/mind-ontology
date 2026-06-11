# Mind Ontology — Autopilot drop-in kit

A small, copy-ready kit that wires an autonomous AI development line onto Mind
Ontology. Everything here is **local-first**: no account, no network, no hosted
backend. Every agent uses the same two read-only tools, `get_context` and
`list_constraints`.

## What's in the kit

| File | Copy it into | Purpose |
|---|---|---|
| `autopilot-blocks.md` | your `.agentctx/constraints.md` and `.agentctx/agent-roles.md` | the reading protocol, constraint re-read, and stop policy as tagged blocks |
| `autopilot.mcp.json` | `.mcp.json` (Claude Code / Cursor) | launches the local MCP server with the two-tool surface |
| `autopilot-codex.toml` | `.codex/config.toml` (Codex) | the same launch for Codex |
| `example-codex-agent.md` | your agent's system/role prompt | a pasteable worker prompt embodying the reading protocol + stop policy |
| `cheat-sheet.md` | pin near your agent | a one-screen trigger + stop-policy reference |

## How to use it

1. Scaffold an ontology: `npm run agentctx:init` (or copy
   `templates/mind-ontology/.agentctx/`).
2. Paste the blocks from `autopilot-blocks.md` into your `constraints.md` and
   `agent-roles.md`, and edit them to your line.
3. Drop `autopilot.mcp.json` / `autopilot-codex.toml` in so every agent launches
   the same entrypoint.
4. Give each agent the one-line instruction:

   ```text
   At task start, call get_context(task). Before destructive or structural
   changes, call list_constraints().
   ```

5. Verify: `npm run agentctx:proof` and `npm run agentctx:validate`.

## The promise

- **No tool sprawl.** Only `get_context` and `list_constraints` are ever exposed.
- **No hosted dependency.** The kit makes no network call; a hosted backend, if ever
  enabled, is opt-in, fail-closed, and off by default.
- **No secrets.** Never put credentials in `.agentctx/` or in these configs.

See `docs/mind-ontology-autopilot-pack-v1.md`,
`docs/mind-ontology-autopilot-adoption-v1.md`, and
`docs/mind-ontology-autopilot-reading-protocol-v1.md` for the full rationale.
