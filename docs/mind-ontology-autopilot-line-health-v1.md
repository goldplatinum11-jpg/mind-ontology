# Mind Ontology — Autopilot Line Health Signals v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How to tell a **healthy** autopilot line from a **drifting** one, reading only
local artifacts — no dashboard, no hosted SIRT. The signals are the same files the
line already produces; this doc tells you what good and bad look like.

---

## Healthy signals

- **Guards are green.** `npm test` and `npm run agentctx:validate` pass; the
  structural guards hold. A green suite is the baseline of a healthy line. See
  [observability](mind-ontology-autopilot-observability-v1.md).
- **The Result Pack is fresh and honest.** Its checkpoint counter advances, its
  `forbidden_scope_touched` is `false`, and its change list matches the working
  tree. See the [Result Pack walkthrough](mind-ontology-autopilot-result-pack-walkthrough-v1.md).
- **The diff is in scope.** Every changed path is inside the lane's allowed write
  scope; the lockfile is clean. See
  [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md).
- **Continuation is honest.** When work remains and no boundary is hit, the line
  continues rather than stopping early. See
  [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).

## Drifting signals

- **A guard is red, or "mostly green" is accepted.** Any failing structural guard
  is drift; rounding up a result hides it.
- **The Result Pack disagrees with the tree.** Undisclosed or invented changes, a
  stale checkpoint, or a dirty lockfile mean the report no longer reflects reality.
- **An out-of-scope edit appears.** A touched forbidden path is a hard stop, not a
  nit — see [non-goals](mind-ontology-autopilot-non-goals-v1.md).
- **The line stops on a checkpoint.** Ending at "tests passed" with work still in
  scope is the most common drift; a checkpoint is not a stop.

## How to read the signals

1. Run the gates; a red guard is the loudest signal.
2. Read the latest Result Pack and diff it against `git status`.
3. Check the stop-state: is continuation honest, or did the line stall?

If the guards are green, the Result Pack matches the tree, and the diff is in
scope, the line is healthy. Any mismatch is drift to fix before continuing —
exactly what the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md)
catches.

---

Health is readable from files: green guards, an honest fresh Result Pack, and an
in-scope diff. Drift is any gap between what the line claims and what the artifacts
show. See [reviewer quickstart](mind-ontology-autopilot-reviewer-quickstart-v1.md).
