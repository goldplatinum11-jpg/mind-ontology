# Mind Ontology — Autopilot Observability v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How an operator sees what an autopilot line is doing — without a hosted dashboard.
The line's observability is **the Result Pack plus the guard tests**: two plain,
local, reviewable artifacts that together answer "what happened and is it correct?"

No hosted SIRT, no telemetry service, no account.

---

## The two observability surfaces

- **The Result Pack** answers *what happened*. Each checkpoint lists the completed
  ADLs, the validation results, and the exact uncommitted changes. It is plain JSON
  the operator reads or a CI step validates. See
  [Result Pack walkthrough](mind-ontology-autopilot-result-pack-walkthrough-v1.md).
- **The guard tests** answer *is it correct*. Every claimed step names a guard the
  operator can re-run (`npm test`); a green suite is proof, not narration. See the
  [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md).

Together they replace a dashboard: the Result Pack is the activity log, the guards
are the assertions, and both live in the repo.

## Why files beat a dashboard here

- **Auditable.** A reviewer reads the same files the line wrote; there is no opaque
  service in between. This is the [trust posture](mind-ontology-autopilot-trust-tie-in-v1.md).
- **Reproducible.** Re-running the guards reproduces the verdict exactly; a
  dashboard graph cannot be re-derived from first principles.
- **No new dependency.** Adding telemetry would widen the trust surface and add a
  hosted dependency — both [non-goals](mind-ontology-autopilot-non-goals-v1.md).

## What the operator does

1. Read the latest Result Pack: what the line claims it did.
2. Run `npm test` and `npm run agentctx:validate`: confirm the claims hold.
3. Diff the working tree against the Result Pack's change list: confirm nothing
   undisclosed.

If all three agree, the line is observable *and* verified — with files alone.

---

Observability here is not a feature to bolt on; it falls out of the design. The
Result Pack is the log and the guards are the checks, both local and reviewable.
See [pack at a glance](mind-ontology-autopilot-manifest-v1.md).
