# Competency Questions

## What should the agent know before starting? #cq #context

The ontology should answer which direction, decisions, constraints, and terms
matter for the current task, drawn from `direction.md`, `decisions.md`, and
`glossary.md`.

## What is the current direction this work serves? #cq #context #direction

The ontology should state, from `direction.md`, what the operator is building now
so the agent's changes move that direction forward instead of drifting.

## What must the agent avoid? #cq #safety

The ontology should answer which actions are forbidden, risky, destructive, or
outside the current scope, drawn from `constraints.md`.

## Which writes are forbidden, and when must the agent fail closed? #cq #safety #boundary

The ontology should name the writes the agent must never perform (deploy,
migration, secrets, production config, live data, hosted writeback execution)
and the conditions under which it stops rather than proceeds. See
`constraints.md` and the task risk modes.

## Which files am I allowed to write for this task? #cq #scope

The ontology should let the agent determine the allowed write surface for the
current task from `direction.md`, `projects.md`, and `constraints.md`, so it
edits only in-scope paths.

## Which prior decision applies? #cq #decision

The ontology should help the agent find relevant prior decisions in
`decisions.md` without loading every decision into every task.

## Is this capability local or hosted? #cq #boundary

The ontology should clarify whether a capability belongs to the local OSS layer
or an optional, fail-closed hosted adapter — the local path must never be
load-bearing on the hosted one.
