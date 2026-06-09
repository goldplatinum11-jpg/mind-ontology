# Mind Ontology — Autopilot Result Pack Walkthrough v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A field-by-field reading of an actual Result Pack, so a worker can produce one and
a controller can read one without guessing. It annotates the example at
`tests/fixtures/autopilot-result-pack.example.json`, which is held to the shape by
the [Result Pack shape guard](mind-ontology-autopilot-result-pack-v1.md).

The Result Pack is plain local JSON — copy-paste is the transport; no hosted SIRT
ingest is required to read or validate it.

---

## Walkthrough

- **`schema`** — the shape id (`sirt.result-pack/v1`). Lets the controller pick
  the right validator.
- **`lane` / `branch`** — which lane ran and the (uncommitted) branch it landed
  on. The controller commits; the worker does not.
- **`status`** — `in-progress` while the runway continues; a terminal status only
  when a *valid* stop condition fired.
- **`runway.checkpoint`** — a monotonically increasing counter; each checkpoint
  bumps it.
- **`runway.valid_terminal_stop_reached`** — `false` while continuing; with it
  `false`, `status` stays `in-progress` and `reason_for_continuation` is given.
- **`write_scope_respected` / `forbidden_scope_touched`** — the scope verdict.
  `forbidden_scope_touched` must be `false` for a clean handoff.
- **`adls_completed[]`** — one entry per ADL: `id`, `title`, `artifact`, and a
  `guard_test` the controller can re-run. Prose without a guard is not done.
- **`validation`** — the gates run (`npm test`, `agentctx:validate`) and whether
  they passed, with real results.
- **`uncommitted_changes`** — `added` / `modified` file lists matching the working
  tree exactly.
- **`handoff`** — one line telling the controller what to do next.

---

## Reading order for a controller

1. `forbidden_scope_touched` — if `true`, reject immediately.
2. `validation` — gates must be green.
3. `adls_completed[].guard_test` — re-run to confirm the claims.
4. `uncommitted_changes` — diff matches the list.
5. `runway` — stop-state is honest and self-consistent.

If all five pass, commit. This is the controller's
[checklist](mind-ontology-autopilot-controller-checklist-v1.md) applied to one
pack. The worker produces it by following the
[self-check](mind-ontology-autopilot-worker-selfcheck-v1.md).
