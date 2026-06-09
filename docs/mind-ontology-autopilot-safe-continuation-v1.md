# Mind Ontology — Autopilot Safe Continuation v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why a long autopilot runway optimizes for **safe continuation, not safe stopping**
— and why that is a safety posture, not a reckless one. This doc ties the
[stop policy](mind-ontology-autopilot-stop-policy-v1.md) and the
[checkpoint cadence](mind-ontology-autopilot-checkpoint-cadence-v1.md) into one
principle.

This is policy reasoning only; it executes nothing and depends on no hosted SIRT.

---

## The principle

A productive runway ends on a **boundary or a budget**, never on a convenient
checkpoint. "Optimize for safe continuation" means: when the work is green and
in-scope and a next action exists, **continue** — do not look for an excuse to
stop.

This is the opposite of the usual single-turn instinct ("reach a clean state, then
stop"). On a runway, a clean state is a *save point*, and the right move from a
save point is the next ADL.

## Why continuation is the safe choice

- **Stopping early wastes a runway.** A line that halts on "tests passed" leaves
  hours of safe, in-scope work undone — the operator asked for the work, not for a
  tidy early exit.
- **The boundaries are explicit.** Continuation is only ever *inside* the write
  scope and the constraints. The line never crosses a forbidden boundary to stay
  busy — that would be unsafe, and it is itself a valid terminal stop.
- **Checkpoints make continuation durable.** Each checkpoint writes a Result Pack
  and runs the gates, so progress survives interruption. Continuation does not
  mean "never save"; it means "save and keep going".

## Safe stopping is still defined — and narrow

Continuation does not erase the stop conditions. The line still stops on a *valid*
terminal condition: a time budget, an operator STOP, a deploy/secrets/irreversible
boundary, an unavoidable forbidden-scope edit, an unresolvable contradiction, or
the same hard blocker three times. Everything else — green tests, updated docs, a
denied commit, no remote — is an **invalid** stop, and the line continues.

## The throughline

Safe continuation and safe stopping are two halves of one rule: **keep doing safe,
in-scope work until a real boundary says stop.** The stop policy names the
boundaries; the checkpoint cadence keeps the continuation durable; scope discipline
keeps it inside the lines.
