# Architecture

## Layer map #architecture #layers

Describe the layers in your own setup.

Example:

- Source: `.agentctx/` Markdown files.
- Compiler: turns source blocks into task-scoped context packs.
- MCP server: exposes `get_context(task)` and `list_constraints()`.
- AI clients: Claude Code, Codex, Cursor, ChatGPT-compatible clients, or other
  MCP-capable tools.

## Context flow #context #mcp

Describe how context should move through the system.

Example:

An AI agent receives a task, calls `get_context(task)`, reads the selected
direction and decisions plus all constraints, then acts inside those boundaries.

## Hosted adapter boundary #hosted #adapter

Describe what is local and what belongs to any hosted service.

Example:

The local ontology is enough for shared direction and constraints. Hosted memory
may add durable retrieval, graph links, and writeback later, but local context
compilation must keep working without it.
