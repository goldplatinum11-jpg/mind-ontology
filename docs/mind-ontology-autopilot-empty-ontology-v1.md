# Mind Ontology — Autopilot Empty-Ontology Behavior v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

What a **bare, constraints-only** autopilot line does — and does not — do. A line
can start with nothing but `constraints.md`, and that is a valid, safe state, not a
broken one. This is the minimal end of the
[minimal-vs-full spectrum](mind-ontology-autopilot-minimal-vs-full-v1.md), examined
on its own.

Local-only: the bare line needs no account and no network.

---

## What a constraints-only line answers

- **What must I never do?** `list_constraints()` returns the full floor; every
  compiled pack carries it (`reason: "always"`). The
  [safety-floor proof](mind-ontology-autopilot-safe-continuation-v1.md) holds even
  here — the floor is never dropped.
- **Is this task risky?** Risk classification works regardless of ontology size,
  and safety-tagged constraints are forced on a destructive task.

So the agent can always answer "what is forbidden, and when must I stop?" — the
two questions that keep it safe — from `constraints.md` alone.

## What it cannot answer yet

- **What direction does this serve?** There is no `direction.md`, so no scoped
  direction blocks surface.
- **Which decision applies / which role / which term?** No `decisions.md`,
  `agent-roles.md`, or `glossary.md` means those reads return only the floor.

These are *absences*, not errors: a task that needs them simply gets the floor and
nothing extra, never a crash and never a dump.

## Why this is still valid

The product promise is that `constraints.md` is the one required file and the
always-included floor. A bare line therefore has a working safety contract from day
one; everything else is additive. Start here, then grow along the
[spectrum](mind-ontology-autopilot-minimal-vs-full-v1.md) as decisions and
vocabulary accumulate.

This behavior is exercised by `tests/fixtures/autopilot-minimal/` and the
[cross-fixture safety-floor proof](mind-ontology-autopilot-non-goals-v1.md)-adjacent
guards.

---

Empty is not broken: a constraints-only line is the smallest safe line, answering
the questions that matter most before any other meaning is added. See
[minimal vs full](mind-ontology-autopilot-minimal-vs-full-v1.md).
