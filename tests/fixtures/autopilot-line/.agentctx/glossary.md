# Glossary

## Runway #glossary #autopilot

A runway is a long-running autonomous work session in which a worker agent
executes many lane steps in sequence, optimizing for safe continuation.

## Lane #glossary #autopilot

A lane is one bounded, reviewable unit of work with an explicit write scope and a
stop policy. A worker stays inside the lane's allowed paths.

## Result Pack #glossary #autopilot #handoff

A Result Pack is the JSON document a worker returns to the controller at each
checkpoint, listing completed steps, validation, and uncommitted changes.

## Wrong-axis read #glossary #autopilot #selection

A wrong-axis read is treating the portable constitution as a lookup store instead
of a task-scoped policy. The reading protocol exists to prevent it.

## Stop policy #glossary #autopilot #stop-policy

The stop policy is the rule set deciding when a line may terminate — only on a
valid terminal boundary, never on a convenient checkpoint.
