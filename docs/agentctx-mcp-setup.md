# agentctx MCP — repo-local setup (Codex + Claude Code)

Wire both **Codex** and **Claude Code** to the *same* local `agentctx` MCP
server. In the Mind Ontology model, this is how multiple AI agents receive the
same portable meaning layer without each agent owning a separate static memory.

Everything here is repo-local: no UI, no hosted service, no network calls. The
server is a stdio process started by each client on demand; it reads `.agentctx/`
from this repo and returns compiled context packs.

Ready-to-copy templates live next to this doc:

| Client | Template | Copy to |
|--------|----------|---------|
| Claude Code | [`docs/agentctx-setup/claude-code.mcp.json`](agentctx-setup/claude-code.mcp.json) | `.mcp.json` (repo root) |
| Codex | [`docs/agentctx-setup/codex-config.toml`](agentctx-setup/codex-config.toml) | `.codex/config.toml` (repo root) |

The server file is `scripts/agentctx/mcp-server.mjs` and exposes two tools:
`get_context` and `list_constraints` (see [`docs/agentctx-mcp.md`](agentctx-mcp.md)
for the tool contract).

> Prerequisite: Node.js on `PATH` (`node --version`). No `npm install` is
> required — the server uses only Node built-ins.

---

## How the server finds `.agentctx/`

The server resolves its default working directory in this order:

1. `AGENTCTX_HOME` environment variable (if set, trimmed) — **the unified pin**.
2. `process.cwd()` — the directory the MCP client launched the server from.

A single tool call may also override per call with a `cwd` argument.

- **Repo-root configs** (`.mcp.json`, `.codex/config.toml`) — both clients launch
  the server with the repo root as cwd, so the relative args path and the default
  `.agentctx/` resolution both work with **no env needed**.
- **Global / user-scope configs** — cwd is not guaranteed to be the repo root, so
  set `AGENTCTX_HOME` to the absolute repo path and use an absolute args path.

---

## Claude Code

### Option A — copy the template (project scope, shared via git)

Copy `docs/agentctx-setup/claude-code.mcp.json` to `.mcp.json` at the repo root:

```sh
cp docs/agentctx-setup/claude-code.mcp.json .mcp.json
```

`.mcp.json` content:

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

Start Claude Code from the repo root. On first load it will prompt to approve the
project MCP server; approve it.

### Option B — `claude mcp add` (exact command + args)

Run from the repo root:

```sh
claude mcp add agentctx --scope project -- node scripts/agentctx/mcp-server.mjs
```

- `agentctx` — server name.
- `--scope project` — writes to `.mcp.json` at the repo root (committed, shared).
  Use `--scope user` to register it for your account across all repos; in that
  case add `--env AGENTCTX_HOME=/ABSOLUTE/PATH/TO/sirt-app-v2` and use the
  absolute server path in args.
- everything after `--` is the launch command: `node` + the server script.

### Verify (Claude Code)

```sh
# Lists configured servers and their connection status
claude mcp list

# Shows the resolved command/args for this server
claude mcp get agentctx
```

Inside a Claude Code session, confirm the tools are live:

```text
/mcp
```

You should see `agentctx` with `get_context` and `list_constraints`.

---

## Codex

### Option A — copy the template (project-local config)

Copy `docs/agentctx-setup/codex-config.toml` into `.codex/config.toml` at the
repo root (create the file/dir if absent). The repo must be a **trusted** Codex
project for project-local config to load.

```toml
[mcp_servers.agentctx]
command = "node"
args = ["scripts/agentctx/mcp-server.mjs"]
```

### Option B — `codex mcp add` (exact command + args)

```sh
codex mcp add agentctx -- node scripts/agentctx/mcp-server.mjs
```

Everything after `--` is the launch command. This writes the `[mcp_servers.agentctx]`
block to your Codex config (`$CODEX_HOME/config.toml`, default `~/.codex/config.toml`).

### Global install variant (`~/.codex/config.toml`)

When the config is global, Codex may not launch from the repo root — use absolute
paths and pin `AGENTCTX_HOME`:

```toml
[mcp_servers.agentctx]
command = "node"
args = ["/ABSOLUTE/PATH/TO/sirt-app-v2/scripts/agentctx/mcp-server.mjs"]

[mcp_servers.agentctx.env]
AGENTCTX_HOME = "/ABSOLUTE/PATH/TO/sirt-app-v2"
```

Replace `/ABSOLUTE/PATH/TO/sirt-app-v2` with this repo's absolute path
(`pwd` from the repo root).

### Verify (Codex)

```sh
# Lists configured MCP servers
codex mcp list

# Shows the resolved config for this server
codex mcp get agentctx
```

---

## Verify the server itself (client-independent)

The server speaks newline-delimited JSON-RPC 2.0 on stdio. You can exercise it
without any client. Run these from the repo root.

**Tool list** — should return `get_context` and `list_constraints`:

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node scripts/agentctx/mcp-server.mjs
```

**Compile a context pack** — should return a Markdown pack mentioning the task:

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_context","arguments":{"task":"Add MCP setup templates","scope":"mcp"}}}' | node scripts/agentctx/mcp-server.mjs
```

**Confirm `AGENTCTX_HOME` pinning works** — run from *outside* the repo and still
resolve this repo's `.agentctx/`:

```sh
# bash / zsh — note: AGENTCTX_HOME binds to `node` (after the pipe), not printf
cd /tmp && printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_constraints","arguments":{}}}' \
  | AGENTCTX_HOME=/ABSOLUTE/PATH/TO/sirt-app-v2 node /ABSOLUTE/PATH/TO/sirt-app-v2/scripts/agentctx/mcp-server.mjs
```

```powershell
# PowerShell
$env:AGENTCTX_HOME = "C:\ABSOLUTE\PATH\TO\sirt-app-v2"
'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_constraints","arguments":{}}}' |
  node C:\ABSOLUTE\PATH\TO\sirt-app-v2\scripts\agentctx\mcp-server.mjs
```

All three should print a single JSON-RPC response line on stdout with nothing on
stderr.

**Run the test suite** for the server + these templates:

```sh
npm test -- agentctx
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty / missing constraints in packs | Server cwd is not the repo root | Set `AGENTCTX_HOME` to the absolute repo path |
| `command not found: node` | Node not on `PATH` | Install Node, or use an absolute `node` path in `command` |
| Codex ignores `.codex/config.toml` | Repo not trusted | Trust the repo in Codex, or use the global `~/.codex/config.toml` variant |
| Claude Code never prompts for the server | Started outside the repo root | Launch Claude Code from the repo root, or use `--scope user` with `AGENTCTX_HOME` |
| Tools missing in `/mcp` | Server failed to start | Run the client-independent `tools/list` check above to see the raw error |
