# Architecture

## Autopilot line layers #architecture #autopilot #layers

The line is layered: source files in `.agentctx/`, the local compiler that emits
task-scoped packs, the two read-only tools that serve them, and the
worker/controller roles that consume them. No hosted service sits on the local
path; the optional hosted adapter attaches only behind a fail-closed flag.
