# Mind Ontology — Two-Tool vs Many-Tool v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why an autopilot line is wired onto **two** read-only tools instead of a sprawling
toolset — and why that smallness is a feature, not a limitation. This is the
rationale behind the [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md).

The argument is about trust and is fully local: a small surface is exactly what
makes the layer auditable without a hosted SIRT dependency.

---

## The anti-pattern: tool sprawl

A common autonomous-agent design exposes many tools — search, fetch, write,
remember, plan, summarize. Each new tool:

- **widens the trust surface** the operator must reason about,
- **adds a way to act** that may sit outside the safety boundary,
- **invites wrong-axis use** (a `remember` tool nudges the line to treat context as
  a store, not a task-scoped policy),
- **drifts between clients** as each tool is wired slightly differently.

The more tools, the harder it is to answer the only question that matters: *can I
trust what this agent will do?*

## The pattern: two read-only tools

Mind Ontology exposes exactly `get_context(task)` and `list_constraints()`, both
read-only. This is deliberately minimal:

- **One trust surface.** Two read-only calls cannot mutate anything; the operator
  audits the whole API in a sentence.
- **No off-axis affordance.** There is no memory/search/write tool to misuse, so
  the line stays on the right axis by construction.
- **Identical everywhere.** Two tools are trivial to mirror across Claude Code,
  Codex, Cursor, and a thin connector, so clients cannot drift.

## "But don't you need more?"

No — the line needs *when*, not *more*. Everything an autopilot line does is one of
those two reads at the right moment, governed by the
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) and the
[stop policy](mind-ontology-autopilot-stop-policy-v1.md). Durable memory, search,
and writeback are real needs — but they belong to the **optional, fail-closed
hosted layer**, not the local auditable surface. Keeping them out of the two-tool
contract is what lets the free layer stay trustable.

---

The smallest surface that does the job is the most trustable one. Two read-only
tools is that surface for an autopilot line. See the
[trust posture](mind-ontology-trust-security-model-v0.md) for the wider model.
