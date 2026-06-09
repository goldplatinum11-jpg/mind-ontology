# Mind Ontology — Autopilot Adoption Walkthrough v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A concrete, copy-paste path for wiring an autonomous AI line onto Mind Ontology.
Every step runs locally — no account, no network, no hosted SIRT. At the end, a
line of agents reads the same portable constitution on the right axis and stops
on the right boundary.

---

## Prerequisites

- Node.js >= 20.
- This repo (or your own project) with the `.agentctx/` compiler available at
  `scripts/agentctx/mcp-server.mjs`.

That is the whole dependency list. The free layer needs nothing else.

---

## Step 1 — Scaffold the ontology

Copy the neutral template into the folder where the local MCP server will run:

```sh
npm run agentctx:init        # scaffolds .agentctx/ from templates/mind-ontology/
```

You now have the nine source files (`constraints.md`, `direction.md`,
`projects.md`, `decisions.md`, `architecture.md`, `agent-roles.md`, `identity.md`,
`glossary.md`, `cq.md`). `constraints.md` is always included in every pack.

## Step 2 — Paste the autopilot blocks

Open `templates/mind-ontology/autopilot/autopilot-blocks.md` and paste the blocks
into your own `.agentctx/constraints.md` and `.agentctx/agent-roles.md`. They
encode the reading protocol, the constraint re-read, and the stop policy as
ordinary tagged blocks. Edit them to match your line.

## Step 3 — Wire the MCP server

Point every agent at the same local entrypoint. The ready-to-copy configs live in
`templates/mind-ontology/autopilot/` (`autopilot.mcp.json` for Claude Code /
Cursor, `autopilot-codex.toml` for Codex). For Claude Code:

```json
// .mcp.json
{ "mcpServers": { "agentctx": { "command": "node", "args": ["scripts/agentctx/mcp-server.mjs"] } } }
```

Every client launches the **identical** entry and sees the **same two read-only
tools** — `get_context` and `list_constraints`. No client gets a wider surface.

## Step 4 — Give every agent the one-line instruction

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

The [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) expands
this into per-role trigger points; the
[stop policy](mind-ontology-autopilot-stop-policy-v1.md) tells the line when it
may and may not stop.

## Step 5 — First context call

From a wired agent, the first task call returns a task-scoped pack, not the whole
ontology:

```sh
npm run agentctx:compile -- --task "Plan the next PR and avoid forbidden writes" --scope mcp
```

You should see `constraints.md` blocks as "always included" and matching
direction / role blocks scored in. A risky task (`--task "Drop the orders table"`)
forces the safety blocks in automatically.

## Step 6 — Verify the install

```sh
npm run agentctx:proof       # smallest viable gate
npm run agentctx:validate    # 0 errors against the schema
npm run agentctx:smoke       # end-to-end free-layer journey
```

Green on all three means the autopilot line is reading a valid, portable
constitution with no hosted dependency.

---

## What you did NOT have to do

- No account, login, API key, or token.
- No database, vector store, or hosted memory service.
- No network call — the free layer makes none.
- No SIRT runner or control-plane install — hosted SIRT, if you ever enable it,
  is opt-in, fail-closed, and off by default.

This is the open-core promise in practice: the autopilot line is complete on the
local layer alone. See the [pack frame](mind-ontology-autopilot-pack-v1.md) and
the [docs index](mind-ontology.md).
