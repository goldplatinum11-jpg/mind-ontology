# Mind Ontology — Autopilot Reviewer Quickstart v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How a controller reviews a worker's Result Pack in about five minutes — the fast
path through the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md).
Every step is local and files-based; no hosted SIRT.

---

## The five-minute review

1. **Forbidden scope first.** Open the Result Pack and check
   `forbidden_scope_touched`. If it is `true`, reject immediately — this is a hard
   stop, not a fixable nit. Stop here.
2. **Gates green.** Confirm the `validation` block shows `npm test` and
   `npm run agentctx:validate` passing. Re-run them yourself if in doubt; a green
   suite is proof, not narration.
3. **Re-run one guard.** Pick an ADL from `adls_completed` and run its named
   `guard_test`. If the claim holds, the rest are trustworthy by the same
   construction.
4. **Diff matches the change list.** Compare `git status` against the Result Pack's
   `uncommitted_changes`. Nothing undisclosed, nothing invented; the lockfile is
   clean.
5. **Stop-state honest.** If `valid_terminal_stop_reached` is `false`, confirm
   `status` is `in-progress` with a real `reason_for_continuation` — not a stall
   dressed up as continuation.

If all five pass, commit. If any fails, send it back naming the failed step; the
worker continues from there.

## Why this is fast

The review is mechanical because the worker did the discipline first (the
[worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md)) and because
every claim is backed by a re-runnable guard. The controller checks artifacts, not
narration — which is exactly the
[observability](mind-ontology-autopilot-observability-v1.md) the pack provides.

---

Five checks, five minutes, files only. See the
[Result Pack walkthrough](mind-ontology-autopilot-result-pack-walkthrough-v1.md)
for the field-by-field reading.
