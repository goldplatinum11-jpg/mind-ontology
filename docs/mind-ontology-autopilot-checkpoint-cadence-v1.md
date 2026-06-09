# Mind Ontology — Autopilot Checkpoint Cadence v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

When a worker should **checkpoint** on a long runway — write a Result Pack, run
the gates, and hand the controller something reviewable — without mistaking a
checkpoint for a stop.

Checkpointing is a local, files-based act: write the Result Pack, run `npm test`
and `npm run agentctx:validate`. No hosted SIRT call is involved.

---

## A checkpoint is not a stop

The single most important rule: **a checkpoint is a save point, not a terminal
stop.** Reaching a clean, green, well-documented state is exactly when the runway
should *continue* to the next ADL — not end. Green tests and updated docs are
[invalid stop conditions](mind-ontology-autopilot-stop-policy-v1.md).

## When to checkpoint

- After a **coherent batch** of ADLs (a few related artifacts), not after every
  single edit — batching keeps the review unit meaningful.
- Whenever the **full suite and validate are green** and the working tree is in a
  clean, reviewable state.
- Before a **risky or exploratory** next step, so there is a known-good point to
  return to.
- On a **time boundary** (e.g. each runway interval), so progress is durable even
  if the session is interrupted.

## What a checkpoint does

1. Run the gates: focused tests, then `npm test`, then
   `npm run agentctx:validate`. Record real results.
2. Confirm the working tree is in scope and the lockfile is clean.
3. Update the [Result Pack](mind-ontology-autopilot-result-pack-v1.md): bump the
   checkpoint counter, append the completed ADLs, refresh the uncommitted-changes
   list.
4. **Continue** to the next ADL — unless a *valid* terminal stop condition is met.

## Batch sizing

Too small and the controller drowns in micro-handoffs; too large and a failure is
expensive to localize. A good batch is a handful of ADLs that share a theme and
leave the suite green. Each ADL still pairs an artifact with a guard test.

The cadence pairs with [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md)
and the [worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md): every
checkpoint is a clean, honest, in-scope save point the runway continues from.
