# agentctx MCP Server

An MCP stdio transport wrapper around the `agentctx` compile path.
The core compiler (`scripts/agentctx/compile.mjs`) is unchanged — MCP is a thin JSON-RPC layer.

In product terms, this is the transport adapter for Mind Ontology: it lets
Codex, Claude Code, ChatGPT-compatible MCP clients, Cursor, and other agents ask
for the same task-scoped meaning pack from the same repo-local source.

---

## Quick start

```sh
# Start the server manually (for debugging)
node scripts/agentctx/mcp-server.mjs

# Or via npm
npm run agentctx:mcp
```

The server reads newline-delimited JSON-RPC 2.0 messages from stdin and writes responses to stdout.  
Stderr is reserved for server-level diagnostics only (not used in normal operation).

---

## Tools

### `get_context`

Compile a task-scoped Mind Ontology context pack from `.agentctx/` source files.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task` | string | yes | Task description (e.g. `"Implement OAuth PKCE flow"`). |
| `scope` | string \| string[] | no | Scope tag(s). CSV string or array. Tokens weighted higher than task tokens. |
| `format` | `"markdown"` \| `"json"` | no | Output format. Default: `"markdown"`. |
| `cwd` | string | no | Directory containing `.agentctx/`. Default: server working directory. |

**Returns** `{ content: [{ type: "text", text: string }] }`

The text is either a Markdown context pack or a JSON object matching the shape in `docs/agentctx.md`.

**Example**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_context",
    "arguments": {
      "task": "Implement OAuth PKCE flow",
      "scope": "auth,security",
      "format": "json"
    }
  }
}
```

---

### `list_constraints`

Return all blocks from `.agentctx/constraints.md`. These are the non-negotiable project invariants that are always included in every context pack.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `format` | `"markdown"` \| `"json"` | no | Output format. Default: `"markdown"`. |
| `cwd` | string | no | Directory containing `.agentctx/`. Default: server working directory. |

**Returns** `{ content: [{ type: "text", text: string }] }`

JSON shape: `{ file, blockCount, blocks: [{ title, tags, body }] }`

---

## Configuring MCP clients

> For repo-local **Codex + Claude Code** setup with ready-to-copy templates,
> exact file locations, command arguments, and verification commands, see
> [`docs/agentctx-mcp-setup.md`](agentctx-mcp-setup.md). The snippets below are
> the minimal per-client config.

### Claude Code (`.mcp.json`, repo root — project scope)

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

Claude Code launches the server with the repo root as cwd, so the relative args
path and default `.agentctx/` resolution work without extra config. For
user-scope installs (cwd not guaranteed), pin the repo via the `AGENTCTX_HOME`
environment variable:

```json
{
  "mcpServers": {
    "agentctx": {
      "command": "node",
      "args": ["/absolute/path/to/repo/scripts/agentctx/mcp-server.mjs"],
      "env": { "AGENTCTX_HOME": "/absolute/path/to/repo" }
    }
  }
}
```

### Codex (`.codex/config.toml`, repo root — project scope)

```toml
[mcp_servers.agentctx]
command = "node"
args = ["scripts/agentctx/mcp-server.mjs"]
```

For a global `~/.codex/config.toml`, use absolute paths and pin `AGENTCTX_HOME`
(see [`docs/agentctx-mcp-setup.md`](agentctx-mcp-setup.md)).

### Cursor (`.cursor/mcp.json`)

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

### Generic stdio client

Any MCP client that supports stdio transport can connect by launching:

```sh
node scripts/agentctx/mcp-server.mjs
```

from the repo root. Protocol version: `2024-11-05`.

---

## Architecture notes

- **No external dependencies.** The server uses only Node.js built-ins (`readline`, `path`, `url`, `fs`).
- **Core is unchanged.** `compile.mjs` exports are called directly; no wrapper module between the server and the compiler.
- **cwd scoping.** The server's default working directory resolves from `AGENTCTX_HOME` (if set) and otherwise falls back to `process.cwd()` at startup. Each tool call can override via the `cwd` parameter to point at a different repo.
- **stderr is clean.** The server writes nothing to stderr during normal operation. JSON-RPC errors are returned as proper error responses on stdout.
- **No hosted dependency.** The MCP server is as dependency-free as the CLI.

---

## Errors

JSON-RPC error codes used:

| Code | Meaning |
|------|---------|
| `-32700` | Parse error (malformed JSON) |
| `-32601` | Method or tool not found |
| `-32602` | Invalid parameters (missing `task`, bad `format`, etc.) |
| `-32603` | Internal server error |
