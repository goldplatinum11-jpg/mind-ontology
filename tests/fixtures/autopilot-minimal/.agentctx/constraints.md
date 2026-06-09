# Constraints

## Re-read constraints before irreversible work #safety #destructive

Before any destructive, structural, or irreversible action, call
`list_constraints()` and stop-and-report if a constraint forbids it.

## Stop only on a real boundary #autopilot #stop-policy

Stop the line only on a valid terminal condition. A completed task, green tests,
or a denied commit are not stop conditions — continue to the next action.
