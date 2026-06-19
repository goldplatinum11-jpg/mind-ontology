# Agent setup — adoption autoload (`mind-ontology agent-setup`)

Mind Ontology only helps an AI coding agent if the agent actually reads it.
`mind-ontology agent-setup` makes that wiring a one-command step instead of a
remembered ritual: for a given client it produces the MCP server config, a
**startup / first-action bootstrap instruction**, and the rules for how the
emitted `AGENTS.md` / `CLAUDE.md` artifacts relate to the live MCP path.

Everything is deterministic and local-only: no network calls, no model calls,
and generated config carries only project-relative paths. The same project
state always produces byte-identical output, so the snippets are testable.

```sh
mind-ontology agent-setup --target claude-code --cwd <project> --print
mind-ontology agent-setup --target codex --cwd <project> --print
```

## What it produces

| Piece | claude-code | codex |
|---|---|---|
| MCP config | `.mcp.json` (project scope) | `.codex/config.toml` (project-local) |
| Bootstrap instruction | printed; paste into `CLAUDE.local.md` or user memory | printed; paste into user-level Codex guidance (e.g. `~/.codex/AGENTS.md`) |
| Artifact relationship | how the emitted `CLAUDE.md` and the live MCP path divide work | same, for `AGENTS.md` |

The server path inside the config is resolved locally, in order:

1. `scripts/agentctx/mcp-server.mjs` — this repo itself, or a vendored copy;
2. `node_modules/mind-ontology/scripts/agentctx/mcp-server.mjs` — the npm
   dependency layout.

When neither exists yet, the dependency path is emitted with a warning so the
config becomes correct after `npm install mind-ontology`.

## Print vs write

- `--print` — print the full plan; write nothing. Safe to run anywhere.
- Without `--print` — create the config file **only when absent**. An existing
  config is never overwritten or merged: the command fails closed with exit 1
  and points you at `--print` to merge the `agentctx` server block by hand.

The bootstrap instruction is always printed, never written to a file: its home
is a non-generated instruction layer, and `agent-setup` does not write to files it
does not own.

## The bootstrap instruction

```text
Mind Ontology bootstrap — startup / first action:
1. At the start of every task, before making changes, call the `agentctx`
   MCP tool `get_context` with the task description.
2. Before destructive or structural changes, call `list_constraints`.
3. If the agentctx tools are unavailable or `.agentctx/` is missing, say so
   and continue without inventing project context; scaffold sources with:
   mind-ontology init
```

This is deliberately framed as a startup / first-action **instruction**, not an
auto-call guarantee: wiring an MCP server is a practical helper, but no client
promises that every agent run calls a tool unprompted. The instruction is what
asks the agent to read context before acting; the emitted artifact is the
fallback it auto-reads at startup either way.

## Relationship to the emitted artifacts

`mind-ontology emit` owns `AGENTS.md` and `CLAUDE.md`. They are generated,
fingerprinted, and re-emitted over hand edits — so the bootstrap instruction
must **not** be pasted into them. Put it in the per-user / non-generated layer
the command names in its output:

- **claude-code** — `CLAUDE.local.md` or Claude Code user memory.
- **codex** — user-level Codex guidance such as `~/.codex/AGENTS.md`.

The division of labor: the emitted artifact is the static floor every agent
sees at startup; the MCP `get_context` tool is the richer, task-scoped live
path; the bootstrap instruction is the bridge that asks the agent to use it.

## Safe failure mode (missing `.agentctx/`)

`agent-setup` works in a project that has not run `mind-ontology init` yet — it
warns instead of failing, because wiring the client first is a valid order:

- the command exits 0 and prints the plan, with a stderr warning naming the
  fix (`mind-ontology init`);
- the MCP server fails closed when `.agentctx/` is missing — tools return an
  error instead of invented context;
- the bootstrap instruction itself tells the agent what to do in that state:
  say so, do not invent project context, and point at `mind-ontology init`.

## Verify

```sh
mind-ontology agent-setup --target claude-code --print          # inspect the plan
mind-ontology agent-setup --target claude-code                  # write .mcp.json
claude mcp list                                           # client sees the server
```

For deeper wiring options (user/global scope, `AGENTCTX_HOME` pinning,
client-independent JSON-RPC checks, troubleshooting) see
[`agentctx-mcp-setup.md`](agentctx-mcp-setup.md). The per-client proofs are in
[`mind-ontology-claude-code-setup-proof-v0.md`](mind-ontology-claude-code-setup-proof-v0.md)
and [`mind-ontology-codex-setup-proof-v0.md`](mind-ontology-codex-setup-proof-v0.md).
The command's behavior is locked by `tests/unit/agent-setup-command.test.mjs`.
