# Mind Ontology — Autopilot Pack One-Paragraph Pitch v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The whole pack in a paragraph, for a busy reviewer who wants the gist before
reading further.

---

## The pitch

> The Autopilot Integration Pack makes Mind Ontology consumable by an autonomous
> AI development line. It gives every agent — a Codex controller, a Claude Code
> worker, Cursor, or a connector-backed ChatGPT — **one portable constitution**
> (`.agentctx/` Markdown) compiled to a task-scoped slice through exactly **two
> read-only tools**, `get_context(task)` and `list_constraints()`. The pack
> documents *when* each agent reads it (context at task start, constraints before a
> risky write), *when the line may stop* (a real boundary or a budget, never a
> convenient checkpoint), and *how a controller reviews the handoff* (a plain-JSON
> Result Pack plus re-runnable guard tests). It is **local-first** — no account, no
> network, no hosted SIRT in the load-bearing path — and **self-enforcing**: every
> claim has a guard test, and the pack's own consistency is machine-checked. Use it
> when multiple agents or a long runway must agree on direction and stay inside a
> safety floor; skip it for one-shot tasks.

---

## The four beats

- **What:** one constitution, two read-only tools, compiled per task.
- **Who:** an autonomous line — controller + worker(s) + any MCP client.
- **Why:** stop drift across tools, keep a safety floor on risky steps, review in
  machine-checkable increments.
- **Boundary:** local-first and OSS-safe; hosted memory/retrieval/writeback is the
  optional, fail-closed paid layer, never required.

For the long form, start at the [pack frame](mind-ontology-autopilot-pack-v1.md);
for the principles behind it, see
[pack principles](mind-ontology-autopilot-principles-v1.md).
