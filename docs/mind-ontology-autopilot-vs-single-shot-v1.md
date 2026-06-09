# Mind Ontology — Autopilot vs Single-Shot Agent v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why an autopilot **runway** is a different shape from a one-shot agent call, and
why the pack is designed for the former. A single-shot agent answers once; a
runway runs many steps over hours and must stay safe and on-axis the whole time.

The distinction is local and behavioral; it does not depend on a hosted SIRT
service.

---

## The two shapes

| | Single-shot agent | Autopilot runway |
|---|---|---|
| Duration | one call | many steps over a long session |
| Context | read once, up front | re-read per step (`get_context` each ADL) |
| Safety | judged once | re-checked before every risky write |
| Stopping | returns when done | continues until a valid terminal boundary |
| Output | an answer | a sequence of reviewed artifacts + a Result Pack |

A single-shot agent that reads context once is fine for one answer. A runway that
read context once would drift — which is exactly the
[failure mode](mind-ontology-autopilot-failure-modes-v1.md) the reading protocol
prevents.

## Why a runway needs the pack

- **Re-reading, not one-shot reading.** The
  [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) binds the two
  tools to *every* step, so the agent stays current across hours.
- **Continue, don't return.** A single-shot agent returns at the first clean
  state; a runway treats that state as a checkpoint and keeps going. See
  [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).
- **Reviewable in pieces.** A runway produces a Result Pack per checkpoint, so the
  controller reviews the work in safe increments, not one giant blob.

## When single-shot is the right call

If the task genuinely is one answer — a lookup, a summary, a single edit — a
single-shot agent with one `get_context` read is the simpler, correct choice. The
pack does not force a runway; it makes a *runway* safe when the work is long.

---

The pack is built for the long shape: many on-axis reads, many safe checkpoints,
one valid close. See the [lane lifecycle](mind-ontology-autopilot-lane-lifecycle-v1.md)
for that shape in full.
