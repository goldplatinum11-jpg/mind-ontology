# Mind Ontology — Autopilot Tool-Call Ordering v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The order of the two tool calls *within a single step*. The
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) says *when* each
tool fires; this doc fixes the **sequence** so an agent never inspects or edits
before it has context, and never writes a risky change before it has re-read the
floor.

Local-only: both calls read local files; the ordering adds no tool and no network.

---

## The sequence within one step

1. **`get_context(task)` first — before inspecting or editing.** Load the
   task-scoped pack at the top of the step, so every subsequent decision is made on
   the right axis. Reading the repo before reading context risks acting on stale
   assumptions.
2. **Work inside the returned context.** Inspect, plan, and make in-scope edits
   guided by the pack.
3. **`list_constraints()` before the risky write — not after.** If the step
   includes a destructive or structural change, re-read the floor *before*
   performing it. Re-reading after the write is too late.
4. **Report after.** Record what happened faithfully; commits are the controller's.

The rule of thumb: **context before action, constraints before the irreversible
action, report after the fact.**

## Why order matters, not just presence

Calling both tools but in the wrong order defeats them:

- `get_context` *after* editing means the edit was made blind.
- `list_constraints` *after* the destructive write means the guard fired too late
  to prevent crossing the boundary.

Presence is necessary but not sufficient; the sequence is what makes the protocol
protective. See [risk modes](mind-ontology-autopilot-risk-modes-v1.md) for the
forcing that backs step 3 and [failure modes](mind-ontology-autopilot-failure-modes-v1.md)
for what each out-of-order call breaks.

---

Right order, every step: context, then work, then constraints before the
irreversible action, then an honest report. See the
[lane lifecycle](mind-ontology-autopilot-lane-lifecycle-v1.md) for the same
sequence at the lane scale.
