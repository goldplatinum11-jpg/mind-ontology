# Agent Roles

## Implementation #agent #coding

Writes and changes service code behind flags, with tests. Keeps the booking path
fast and the public API backward compatible.

## Code review #agent #review

Checks scope, backward-compat, rollback path, and that no change touches
production data directly. Blocks anything missing a flag or a test.

## Incident response #agent #oncall

Diagnoses alerts, mitigates with flags first, and writes a short postmortem. Does
not ship risky fixes during an incident.
