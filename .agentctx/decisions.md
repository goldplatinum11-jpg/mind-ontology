# Decisions

## Build CLI before MCP #cli #mcp #v0

Status: confirmed
Date: 2026-06-07

The first implementation should be a CLI context compiler. MCP tools come only
after the command-line compile output proves useful.

Primary command shape:

```text
agentctx compile --task "..."
```

## Compete with agent instruction files #claude-md #agents-md #positioning

Status: confirmed
Date: 2026-06-07

The real competitor is `CLAUDE.md`, `AGENTS.md`, and Cursor rules, not RAG,
Obsidian, or Microsoft Work IQ.

The tool must add per-task context compilation and cross-agent portability over
static instruction files.

## Use Markdown source files #markdown #schema

Status: confirmed
Date: 2026-06-07

Do not invent a DSL for v0. Use normal Markdown files under `.agentctx/` and
split selectable content by `##` headings.

Tags can live in headings, such as `## Authentication #auth #security`.

## Keep git as the approval loop #git #approval #patches

Status: confirmed
Date: 2026-06-07

Do not build a custom patch confirmation UI in v0. Humans edit Markdown. Git
diffs and pull requests are the review and confirmation mechanism.

## MCP wrapper after CLI validation #mcp #transport #adapter

Status: confirmed
Date: 2026-06-07

CLI compilation proved useful (dogfooding against this repo). MCP stdio server
added at `scripts/agentctx/mcp-server.mjs`. Core compile logic is unchanged;
MCP is a thin JSON-RPC 2.0 layer around the exported `compileContext` function.

Tools exposed: `get_context(task, scope?, format?)` and `list_constraints(format?)`.
No external dependencies added — Node.js built-ins only.

## Product surface is Mind Ontology #mind-ontology #positioning #product

Status: confirmed
Date: 2026-06-08

Expose the product as Mind Ontology, not agentctx. Mind Ontology is the
portable personal meaning layer for AI agents. SIRT is the deep memory and
control-plane substrate. agentctx is the local context compiler and MCP adapter.

This keeps the product legible while preserving the small, dependency-free v0
implementation.

## Use open-core distribution #mind-ontology #oss #sirt #commercial

Status: confirmed
Date: 2026-06-08

Mind Ontology should be open-core. The Mind Ontology MCP server, schema, source
layout, `get_context(task)`, and `list_constraints()` belong in OSS so
developers can inspect and self-host the context layer they are injecting into
agents.

Hosted SIRT is the paid layer. It provides durable memory, graph storage,
retrieval, writeback, typed edges, cross-agent persistence, and autonomous
control-plane behavior. OSS Mind Ontology is the adoption on-ramp; hosted SIRT
is the value-capture layer.

## Use slash-loop autonomous runway #mind-ontology #runway #loop #claude-code

Status: confirmed
Date: 2026-06-08

Mind Ontology development should follow
`docs/operator/mind-ontology-autonomous-development-plan-v0.md` instead of
ad-hoc implementation. Seven-hour autonomous worker lanes should use
`claude_code_interactive_slash_loop` by default. Non-interactive `claude -p`
does not process slash commands and is only acceptable for one-shot execution.
