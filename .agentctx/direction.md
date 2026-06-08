# Direction

## Mind Ontology product direction #mind-ontology #personal-ontology #oss #mcp

Mind Ontology is the product surface: a portable personal meaning layer for AI
agents. It helps Codex, Claude Code, ChatGPT, Claude.ai, Cursor, and other MCP
clients share the same understanding of the operator's identity, direction,
vocabulary, projects, constraints, and agent operating rules.

The product must stay practical: compile short task-specific context packs from
human-curated source files. The ontology is not background philosophy anymore;
it is the product promise. agentctx is the implementation name for the context
compiler that makes the ontology usable by agents.

## SIRT relationship #sirt #memory #adapter #mind-ontology

SIRT remains the deep memory, council, graph, runner, and decision system.
Mind Ontology is the adoption surface and first killer app on top of that
substrate. agentctx should not become SIRT-lite; core v0 must work from
repo-local Markdown alone.

SIRT can become an optional adapter after the compiler proves value.

## Open-core adoption path #oss #sirt #commercial

Release Mind Ontology MCP as OSS for trust and adoption. The free layer should
let users self-host the MCP server, maintain `.agentctx/` in git, and share one
task-scoped context source across AI tools.

Hosted SIRT becomes the upgrade path when users want memory that grows across
sessions: persistent graph, vector retrieval, typed relationships, writeback,
and cross-agent learning.

## Development runway #mind-ontology #runway #planning #loop

Execute Mind Ontology through the autonomous development line using the phase
and PR sequence in `docs/operator/mind-ontology-autonomous-development-plan-v0.md`.
Long autonomous runs should use `claude_code_interactive_slash_loop`, not
non-interactive `claude -p`, when slash-loop continuation is required.

## Current development posture #prototype #cli #dogfood

Start with a CLI and MCP context compiler before UI. If the compiler cannot
produce a concise, trustworthy context pack for real tasks, a UI will not help.

Dogfood against this repo before extracting a standalone OSS project.

