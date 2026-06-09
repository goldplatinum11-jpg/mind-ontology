# Mind Ontology — Autopilot Portability Across Clients v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

One portable constitution feeds **every** agent in the line the same way. An
autopilot line is not tied to a single AI client — the same `.agentctx/` source
and the same two read-only tools serve Claude Code, Codex, Cursor, and, via a thin
self-hosted connector, ChatGPT and Claude.ai.

Portability is local: every client reads the same local files; none requires a
hosted SIRT account.

---

## Same constitution, every client

| Client | How it wires in | What it sees |
|---|---|---|
| Claude Code | `.mcp.json` → local stdio MCP server | `get_context`, `list_constraints` |
| Codex | `.codex/config.toml` → same server | the same two tools |
| Cursor | `.mcp.json` → same server | the same two tools |
| ChatGPT / Claude.ai | thin self-hosted connector (OpenAPI) | the same two operations |

The drop-in kit ships the first three configs verbatim
(`templates/mind-ontology/autopilot/`). No client gets a wider or narrower
surface; the only tools anywhere are `get_context` and `list_constraints`.

---

## Why portability matters for a line

- **No per-tool drift.** The old failure was one instruction file per tool
  (`CLAUDE.md`, `AGENTS.md`, Cursor rules) drifting apart. One constitution,
  compiled the same way, removes that drift across the whole line.
- **Mixed lines work.** A Codex controller and a Claude Code worker read the
  *identical* constraints and direction — they cannot disagree about the rules.
- **Swap-friendly.** Replacing one client with another changes nothing about the
  ontology or the contract; only the launch config differs.

---

## The one thing that stays constant

Across every client, the line follows the same
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md): `get_context`
at task start, `list_constraints` before risky writes. The portability guarantee
is exactly that this behavior is identical everywhere — which is what the
[two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md) and the
setup-fixture tests lock down.
