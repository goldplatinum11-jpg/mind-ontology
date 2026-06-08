# Architecture

## Markdown chunking pipeline #architecture #parsing #schema

Source files under `.agentctx/` are split into independently selectable
blocks by `##` headings. Each block carries its heading title, extracted
tags, and body text. Tags embedded in headings (e.g. `## Title #tag1 #tag2`)
are stripped from the display title and stored separately so they receive
higher scoring weight than body words.

The format stays plain Markdown — no custom syntax, no frontmatter, no DSL.
Human-editable and diff-friendly by design.

## Lexical scoring without embeddings #scoring #selection #architecture

Block relevance is computed by token overlap between the task description and
each block's tags, heading tokens, and body tokens. Weights are:

- Tag match (scope): 8 pts
- Heading match (scope): 5 pts
- Tag match (task): 6 pts
- Heading match (task): 4 pts
- Body match: 1–2 pts

No embedding model, vector store, or external service is needed. The compiler
is fully deterministic and works offline. This is intentional for v0; richer
selection can layer on top after the lexical baseline proves useful.

## agentctx directory layout #schema #layout #agentctx

Source Markdown files live under `.agentctx/` in the repo root:

- `constraints.md` — always compiled in full; non-negotiable invariants
- `direction.md` — long-horizon direction and product posture
- `decisions.md` — confirmed decisions with status and date
- `architecture.md` — structural decisions and component shapes

Additional files can be added to the source list in the compiler config.
Each file contributes up to `maxBlocksPerFile` scored blocks per compile run.

## Mind Ontology layer map #mind-ontology #sirt #agentctx

The product has three named layers:

- Mind Ontology — the external product and personal meaning layer.
- SIRT — durable memory, graph, writeback, council, and autonomous control plane.
- agentctx — repo-local compiler and MCP adapter that emits task-scoped context.

This separation prevents product language from collapsing into implementation
language while still letting the v0 stay small and file-based.

## MCP adapter shape #mcp #adapter #integration

After CLI compilation proves useful, the same `compileContext` function can
be wrapped as an MCP server tool. The tool accepts `task` and optional
`scopes` parameters and returns the context pack as a string or structured
JSON object. The core compiler stays dependency-free; MCP is an optional
transport layer added after v0.
