# Competency Questions

## What should the agent know before starting? #cq #context

The ontology should answer which client and direction the task serves, which
prior decisions apply, and which terms matter, drawn from `direction.md`,
`decisions.md`, and `glossary.md`.

## What must the agent avoid? #cq #safety

The ontology should answer which actions are forbidden, risky, or destructive —
above all, mixing data across client engagements — drawn from `constraints.md`.

## Which writes are forbidden, and when must the agent fail closed? #cq #safety #boundary

The ontology should name the writes the agent must never perform (secrets,
cross-client data, unreviewed client-facing changes, breaking platform changes)
and the conditions under which it stops rather than proceeds. See
`constraints.md`.

## Which prior decision applies? #cq #decision

The ontology should help the agent find the relevant prior decision in
`decisions.md` — for example, the per-client workspace rule — without loading
every decision into every task.

## Which client and project does this task belong to? #cq #scope

The ontology should let the agent determine which engagement it is acting in,
from `projects.md` and `direction.md`, so it edits only that client's workspace
and never touches another's.
