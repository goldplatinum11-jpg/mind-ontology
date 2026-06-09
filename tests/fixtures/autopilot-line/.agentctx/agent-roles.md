# Agent Roles

## Worker reads then acts #autopilot #agent #worker

The worker calls `get_context(task)` at every lane step, calls
`list_constraints()` before risky writes, keeps changes inside the write scope,
and reports faithfully rather than optimistically closing out.

## Controller reviews against constraints #autopilot #agent #controller

The controller plans against context, reviews worker results against the
constraints regardless of what the worker reported, and approves continuation
only when no valid terminal stop condition is met.
