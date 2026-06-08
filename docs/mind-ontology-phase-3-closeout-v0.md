# Mind Ontology — Phase 3 Closeout (Multi-Client Distribution)

**Status:** Phase 3 / P3-PR08 (closeout — documentation only, no behavior change)
**Scope:** Phase 3 of the autonomous development plan
(`docs/operator/mind-ontology-autonomous-development-plan-v0.md`).

Phase 3 made the ontology reachable from every major agent client without
forking the core: three local clients are **proven** end-to-end, and the two
hosted chat clients have a **designed** thin-connector path. One ontology, every
agent.

---

## What Phase 3 delivered

| PR | Lane | Result |
|---|---|---|
| P3-PR01 | Claude Code setup proof | stdio handshake e2e test |
| P3-PR02 | Codex setup proof | stdio handshake e2e test (Codex TOML) |
| P3-PR03 | Cursor setup proof | `.cursor/mcp.json` template + e2e test |
| P3-PR04 | Thin connector strategy | hosted-client boundary (design) |
| P3-PR05 | HTTP / thin endpoint design | OpenAPI 3.1 + remote-MCP mapping |
| P3-PR06 | Self-hosted deployment plan | Worker / Node plan (doc only) |
| P3-PR07 | Connector manifest examples | Claude.ai + ChatGPT manifests (placeholders) |
| P3-PR08 | Multi-client adoption closeout | this document |

---

## Adoption matrix

| Client | Transport | Status | Reference |
|---|---|---|---|
| Claude Code | local stdio | **proven** (e2e test) | `mind-ontology-claude-code-setup-proof-v0.md` |
| Codex | local stdio | **proven** (e2e test) | `mind-ontology-codex-setup-proof-v0.md` |
| Cursor | local stdio | **proven** (e2e test) | `mind-ontology-cursor-setup-proof-v0.md` |
| ChatGPT (GPT Action) | remote HTTP | **designed** | `mind-ontology-connector.openapi.json` |
| ChatGPT (dev-mode MCP) | remote HTTP | **designed** | `chatgpt-connector.example.json` |
| Claude.ai (connector) | remote HTTP | **designed** | `claude-ai-connector.example.json` |

"Proven" = an automated test launches the server exactly as the client would and
completes the MCP handshake. "Designed" = the contract, endpoint shapes, and
manifests are fixed and credential-free; the runtime is a later, separately
reviewed deployment.

---

## One contract, every client

All six clients use the **same two read-only operations** over the **same**
compile/MCP handlers:

```text
get_context(task, scope?, format?)   list_constraints(format?)
```

Local clients reach them over stdio; hosted clients reach them over the thin
HTTP surface. Because every surface reuses the same handler module, none can
drift from the others — the stdio setup proofs (P3-PR01..03) double as
contract-level proofs for the remote surface.

The single client instruction is identical everywhere:

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

---

## Safety posture held through Phase 3

- **Local-first:** the proven path needs no network, account, or secret.
- **Read-only everywhere:** no writeback/graph/mutation on any surface.
- **No committed credentials:** every endpoint URL and bearer is a placeholder;
  real values live in the operator's environment.
- **Hosted = design only:** no deploy, wrangler, env, or secret was added in
  Phase 3; the OSS project hosts nothing.

---

## Reference index

Setup proofs: `mind-ontology-claude-code-setup-proof-v0.md`,
`mind-ontology-codex-setup-proof-v0.md`,
`mind-ontology-cursor-setup-proof-v0.md`.
Connector design: `mind-ontology-thin-connector-strategy-v0.md`,
`mind-ontology-http-endpoint-design-v0.md`,
`mind-ontology-selfhost-deployment-plan-v0.md`,
`mind-ontology-connector-manifests-v0.md`.
Templates: `agentctx-setup/claude-code.mcp.json`, `agentctx-setup/codex-config.toml`,
`agentctx-setup/cursor.mcp.json`, `agentctx-setup/mind-ontology-connector.openapi.json`,
`agentctx-setup/claude-ai-connector.example.json`,
`agentctx-setup/chatgpt-connector.example.json`.

---

## Handoff to Phase 4

Phase 4 (Hosted SIRT on-ramp) can build on a proven multi-client local layer and
a fixed, read-only thin-connector contract. The hosted memory / writeback / typed
edge features attach behind an explicit adapter contract with local fail-closed
defaults — they do not change anything Phase 3 shipped.
