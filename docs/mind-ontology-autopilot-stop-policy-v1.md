# Mind Ontology — Autopilot Stop Policy v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

An autonomous line must know **when it is allowed to stop** and, just as
importantly, when stopping would be a mistake. This doc encodes that policy as
portable product context so a line reads it from `.agentctx/` instead of having
each operator re-invent it. The goal is **safe continuation**, not safe stopping.

This is policy text only. It executes nothing, calls no runner, and depends on no
hosted SIRT control plane.

---

## Valid terminal stop conditions

A line may stop only when one of these is true:

- A bounded **time budget** has elapsed (e.g. a 5+ hour runway).
- An **explicit operator STOP**.
- A **deploy / migration / secrets / production / live-data** boundary is reached.
- **Material cost exposure** without an approved budget.
- An **auth failure** blocks the current necessary action.
- A **destructive or irreversible** action is required to proceed.
- A **forbidden-scope** edit cannot be avoided.
- A **canonical contradiction** that cannot be resolved inside the lane.
- The **same hard blocker repeats three times**.

These are the only legitimate reasons to end a runway early. Each is either a
safety boundary, a budget boundary, or a genuine dead end.

---

## Invalid stop conditions

None of these is a reason to stop. If a line is tempted to stop for one of them,
it should continue to the next action instead:

- One task / ADL completed.
- Tests passed.
- Docs updated.
- Templates created.
- The modeled scope finished before the time budget.
- A git commit was denied (commits are the controller's job, not a blocker).
- No remote configured.
- An optional live probe is pending.
- A next action plainly exists.

The unifying rule: **the existence of more safe, in-scope work is not a stopping
condition.** Productive lanes end on a boundary or a budget, never on "a
convenient checkpoint".

---

## How an agent applies it

1. At a would-be stopping point, the agent checks the **valid** list first. If
   none matches, stopping is not authorized.
2. It then checks the **invalid** list. If the reason it wanted to stop is here,
   it must continue to the next ADL.
3. Forbidden-scope and destructive-action stops are *hard*: the agent stops and
   reports rather than working around the boundary.
4. Denied commits and a missing remote are explicitly **not** blockers. The
   worker leaves changes uncommitted and reports them; the controller reviews and
   commits if appropriate.

This mirrors the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md):
at each lane step the worker calls `get_context(task)`, and before approving
continuation the controller re-reads `list_constraints()` and this policy, then
continues unless a *valid* terminal condition is met.

---

## Boundary, not behavior change

The stop policy decides **whether the line keeps running**. It does not relax any
safety guardrail:

- The live-write boundary is still enforced separately at the adapter layer and
  still fails closed (flags off by default, writeback proposal-only).
- "Continue" never means "cross a forbidden boundary to keep busy". Continuation
  is always *inside* the write scope and constraints.

A line that mistakes an invalid condition for a valid one wastes a runway; a line
that crosses a valid boundary to avoid stopping is unsafe. This policy exists to
prevent both.

See the [autopilot pack frame](mind-ontology-autopilot-pack-v1.md) and
[task risk modes](mind-ontology-task-risk-modes-v0.md).
