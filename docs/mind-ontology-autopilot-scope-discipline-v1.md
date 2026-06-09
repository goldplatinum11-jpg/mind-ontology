# Mind Ontology — Autopilot Scope Discipline v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How a worker keeps **every edit inside the lane's allowed write scope** — and what
to do when something lands outside it. Scope discipline is what lets a controller
trust an autonomous worker without watching every keystroke.

This is a local, files-based discipline; nothing here depends on hosted SIRT.

---

## The rule

A lane declares an **allowed write scope** (e.g. `docs/**`, `tests/**`,
`templates/**`) and a **forbidden scope** (engine code, package manifests,
secrets, user config). The worker edits only inside the allowed scope, every step.

`constraints.md` is the machine-readable home of this rule — the worker reads it
via `get_context` and `list_constraints`. A forbidden path is a wall, not a hurdle:
the worker does not work around it.

## When something lands out of scope

1. **Stop and assess.** If an edit (or a tool side-effect) touched a forbidden
   path, do not continue building on top of it.
2. **Revert it.** Discard the out-of-scope change (`git checkout -- <path>`) — a
   discard is not a commit and stays inside the lane.
3. **Report it.** Note the incident in the Result Pack; never report a forbidden
   write as completed work.

A forbidden-scope edit that cannot be avoided is a **valid terminal stop**, not
something to work around.

## Lockfile hygiene (a common trap)

Provisioning dependencies (`npm install`) is allowed, but it can rewrite
`package-lock.json`, which is out of scope. After an install, revert the lockfile:

```sh
git checkout -- package-lock.json
```

`node_modules/` stays installed; the working tree stays inside scope. The Result
Pack's `forbidden_scope_touched` must be `false`.

## Why discipline beats supervision

If the worker holds scope itself, the controller's review is a quick mechanical
check (see the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md))
rather than a line-by-line audit. The lane runs faster *because* the boundary is
self-enforced. The worker's own pass is the
[self-check](mind-ontology-autopilot-worker-selfcheck-v1.md).
