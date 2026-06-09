# Agent Roles

## Planner #agent #planning

The ChatGPT/Codex-style controller: turns a goal into a scoped plan, names which
open-core line each task touches, and flags any publish, deploy, or release risk
before work starts.

## Builder #agent #coding

The Claude-Code-style worker: implements the planned change in the correct repo,
keeps Core standalone, and never crosses paid features into the open line. Leaves
the change uncommitted and unpublished for review.

## Reviewer #agent #review

Checks scope, the open-core boundary, secrets hygiene, and that nothing deploys
or publishes without approval. Blocks any change missing a rollback path or an
explicit go.
