# Direction

## Ship the autopilot integration pack #autopilot #direction

Build the local-first integration pack so an AI development line can consume Mind
Ontology automatically: read context at task start, check constraints before
risky writes, and stop only on a real boundary.

## Keep the line portable #autopilot #mcp #portable

Every agent in the line points at the same local MCP entrypoint and uses only
`get_context(task)` and `list_constraints()`. No hosted SIRT dependency.

## Fail closed on live writes #safety #destructive

The live-write boundary fails closed: hosted adapter flags are off by default and
writeback stays proposal-only. A risky lane step must honor this regardless of
how the task is phrased.
