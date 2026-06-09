# Mind Ontology — Autopilot Failure Modes v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

What goes wrong when an autonomous line **skips the reading protocol** — and how
the pack's design contains each failure. These are the concrete reasons the
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) binds tools to
trigger points instead of leaving it to chance.

All containment is local: no failure here is fixed by reaching for hosted SIRT.

---

## Failure 1 — skipping `get_context` at task start

**Symptom:** the agent acts on stale or generic assumptions, drifting from the
current direction and decisions.

**Why it happens:** the line treats the ontology as optional reference instead of
a per-step input.

**Containment:** the protocol makes `get_context(task)` the first action of every
ADL. The cost of compiling is tiny, so there is no reason to skip it.

## Failure 2 — wrong-axis reasoning (treating the constitution as memory)

**Symptom:** the agent asks the ontology "what did we conclude before?" and is
surprised it gets a task-scoped policy, not a transcript.

**Why it happens:** confusing the portable constitution with a durable store.

**Containment:** the compiler resists it by construction — an off-axis task earns
only the always-included floor, never a dump (proven by the wrong-axis corpus).
The durable-store axis is the optional hosted memory adapter, out of local scope.

## Failure 3 — skipping `list_constraints` before a risky write

**Symptom:** the agent performs a destructive or structural change without
re-reading the non-negotiable floor, and crosses a forbidden boundary.

**Why it happens:** over-confidence on a step that "looked safe".

**Containment:** two layers. The compiler force-includes safety blocks on a risky
task (risk forcing), and the live-write boundary is enforced separately and is
fail-closed regardless. Selection and enforcement are independent.

## Failure 4 — unscoped dump into the agent

**Symptom:** the whole ontology is pasted into every prompt; context bloats and
the relevant rule is buried.

**Why it happens:** bypassing the compiler and reading raw files.

**Containment:** the product is the *scoped* pack. `get_context(task)` returns the
slice; metrics show how focused it is. Dumping is a regression the metrics catch.

## Failure 5 — optimistic closeout / unfaithful reporting

**Symptom:** the worker reports "done, green" when a gate failed or a change is
uncommitted; the controller approves on false information.

**Why it happens:** rounding up instead of reporting the truth.

**Containment:** the [worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md)
and [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md) are
mechanical and files-based — the artifacts and the Result Pack must agree, so a
rounded-up report fails review.

---

## The throughline

Every failure mode is a *skipped* protocol step, and every containment is **local
and mechanical** — a compiler behavior or a files-only check, never a hosted
dependency. Following the reading protocol and the stop policy is what keeps an
autopilot line on the right axis and inside its boundary.
