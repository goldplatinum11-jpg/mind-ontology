# Mind Ontology MCP

Your portable meaning layer for AI agents.

Mind Ontology MCP gives Claude Code, Codex, Cursor, ChatGPT-compatible MCP
clients, and other agent tools the same task-scoped understanding of your
direction, decisions, constraints, vocabulary, projects, and operating rules.

It is not a generic note app, a vector database, or another static instruction
file. It is a small self-hosted MCP layer that compiles a curated personal
ontology into the context an AI agent needs for the task in front of it.

---

## Why this exists

AI coding and work agents drift when every tool has its own private memory and
instruction file:

- `CLAUDE.md` is tuned for Claude Code.
- `AGENTS.md` is tuned for Codex.
- Cursor rules, ChatGPT project instructions, and custom connectors all become
  separate places to keep the same meaning in sync.

Mind Ontology MCP replaces that split-brain setup with one source:

```text
.agentctx/ source files
  -> task-scoped context pack
  -> get_context(task) / list_constraints()
  -> any MCP-capable agent
```

The important difference is scoping. Agents should not receive every rule and
every old decision on every task. They should receive the relevant direction,
the matching decisions, and the full set of non-negotiable constraints.

---

## What the free OSS layer includes

The OSS layer is deliberately small and trustable:

- `.agentctx/` source layout for direction, decisions, constraints, and later
  identity, projects, glossary, roles, and competency questions;
- `agentctx` compiler for short task-specific context packs;
- MCP tools:
  - `get_context(task, scope?)`
  - `list_constraints()`
- local stdio MCP server that runs in the user's environment;
- git-native review through normal file edits, diffs, commits, and PRs.

No hosted SIRT account is required. No database is required. No network access
is required for the local stdio server.

The user's runtime cost belongs to the user's environment. Publishing the OSS
server does not mean the project owner hosts or pays for other users' traffic.

---

## What hosted SIRT adds later

The hosted layer is where the paid product can capture deeper value:

- durable memory that grows across sessions;
- graph storage and typed relationships;
- retrieval of similar prior decisions;
- writeback proposals and reviewable memory updates;
- cross-agent persistence beyond flat files;
- autonomous control-plane and council behavior.

Mind Ontology MCP is the on-ramp. It is useful on its own because it gives every
agent the same curated context. It becomes more powerful when connected to
hosted SIRT for memory, retrieval, graph, and writeback.

The boundary matters:

```text
OSS Mind Ontology MCP:
  schema, local files, compiler, MCP tools, self-hosted runtime

Hosted SIRT:
  durable memory graph, retrieval, writeback, automation history, hosted state
```

Do not put hosted SIRT's backend value into the OSS core.

---

## Source layout

The current local source lives in `.agentctx/`:

```text
.agentctx/
  constraints.md   # non-negotiable rules, always included
  direction.md     # current direction and product posture
  decisions.md     # durable decisions and their reasons
  architecture.md  # optional architecture notes
```

Future schema slices should add:

```text
.agentctx/
  identity.md      # who the operator is and how agents should relate to them
  projects.md      # active products, repos, and business contexts
  glossary.md      # local vocabulary and product terms
  agent-roles.md   # what each AI/tool is responsible for
  cq.md            # competency questions the ontology should answer
```

Each scored file uses `##` blocks with tags:

```markdown
## Open-core adoption path #oss #sirt #commercial

Release Mind Ontology MCP as OSS for trust and adoption. Hosted SIRT becomes
the upgrade path when users want persistent graph memory and writeback.
```

The compiler scores headings, tags, and body text against the task and scope.
Constraints are always included.

---

## Quickstart

Install dependencies in the repo that contains the `.agentctx/` directory:

```sh
npm install
```

Compile a context pack for a task:

```sh
npm run agentctx:compile -- --task "Add Claude Code setup docs" --scope "mind-ontology,mcp"
```

Return machine-readable output:

```sh
npm run agentctx:compile -- --task "Design hosted SIRT adapter contract" --scope "sirt,adapter" --format json
```

Start the local MCP server:

```sh
npm run agentctx:mcp
```

For the install-first flow, see
[`docs/mind-ontology-quickstart.md`](mind-ontology-quickstart.md).

Add one operating instruction to each AI client:

```text
At task start, call get_context(task). Before destructive or structural changes,
call list_constraints().
```

Then point the client to the local MCP server using that client's MCP setup
flow. Client-specific setup docs should remain thin: the product contract is
the same two tools across every agent.

---

## Expected agent behavior

For a task such as:

```text
Start Mind Ontology Phase 1 Wave 1 OSS MCP foundation.
```

the agent should call:

```text
get_context("Start Mind Ontology Phase 1 Wave 1 OSS MCP foundation",
  scope="mind-ontology,oss,mcp,runway")
list_constraints()
```

The result should give the agent enough context to act under the same direction
as every other AI client, without copying a long static instruction file into
every session.

---

## Long autonomous Claude Code runs

For seven-hour Mind Ontology runways, use the Claude Code interactive
slash-loop transport:

```text
worker_transport: claude_code_interactive_slash_loop
```

Start Claude Code interactively and use `/loop` inside the session. Do not use
`claude -p` as the slash-loop transport; non-interactive prompt mode does not
process slash commands.

---

## Product shape

Mind Ontology MCP should feel like a better, portable, task-aware successor to
agent instruction files:

- one source of truth across AI tools;
- queryable constraints before risky actions;
- per-task context packs instead of full dumps;
- git-native editing and review;
- self-hosted OSS for trust;
- hosted SIRT as the optional memory graph upgrade.

The first product win is not a perfect ontology theory. It is this sentence
becoming true:

```text
Every AI agent I use starts from the same current understanding of me, my work,
my vocabulary, and my constraints.
```
