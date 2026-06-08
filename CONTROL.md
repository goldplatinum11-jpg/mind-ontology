# Mind Ontology Workspace

Purpose: independent product workspace for Mind Ontology / agentctx / ontology MCP work.

Current source of truth during migration:
- Active Claude Code runway: `mind-ontology-seven-hour-runway`
- Worker session id: `fa70c538-d2da-409d-9e10-c7968803feef`
- Current observed lane: Phase 5 launch readiness, P5-PR08 or later
- Active worktree before extraction: `C:\Users\qmbqb\sirt-codex-clones\sirt-app-v2-pr08-acceptance`

Do not mix here:
- SIRT ADL dashboard/control-plane implementation
- Biohack tools
- Generic sirt-app-v2 runner infrastructure unless explicitly required as an adapter boundary

Migration rule:
- Let the active Claude runway reach a clean Result Pack or hard gate before moving code.
- Extract only Mind Ontology files and PR lineage after the stack is reviewed.
