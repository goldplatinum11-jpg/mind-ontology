# Mind Ontology — Autopilot Cost Model v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

What an autopilot line costs to run on the free layer: effectively nothing beyond
the operator's own machine. The only paid axis is the optional hosted layer — and
it is never required.

---

## The free local path

Compiling a context pack and reading constraints are local file operations. So:

- **No per-call cost.** `get_context` and `list_constraints` are local; calling
  them a thousand times in a long runway adds no service bill.
- **No rate limit.** There is no provider quota on the compiler; a runway is paced
  by the work, not by a throttle.
- **No outage.** With nothing hosted in the load-bearing path, the line cannot be
  taken down by a service being unavailable. See
  [why local-first](mind-ontology-autopilot-why-local-first-v1.md).

The only real cost is the agent model the operator already pays for to run the
agent at all — Mind Ontology does not add to it.

## The one paid axis

The hosted SIRT layer (durable memory, retrieval, writeback execution, multi-tenant
storage) is the paid axis. It is opt-in, fail-closed, and off by default, so a line
incurs that cost only if and when a team chooses it. See
[two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md) for where
those capabilities live and [non-goals](mind-ontology-autopilot-non-goals-v1.md)
for what the free layer deliberately leaves out.

## Why this matters for a runway

A 5-hour runway makes thousands of context reads. If each read cost money or
counted against a quota, long autonomous lines would be expensive or throttled. A
local compiler makes the read essentially free, which is what makes a stopless
runway practical in the first place. See
[safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).

---

The cost model is the simplest possible: the free layer is free to run, and the
hosted layer is the only thing you ever pay for — and only if you opt in. See
[commercial positioning](mind-ontology-commercial-positioning-v0.md) for the
product-wide framing.
