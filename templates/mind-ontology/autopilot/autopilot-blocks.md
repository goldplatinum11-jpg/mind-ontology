# Autopilot drop-in blocks

Copy these blocks into your own `.agentctx/` files to make an autonomous AI line
read Mind Ontology on the right axis and stop on the right boundary. They are
plain `.agentctx`-style blocks (heading + `#tags`) — paste the ones you want into
`constraints.md` and `agent-roles.md` and edit to fit your line.

These blocks are portable and local-first: they reference only the two read-only
tools and require no hosted backend, no account, and no network.

---

## For `constraints.md`

## Read context on the right axis #autopilot #selection #safety

At task start, call `get_context(task)` with the task phrased in natural
language, and reason on the returned task-scoped slice — not the whole ontology,
and not as a memory store. If you need durable cross-session history, that is the
hosted-backend axis and is out of scope for this local line.

## Re-read constraints before irreversible work #autopilot #safety #destructive

Before any destructive, structural, or irreversible action — deletes, schema or
contract changes, migrations, deploys, anything hard to undo — call
`list_constraints()`. If a constraint forbids the action, stop and report. Do not
work around a forbidden-scope boundary to stay busy.

## Stop only on a real boundary #autopilot #stop-policy

Stop the line only on a valid terminal condition: time budget elapsed, explicit
operator STOP, a deploy/migration/secrets/production/live-data boundary, material
cost without budget, blocking auth failure, a required irreversible action, an
unavoidable forbidden-scope edit, an unresolvable canonical contradiction, or the
same hard blocker three times. A completed task, green tests, a denied commit, or
"no remote" are **not** stop conditions — continue to the next action.

---

## For `agent-roles.md`

## Worker reads then acts #autopilot #agent #worker

The worker calls `get_context(task)` at every lane step, calls
`list_constraints()` before risky writes, keeps changes inside the write scope,
and reports faithfully — uncommitted changes and skipped steps included — rather
than optimistically closing out.

## Controller reviews against constraints #autopilot #agent #controller

The controller plans against `get_context` and `list_constraints`, reviews worker
results against the constraints regardless of what the worker reported, and
approves continuation only when no valid terminal stop condition is met. Commits
are the controller's job; a denied worker commit is never a blocker.

---

See `docs/mind-ontology-autopilot-pack-v1.md`,
`docs/mind-ontology-autopilot-reading-protocol-v1.md`, and
`docs/mind-ontology-autopilot-stop-policy-v1.md` for the full rationale.
