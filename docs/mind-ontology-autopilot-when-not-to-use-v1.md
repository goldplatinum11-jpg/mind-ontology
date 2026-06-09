# Mind Ontology — When NOT to Use the Pack v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The honest boundary of the pack's usefulness. Mind Ontology is built for an
autonomous **line** of agents sharing meaning over time; for some tasks that
machinery is overhead, not value. Naming when *not* to reach for it is part of
respecting an adopter's time.

This is guidance, not a guardrail; it touches no engine and needs no hosted SIRT.

---

## Skip the pack when…

- **It is a single-shot task.** One lookup, one summary, one isolated edit needs
  one `get_context` read at most — not a runway, a stop policy, or a Result Pack.
  See [autopilot vs single-shot](mind-ontology-autopilot-vs-single-shot-v1.md).
- **There is no autonomous line.** If a human drives every step and reviews each
  change live, the controller/worker split and the checkpoint cadence add
  ceremony without a problem to solve.
- **There is no shared meaning to keep.** The pack's value is one constitution
  across many agents. A throwaway prototype with a single tool and no durable
  direction has nothing to compile.
- **The task is purely exploratory.** Spiking to learn, where the rules are not
  yet known, is the wrong moment to formalize constraints; write them once they
  stabilize.

## Use the pack when…

- Multiple agents (or a long runway) must agree on direction and constraints.
- The work spans hours and many steps, so context must be re-read on the right
  axis each time.
- A safety floor must be guaranteed present on risky steps, automatically.
- A controller reviews a worker's output and needs a machine-checkable handoff.

These are exactly the conditions the [pack frame](mind-ontology-autopilot-pack-v1.md)
is built for; outside them, a lighter tool is the right call.

---

## Why say this

A product that claims to fit everything fits nothing well. The pack is honest
about its shape — an autonomous-line tool — so adopters apply it where it pays off
and skip it where it would only add overhead. See
[non-goals](mind-ontology-autopilot-non-goals-v1.md) for what it deliberately does
not do, and [adopting incrementally](mind-ontology-autopilot-adopting-incrementally-v1.md)
for the smallest useful starting point when it does fit.
