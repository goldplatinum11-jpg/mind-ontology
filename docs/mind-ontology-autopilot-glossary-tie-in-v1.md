# Mind Ontology — Autopilot Glossary Tie-In v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A single place that defines each autopilot term and points to where it is
specified, so an operator reading the pack never has to guess what a word means.
It complements the [autopilot concepts](mind-ontology-autopilot-concepts-v1.md)
doc (which maps terms onto product concepts); this one is a flat glossary with a
source link per term.

Local-only: every definition resolves to a file in this repo; none needs hosted
SIRT.

---

## Glossary

| Term | Meaning | Defined in |
|---|---|---|
| **Runway** | a long-running autonomous work session of many lane steps | [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md) |
| **Lane** | one bounded, reviewable unit of work with a write scope and stop policy | [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md) |
| **ADL** | the smallest work cycle: inspect → artifact → guard → test → continue | [checkpoint cadence](mind-ontology-autopilot-checkpoint-cadence-v1.md) |
| **Result Pack** | the JSON a worker returns to the controller at each checkpoint | [result-pack shape](mind-ontology-autopilot-result-pack-v1.md) |
| **Worker** | the agent that edits inside the lane scope and reports faithfully | [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) |
| **Controller** | the agent that plans, reviews, and approves continuation | [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md) |
| **Right-axis read** | reading the constitution as a task-scoped policy | [concepts](mind-ontology-autopilot-concepts-v1.md) |
| **Wrong-axis read** | mistaking the constitution for a memory/lookup store | [failure modes](mind-ontology-autopilot-failure-modes-v1.md) |
| **Stop policy** | the rule deciding when a line may terminate | [stop policy](mind-ontology-autopilot-stop-policy-v1.md) |
| **Risk forcing** | auto-inclusion of safety blocks on a destructive task | [risk modes](mind-ontology-autopilot-risk-modes-v1.md) |
| **Two-tool surface** | `get_context` and `list_constraints`, read-only, the whole API | [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md) |

---

## How this differs from your `.agentctx/glossary.md`

This glossary is the **pack's own** vocabulary — the words used to describe an
autopilot line. Your `.agentctx/glossary.md` holds *your* product's terms, which
the compiler scores and serves like any other source file. The two never mix:
pack vocabulary explains the pack; your glossary explains your domain.

See the [product concepts](concepts.md) for Mind Ontology's base vocabulary.
