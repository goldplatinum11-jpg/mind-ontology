# Mind Ontology — Autopilot Pack Principles v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The handful of principles every artifact in the pack embodies. If a new doc,
fixture, or template does not honor all of them, it does not belong in v1. This is
the pack's design spine in one page.

---

## The principles

1. **Local-first.** The free path is files plus two read-only tools — no account,
   no network, no hosted SIRT in the load-bearing path. See
   [why local-first](mind-ontology-autopilot-why-local-first-v1.md).
2. **Two read-only tools.** The entire surface is `get_context` and
   `list_constraints`; nothing mutates, nothing else is exposed. See the
   [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md).
3. **Right-axis read.** Context is task-scoped policy, not a memory store; the
   compiler returns a slice, never a dump. See
   [concepts](mind-ontology-autopilot-concepts-v1.md).
4. **Safe continuation.** A runway ends on a boundary or a budget, never on a
   convenient checkpoint. See
   [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).
5. **Mechanical enforcement.** Every claim is backed by a guard test; the pack's
   own consistency is machine-checked, not promised. See the
   [maturity self-audit](mind-ontology-autopilot-maturity-audit-v1.md).
6. **Opt-in hosted.** Durable memory, retrieval, and writeback are the optional,
   fail-closed hosted layer — never required for the line to work. See
   [non-goals](mind-ontology-autopilot-non-goals-v1.md).

---

## Why principles, not just docs

Docs describe; principles decide. When a contributor asks "should this artifact
exist, and in this shape?", the answer is whether it honors all six. A pack with a
clear spine stays coherent as it grows — which is the same property the
[guards](mind-ontology-autopilot-guard-glossary-v1.md) enforce mechanically. The
principles are the human-readable version of what the guards check.

If you remember six things about the pack, remember these. See
[the pack frame](mind-ontology-autopilot-pack-v1.md).
