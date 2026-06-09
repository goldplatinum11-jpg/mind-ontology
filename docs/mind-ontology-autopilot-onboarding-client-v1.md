# Mind Ontology — Onboarding a New Client v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How to add another MCP client — a fourth or fifth agent — to a line that already
runs on Mind Ontology. Because the surface is identical everywhere, onboarding is
three short steps, not a re-integration. See
[portability](mind-ontology-autopilot-portability-v1.md).

Local-first: the new client reads the same local `.agentctx/`; no account, no
network, no hosted SIRT.

---

## The three steps

1. **Point it at the same entrypoint.** Copy the matching config from the
   [drop-in kit](../templates/mind-ontology/autopilot/) — `autopilot.mcp.json` for
   a Claude Code / Cursor-style client, `autopilot-codex.toml` for Codex, or the
   thin connector for ChatGPT / Claude.ai. Every client launches the *same* local
   MCP server.
2. **Give it the one-line instruction.** Paste the
   [canonical instruction](mind-ontology-autopilot-one-line-instruction-v1.md):
   *At task start, call get_context(task). Before destructive or structural
   changes, call list_constraints().* Nothing else is client-specific.
3. **Verify.** Run `npm run agentctx:proof` and `npm run agentctx:validate`, then
   have the new client make one `get_context` call. It sees the same two read-only
   tools and the same constitution as every existing agent.

That is the whole onboarding. There is no per-client ontology, no second source of
truth, and no new tool to wire.

## Why it is this easy

The line already keeps its meaning once, compiled the same way for everyone (see
[vs per-tool instruction files](mind-ontology-autopilot-vs-instruction-files-v1.md)).
A new client is just another reader of that one constitution through the
[two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md). Onboarding
cost stays flat no matter how many agents the line runs.

## What to check after onboarding

- The new client's config launches the canonical `scripts/agentctx/mcp-server.mjs`
  entry — no divergent args.
- It exposes only `get_context` and `list_constraints` — no extra tool slipped in.
- It follows the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md)
  ordering: context first, constraints before a risky write.

---

Same constitution, same two tools, one instruction: a new agent joins the line in
three steps. See the [adoption walkthrough](mind-ontology-autopilot-adoption-v1.md)
for first-time setup.
