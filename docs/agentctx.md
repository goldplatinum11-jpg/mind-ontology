# agentctx

The local-first context compiler behind Mind Ontology.

Mind Ontology is the product surface: a portable personal meaning layer for AI
agents. SIRT is the deep memory and control plane. `agentctx` is the execution
mechanism that compiles short, task-specific context packs from
human-curated Markdown files in `.agentctx/`.

Designed for AI agents (Codex, Claude Code, ChatGPT, Cursor) that need fresh,
relevant context on each task — not a static instruction dump.

---

## Why not CLAUDE.md or AGENTS.md?

`CLAUDE.md` and `AGENTS.md` are static files. Every agent run loads the whole
file regardless of the current task. As these files grow they become noise:
an agent writing a migration sees the same blob as one fixing a UI bug.

agentctx compiles a task-specific pack. For the task
`"Implement OAuth PKCE flow"`, the compiler selects the strongest blocks tagged
`#auth` or `#security` and skips unrelated direction blocks. The agent gets a
short pack, focused on what it actually needs.

### Comparison

| Capability | CLAUDE.md / AGENTS.md | Mind Ontology via agentctx |
|---|---|---|
| Per-task context compilation | No — full file always | Yes — scored block selection |
| Cross-agent portability | Vendor-specific format | Markdown; any agent reads it |
| Approval loop | Edit the file directly | Git diff / PR per change |
| Embedding / vector store | No | No — lexical scoring only (v0) |
| MCP integration | Via Cursor rules etc. | Planned adapter after CLI proves value |

agentctx is not a replacement for `CLAUDE.md`. Keep top-level coding
preferences there. Mind Ontology holds identity, project direction, vocabulary,
agent roles, decisions, constraints, and architecture notes. agentctx compiles
the subset that matters for the current task.

---

## CLI-first, MCP later

The first implementation is a command-line compiler. If the CLI cannot produce
a concise, trustworthy context pack for real tasks, MCP integration will not
help. Prove value at the command line first.

```sh
# Compile context for a specific task
npm run agentctx:compile -- --task "Fix OAuth PKCE flow" --scope auth

# JSON output for machine consumption
npm run agentctx:compile -- --task "Add MCP tool wrapper" --format json
```

MCP wrapping is planned for after v0. The `compileContext` function is already
designed for it — the MCP tool would accept the same `task` and `scopes`
parameters and return the same pack.

---

## .agentctx/ source file spec

Source files live under `.agentctx/` in the repo root.

### Required: `constraints.md`

Always compiled in full. Contains non-negotiable project invariants. Never
silently omitted — even if no constraint is relevant to the current task,
they are all included. This prevents accidental violation of hard constraints.

The compiler now validates this file before compiling. If `.agentctx/` or
`constraints.md` is missing, run:

```sh
npm run agentctx:init -- --cwd "C:/path/to/project"
```

### Scored files: `direction.md`, `decisions.md`, `architecture.md`

Compiled selectively. Each file is parsed into blocks by `##` headings. Blocks
are scored against the task description, then the top-scoring blocks (up to
`--max-blocks-per-file`, default 1) are included. Blocks below `--min-score`
(default 2) are excluded unless no block scores high enough, in which case the
top block is included as a fallback.

### Block format

```markdown
# File title (H1, not compiled as a block)

## Block title #tag1 #tag2

Body text. Tags in the heading are extracted and scored higher
than body words. Tags identify topic areas; they drive selection.

## Another block #different-tag

Body text.
```

Rules:
- One `#` H1 per file (file title, ignored by compiler)
- Each `##` H2 heading starts a new selectable block
- Tags in headings use `#word` syntax directly after the title text
- Tags score at 6–8 pts per match; heading words at 4–5 pts; body words at 1–2 pts
- Block body can contain any standard Markdown (code blocks, lists, etc.)

---

## Expected output shape

### Markdown (default)

```text
# agentctx context pack

Task: Fix OAuth PKCE flow
Scopes: auth
Generated: 2026-06-07T10:00:00.000Z

## Included Context

### constraints.md / No SIRT dependency in core

Source: constraints.md
Reason: always included
Tags: #sirt #oss #core

The core compiler must work without SIRT, ...

### decisions.md / Authentication adapter

Source: decisions.md
Reason: matched; score=27
Tags: #auth #security

OAuth work must preserve fail-closed behavior.

...

## Omitted Context

- direction.md / Current development posture (score=1)
```

### JSON (`--format json`)

```json
{
  "task": "Fix OAuth PKCE flow",
  "scopes": ["auth"],
  "generatedAt": "2026-06-07T10:00:00.000Z",
  "selected": [
    {
      "file": "constraints.md",
      "title": "No SIRT dependency in core",
      "tags": ["sirt", "oss", "core"],
      "score": "always",
      "reason": "always",
      "body": "..."
    }
  ],
  "omittedCount": 8,
  "sourceFiles": ["constraints.md", "direction.md", "decisions.md", "architecture.md"]
}
```

---

## CLI reference

```
agentctx compile — compile a task-scoped context pack from .agentctx/ source files.

Usage:
  node scripts/agentctx/compile.mjs compile --task "..." [options]
  npm run agentctx:compile -- --task "..."

Options:
  --task <text>               Required. Task description.
  --scope <csv>               Explicit scopes (comma-separated). Weighted higher.
  --format markdown|json      Output format. Default: markdown.
  --cwd <path>                Directory with .agentctx/. Default: process.cwd().
  --max-blocks-per-file <n>   Max selected blocks per scored file. Default: 1.
  --min-score <n>             Minimum block score for selection. Default: 2.
  -h, --help                  Show help.
```

---

## Mind Ontology / SIRT relationship

Mind Ontology should be the external product surface. SIRT is the deep memory,
council, graph, runner, and decision system behind it. agentctx is not SIRT-lite
and not the product brand; it is the context pack compiler used by Mind
Ontology and by this repo's autonomous development line.

Core agentctx v0 works from repo-local Markdown alone — no external services,
no network calls, no private connectors.

SIRT can become an optional adapter after the CLI compiler proves value.
The adapter would pull relevant memory nodes and inject them as additional
scored blocks. Core v0 must remain DB-free.

Commercial boundary: the OSS layer is the self-hosted Mind Ontology MCP and
schema. Hosted SIRT is the paid persistence layer for memory graph, retrieval,
writeback, typed edges, and cross-agent learning. Do not make the dependency-free
compiler depend on hosted SIRT.

For the product framing, see [`docs/mind-ontology.md`](mind-ontology.md).
