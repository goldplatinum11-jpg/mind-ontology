# Mind Ontology — Autopilot Controller Review Checklist v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

What the controller verifies before approving a worker's checkpoint and before
committing. The checklist is **local and mechanical** — every item is checkable
from the repo and the [Result Pack](mind-ontology-autopilot-result-pack-v1.md),
with no hosted SIRT call.

The controller reads `list_constraints()` and the
[stop policy](mind-ontology-autopilot-stop-policy-v1.md) first, then runs this
list against the worker's result regardless of what the worker reported.

---

## Before approving continuation

1. **Write scope respected.** Every changed path is inside the lane's allowed
   scope; `forbidden_scope_touched` is `false`. If a forbidden path was touched,
   reject — that is a hard stop, not a fixable nit.
2. **Guards present.** Every ADL in the Result Pack names a `guard_test`, and that
   test exists and passes (`npm test`). Prose without a guard does not count as
   done.
3. **Validation green.** `npm run agentctx:validate` reports `0 errors`, and the
   full suite passes. No "mostly green".
4. **No leakage.** No new artifact embeds a hosted host, token, or private clone
   path (the leakage sweep covers autopilot artifacts automatically).
5. **Stop state honest.** If `valid_terminal_stop_reached` is `false`, `status` is
   `in-progress` and a real `reason_for_continuation` is given — not a stall
   dressed up as continuation.

## Before committing

6. **Uncommitted changes match the Result Pack.** The `added` / `modified` lists
   reflect the actual working tree; nothing undisclosed.
7. **Lockfile clean.** `package-lock.json` carries no stray delta from an install.
8. **Scope-only diff.** The commit touches only docs/tests/fixtures/templates (and
   `README.md` / `NEXT-LANES.md`); no engine, package manifest, or config files.

If all eight hold, the controller may commit. If any fails, it sends the result
back with the specific failed item — the worker continues from there.

---

## Why mechanical

Every item is a yes/no the controller (or a CI step) can answer from files alone.
That keeps the review **fast, repeatable, and trust-minimizing** — the same
property the free layer has: you can check it in a PR. The controller never has to
trust the worker's narration over the artifacts.

See the [worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md) for the
mirror list the worker runs before reporting.
