# Mind Ontology — Autopilot Risk Modes v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

An autopilot line touches risky steps — deletes, migrations, deploys. Mind
Ontology makes the safety context **automatic** on those steps: when a task reads
as destructive or structural, the compiler forces the safety-tagged blocks into
the pack regardless of relevance score. The line does not have to remember to ask.

This is selection behavior only. It decides *what context the agent sees*; the
live-write boundary is enforced separately at the adapter layer and still fails
closed. See the product [task risk modes](mind-ontology-task-risk-modes-v0.md).

---

## How forcing works on a lane step

1. The worker calls `get_context(task)` for the step as usual.
2. The compiler classifies the task. A destructive/structural signal
   (`delete`, `drop`, `migrate`, `deploy`, `production`, `secret`, …) makes the
   task **risky**.
3. On a risky task, every safety-tagged block that would otherwise be omitted is
   added back with `reason: "risk-forced"`. `constraints.md` blocks are already
   `reason: "always"`, so the safety floor is present either way.
4. The worker reads the forced safety context, then still honors the stop policy
   and the fail-closed write boundary before acting.

So a risky autopilot step always sees the safety blocks, even if the task wording
did not lexically match them.

---

## What stays true regardless of risk

- **Safe tasks are not inflated.** An ordinary docs or planning step gets a small,
  scoped pack with no forced blocks (`reason: "risk-forced"` appears nowhere).
- **The floor is unconditional.** `constraints.md` is always included on every
  task, risky or not.
- **Forcing is not permission.** Seeing the safety context never authorizes the
  risky write. The adapter boundary stays off-by-default and proposal-only.

---

## The line's contract

For an autopilot line the rule is simple: *trust the compiler to surface safety on
risky steps, and never treat that surfacing as a green light.* The reading
protocol still requires a `list_constraints()` re-read before the irreversible
action, and the stop policy still governs whether the line proceeds at all.

This behavior is demonstrated against the `tests/fixtures/autopilot-line/`
ontology by `tests/unit/autopilot-risk-modes.test.mjs`: a risky task force-includes
a safety block, an ordinary task does not.
