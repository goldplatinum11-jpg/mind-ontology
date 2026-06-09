# Mind Ontology — Adopting the Pack Incrementally v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A safe on-ramp: how a line adopts Mind Ontology one file at a time, getting value
at every step. You never need the full nine-file ontology to start — begin with
the safety floor and grow as the line earns more meaning. This is the
[minimal-vs-full spectrum](mind-ontology-autopilot-minimal-vs-full-v1.md) read as a
*sequence*.

Local-first throughout: no account, no network, no hosted SIRT at any step.

---

## The adoption sequence

### Step 1 — `constraints.md` only

Start with the safety floor and the stop policy. The line can already answer "what
must I never do, and when must I stop?" — see
[empty-ontology behavior](mind-ontology-autopilot-empty-ontology-v1.md). This is a
valid, safe line on day one.

### Step 2 — add `direction.md` and `agent-roles.md`

Now the line has a task axis and role triggers: `get_context(task)` returns scoped
direction, and the worker/controller split is explicit. This is the smallest line
that feels like an autopilot line rather than just a guardrail.

### Step 3 — add `projects.md` and `decisions.md`

Multi-project scoping and durable rationale come online: tasks surface the right
project block and the relevant prior decision.

### Step 4 — add the rest

`identity.md`, `architecture.md`, `glossary.md`, and `cq.md` round out the
constitution and turn on competency-question verification.

---

## Why incremental is safe

- **Every step is valid.** A file you have not added yet simply contributes no
  blocks; the compiler never crashes and never dumps. See
  [non-goals](mind-ontology-autopilot-non-goals-v1.md).
- **The floor is there from step 1.** `constraints.md` is always included, so the
  safety contract holds before any other file exists.
- **No big-bang migration.** You are not forced to author a whole ontology before
  the line is useful; value compounds file by file.

## Where to stop

There is no required end state. A line can run forever at step 1 if its only need
is a safety floor, or grow to nine files when it coordinates many projects. Add a
file when a task needs it, not before. See
[minimal vs full](mind-ontology-autopilot-minimal-vs-full-v1.md) and the
[adoption walkthrough](mind-ontology-autopilot-adoption-v1.md) for the mechanics.

---

Start small, stay safe, grow on demand: the constitution meets the line where it
is. See [the pack frame](mind-ontology-autopilot-pack-v1.md).
