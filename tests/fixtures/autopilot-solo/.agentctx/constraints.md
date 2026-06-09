# Constraints

## Re-read constraints before irreversible work #safety #destructive

Before any destructive, structural, or irreversible action, call
`list_constraints()` and stop-and-report if a constraint forbids it.

## Ship small, reversible changes #safety #scope

Prefer small, reversible edits the solo founder can review quickly. Avoid wide
refactors in a single lane.
