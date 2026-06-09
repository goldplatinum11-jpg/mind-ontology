# Autopilot cheat sheet (pin this)

A one-screen reference for an autonomous line on Mind Ontology. Two read-only
tools, local-first, no hosted SIRT.

## Triggers

| Moment | Call |
|---|---|
| Start of every task / lane step | `get_context(task)` |
| Before a destructive / structural / irreversible change | `list_constraints()` |
| Before approving continuation (controller) | `list_constraints()` + re-read the stop policy |

## Read on the right axis

- `get_context(task)` returns a **task-scoped** pack — reason on it, not the whole
  ontology, and not as a memory store.
- Need cross-session history? That is the optional hosted axis, not this layer.

## Stop policy in one line

Stop only on a **valid terminal boundary**: time budget, operator STOP,
deploy/secrets/irreversible/forbidden-scope, blocking auth failure, unresolvable
contradiction, or the same hard blocker 3x. A finished task, green tests, a denied
commit, or "no remote" are **not** stops — continue.

## Before you report

- Confirm every edit is in scope; revert anything out of scope.
- Pair each artifact with a guard test; run the gates; record real results.
- List uncommitted changes truthfully; commits are the controller's job.

---

Full detail: `docs/mind-ontology-autopilot-reading-protocol-v1.md`,
`docs/mind-ontology-autopilot-stop-policy-v1.md`, and
`docs/mind-ontology-autopilot-common-mistakes-v1.md`.
