# Mind Ontology Migration Plan

## Current State

Active Claude Code runway is still running from:
`C:\Users\qmbqb\sirt-codex-clones\sirt-app-v2-pr08-acceptance`

Latest observed stage:
Phase 5 launch readiness, P5-PR08 / closeout.

## Rule

Do not move active code until the Claude runway returns a Result Pack, hard gate, or explicit stop.

## Reusable Assets

Candidate asset families:
- `.agentctx/**`
- `docs/agentctx*.md`
- `docs/mind-ontology*.md`
- `scripts/agentctx/**`
- `tests/unit/agentctx*.mjs`
- `templates/mind-ontology/**`
- related package scripts such as `agentctx:*`

## Do Not Import

- SIRT ADL runner/controller infrastructure unless required as an adapter boundary
- BioStack OS content
- production deploy/migration/secrets/live-write paths

## Next Safe Step

Wait for the active Claude runway Result Pack, then produce an asset extraction list from the final stack tip.
