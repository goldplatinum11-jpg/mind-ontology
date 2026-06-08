# Mind Ontology — Codex Setup Proof v0

**Status:** Phase 3 / P3-PR02 (multi-client distribution)
**Client:** Codex
**Proof:** `tests/unit/agentctx-codex-setup-proof.test.mjs`

A *setup proof* for Codex: it ships an automated test that launches the agentctx
stdio server using the **Codex** config block and verifies the same MCP handshake
returns real context. Same server, same tools as the Claude Code proof — proving
the "one ontology, many clients" promise.

See [`agentctx-mcp-setup.md`](agentctx-mcp-setup.md) for the full walkthrough and
the global-scope (`AGENTCTX_HOME`) variant.

---

## 1. Wire it

Copy the shipped block into `.codex/config.toml` at the repo root (a trusted
Codex project):

```toml
[mcp_servers.agentctx]
command = "node"
args = ["scripts/agentctx/mcp-server.mjs"]
```

Codex launches the server from the repo root, so the relative server path and
default `.agentctx/` resolution work with no env vars. Prerequisite: Node.js on
`PATH`. No `npm install`.

For a global `~/.codex/config.toml`, use absolute paths and set `AGENTCTX_HOME`
to the repo path (Codex is not guaranteed to launch from the repo root).

---

## 2. Add the client instruction

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

This is the **same** instruction given to Claude Code — both agents read the
same `.agentctx/` source of truth instead of separate `AGENTS.md` / `CLAUDE.md`
drift.

---

## 3. The proof

`agentctx-codex-setup-proof.test.mjs` reads the `[mcp_servers.agentctx]` block
from the shipped `docs/agentctx-setup/codex-config.toml`, spawns the named stdio
server, and runs the JSON-RPC exchange:

| Step | Verified |
|---|---|
| `initialize` | `serverInfo.name == "agentctx"` |
| `tools/list` | advertises `get_context` + `list_constraints` |
| `tools/call get_context` | pack with ≥1 selected block; constraints always included |
| `tools/call list_constraints` | returns `constraints.md` blocks |

`get_context` runs against a freshly scaffolded `.agentctx/` via the per-call
`cwd` override.

```sh
npx vitest run tests/unit/agentctx-codex-setup-proof.test.mjs
```

A green run proves the documented Codex wiring produces a working Mind Ontology
MCP connection — identical behavior to Claude Code, from the same server.
