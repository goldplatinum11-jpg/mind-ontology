# Competency Questions

## When does the worker read context, and which tools does it call? #cq #autopilot #worker

The ontology should answer, from `agent-roles.md`, when the worker calls
`get_context(task)` and `list_constraints()` across a lane step.

## What must the agent re-check before irreversible work? #cq #autopilot #safety

The ontology should answer, from `constraints.md`, which destructive or
irreversible actions require a `list_constraints()` re-read and a stop-and-report.

## What direction does this autopilot line serve? #cq #autopilot #direction

The ontology should state, from `direction.md`, what the line is building so each
lane step moves that direction forward instead of drifting.
