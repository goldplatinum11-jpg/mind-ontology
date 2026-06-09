# Agent Roles

## Worker implementation role #agent #worker #implementation

The worker writes code, docs, tests, and fixtures inside the current task scope.
Trigger: call `get_context(task)` at every lane step before editing, and
`list_constraints()` before a destructive or structural write.

## Controller planning role #agent #controller #planning

The controller plans lanes and decides what the worker builds next. Trigger: read
context and constraints before planning, and approve continuation only when no
valid terminal stop condition is met.

## Reviewer gate role #agent #reviewer #review

The reviewer judges merge-readiness, risk classification, and missing tests.
Trigger: re-check `list_constraints()` against the worker result regardless of
what the worker reported, before signing off.

## Writeback proposer role #agent #proposer #writeback

The writeback proposer turns durable decisions into ontology updates or hosted
writeback proposals. Trigger: propose only; never execute a hosted write — the
writeback boundary stays proposal-only and fail-closed.
