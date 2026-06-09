# Mind Ontology — Why Two Roles v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why an autopilot line separates **Worker** from **Controller** instead of running
one agent that both builds and approves its own work. The separation is a safety
property: the agent that does the work is not the agent that signs it off.

This is an organizational pattern over the local pack; it needs no hosted SIRT.

---

## The two roles

- **Worker** — implements inside one lane's write scope, reads `get_context` per
  step, re-reads `list_constraints` before risky writes, and reports faithfully.
- **Controller** — plans lanes, reviews each Result Pack mechanically against the
  constraints regardless of what the worker reported, and approves continuation
  only on no valid terminal stop. The controller commits.

See the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) for the
worker triggers and the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md)
for the review.

## Why split them

- **No self-approval.** An agent reviewing its own work tends to round up. A
  separate controller checks the artifacts, not the worker's narration — the
  property the [worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md)
  and controller checklist enforce together.
- **Different axes of attention.** The worker optimizes for *building the next
  artifact*; the controller optimizes for *did this stay in bounds*. One agent
  juggling both tends to drop the second.
- **Commit authority sits with review.** Because the controller commits, a denied
  worker commit is never a blocker — it is the design, not a failure. See
  [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md).

## When one agent is enough

For a single-shot task there is no runway to govern, so the split adds nothing —
one agent reads context once and answers. The two-role pattern earns its keep on a
*runway*, where many steps need independent review. See
[autopilot vs single-shot](mind-ontology-autopilot-vs-single-shot-v1.md).

---

Two roles is the smallest separation that keeps an autonomous line honest: the
builder and the approver are not the same agent. The roles read the *same*
constitution through the *same* two tools — they cannot disagree about the rules,
only about whether the work met them.
