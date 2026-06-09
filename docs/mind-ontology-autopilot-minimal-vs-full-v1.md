# Mind Ontology — Minimal vs Full Autopilot Ontology v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

An autopilot line does not need a complete ontology to start. The schema is a
*spectrum*: a line can ship only `constraints.md` and grow from there. This doc
shows both ends and why each works.

Both ends are local-first: no account, no network, no hosted SIRT.

---

## The minimal line — `constraints.md` only

The smallest viable autopilot ontology is a single `constraints.md` with the
safety floor and the stop policy. Because `constraints.md` is **always included**,
every compiled pack still carries the non-negotiables, even with no other file.

```text
.agentctx/
  constraints.md   # safety floor + stop policy — always included
```

A line at this end gets:

- the full set of constraints on every task (`reason: "always"`),
- risk forcing of safety blocks on destructive tasks,
- a valid pack for any task, with no other source files to score.

It does **not** get scoped direction, decisions, roles, or vocabulary — there are
none yet. That is a deliberate starting point, not a broken state.

## The full line — the nine-file ontology

The other end ships all nine source files (constraints, identity, direction,
projects, decisions, architecture, agent-roles, glossary, cq). A task now earns
the matching direction/role/decision blocks on top of the always-included floor,
and competency questions verify the line can answer what it must before acting.

```text
.agentctx/
  constraints.md identity.md direction.md projects.md decisions.md
  architecture.md agent-roles.md glossary.md cq.md
```

---

## Growing along the spectrum

- Start with `constraints.md` so the safety floor and stop policy are in from day
  one.
- Add `direction.md` and `agent-roles.md` next — they give the line its task axis
  and its role triggers.
- Add the rest as the line accumulates decisions, vocabulary, and competency
  questions.

A file you omit simply contributes no blocks; there is no "core files first,
others later" gate in the compiler. The minimal line and the full line use the
**same** two read-only tools and the same compiler.

This spectrum is exercised by `tests/fixtures/autopilot-minimal/` (constraints
only) and `tests/fixtures/autopilot-line/` (all nine), both compiled by
`tests/unit/autopilot-minimal-vs-full.test.mjs`.
