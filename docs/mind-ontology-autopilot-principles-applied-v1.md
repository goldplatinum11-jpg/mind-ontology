# Mind Ontology — Principles Applied: A Worked Lane v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The [six principles](mind-ontology-autopilot-principles-v1.md) are abstract until
you watch them shape one lane. This doc walks a single, ordinary lane step and
shows each principle doing visible work — so a reader sees the spine in motion.

All local: no account, no network, no hosted SIRT.

---

## The lane: "Tidy the onboarding docs, then drop a stale table"

### Step open — *local-first* and *two read-only tools*

The worker calls `get_context("tidy the onboarding docs")`. The compiler reads
local `.agentctx/` files and returns a task-scoped pack through the only two tools
that exist. No service, no account — **local-first** and the **two-tool** surface
in action.

### Reading the pack — *right-axis read*

The pack is the slice for *this* task: the relevant direction and the
always-included constraints, not the whole ontology and not a history lookup. The
agent reasons on the returned axis — the **right-axis read**.

### The risky part — *mechanical enforcement*

"Drop a stale table" is destructive, so before that write the worker calls
`list_constraints()`, and the compiler also force-includes the safety blocks. A
guard test proves the floor was present — **mechanical enforcement**, not a
promise.

### Deciding whether to continue — *safe continuation*

The docs are tidied and green. That is a checkpoint, not a finish line: no valid
terminal boundary was reached, so the worker continues to the next ADL — **safe
continuation**.

### The boundary it never crossed — *opt-in hosted*

At no point did the lane reach for durable memory or a write to a hosted store. If
the team wanted that, it would be the optional, fail-closed hosted layer — **opt-in
hosted**, never required.

---

## The takeaway

Every step of an ordinary lane is one of the six principles doing its job. They are
not decoration on the pack; they are the behavior. See the
[principles](mind-ontology-autopilot-principles-v1.md) for the list and the
[lane lifecycle](mind-ontology-autopilot-lane-lifecycle-v1.md) for the phases this
walk maps onto.
