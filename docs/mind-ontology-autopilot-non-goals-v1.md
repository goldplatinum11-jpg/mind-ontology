# Mind Ontology — Autopilot Pack Non-Goals v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

What the pack **deliberately does not do**. Naming the non-goals is as important
as naming the goals: it keeps the trust surface small and tells an adopter exactly
where the local layer ends and the optional hosted layer begins.

Each non-goal is a boundary the pack holds on purpose; none is a missing feature.

---

## The pack does NOT

- **Store durable memory.** It is a task-scoped policy compiler, not a memory app.
  Cross-session history is the hosted axis. See
  [why local-first](mind-ontology-autopilot-why-local-first-v1.md).
- **Provide a write path.** The two tools are read-only; there is no write,
  delete, or mutate tool. Writeback is a separate, proposal-only, fail-closed
  adapter. See [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md).
- **Run a graph or vector store.** No typed-edge inference, no embeddings, no
  retrieval ranking beyond the local lexical compiler. Those are hosted SIRT.
- **Embed an autonomy controller.** The pack describes how a line *uses* Mind
  Ontology; it does not import or ship the SIRT runner/control-plane. See the
  [pack frame](mind-ontology-autopilot-pack-v1.md).
- **Require a hosted dependency.** No account, no network, no service in the free
  path. Hosted features are opt-in and off by default.
- **Add a third tool.** The surface is exactly `get_context` and
  `list_constraints`. See [two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md).
- **Make the line stop on convenience.** A green checkpoint is not a stop; the
  line continues. See [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).

---

## Why name non-goals

An adopter must know what they are *not* getting so they neither over-trust the
layer nor wait for a feature that lives elsewhere. The non-goals also act as a
review rule: a change that would add any of the above is out of scope for this
pack and belongs in a hosted lane behind the adapter contracts.

The non-goals are the negative space of the
[manifest](mind-ontology-autopilot-manifest-v1.md): everything the pack ships is
local, read-only, and auditable; everything above is, on purpose, somewhere else.
