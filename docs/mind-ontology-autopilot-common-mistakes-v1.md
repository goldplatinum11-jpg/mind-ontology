# Mind Ontology — Autopilot Common Mistakes v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A one-line-each quick reference of the mistakes an autopilot line makes, with the
fix and the doc that covers it in full. This condenses the
[failure modes](mind-ontology-autopilot-failure-modes-v1.md) into a scannable
checklist. Local-only; no fix here reaches for hosted SIRT.

---

## Mistakes and fixes

- **Skipping `get_context` at task start** → reason on stale assumptions. *Fix:*
  call it first, every ADL. → [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md)
- **Treating the constitution as memory** → asking it for history. *Fix:* read it
  as a task-scoped policy; history is the hosted axis. → [concepts](mind-ontology-autopilot-concepts-v1.md)
- **Skipping `list_constraints` before a risky write** → crossing a boundary.
  *Fix:* re-read constraints before destructive/structural changes. → [risk modes](mind-ontology-autopilot-risk-modes-v1.md)
- **Dumping the whole ontology** → context bloat, buried rule. *Fix:* use the
  scoped pack, not raw files. → [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md)
- **Closing at a green checkpoint** → wasting the runway. *Fix:* a checkpoint is a
  save point; continue. → [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md)
- **Optimistic closeout** → reporting "green" when a gate failed. *Fix:* report
  faithfully, artifacts and report must agree. → [worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md)
- **Editing out of scope** → a forbidden write. *Fix:* revert it; an unavoidable
  forbidden edit is a valid stop. → [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md)
- **Adding a third tool** → widening the trust surface. *Fix:* keep the two
  read-only tools. → [two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md)

---

If you only read one page before wiring a line, read this one, then follow the
links for the why. The full treatment is in
[failure modes](mind-ontology-autopilot-failure-modes-v1.md).
