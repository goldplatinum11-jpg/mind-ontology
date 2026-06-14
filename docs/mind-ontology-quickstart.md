# Mind Ontology MCP Quickstart

**Status:** Draft for Phase 1 / P1-PR04  
**Goal:** Get the local stdio MCP layer running from `.agentctx/` files.

This quickstart is install-first. It assumes a user wants to prove the free OSS
layer before caring about a hosted backend, extraction, UI, or advanced schema work.

---

## What you will run

```text
.agentctx/ Markdown files
  -> agentctx compiler
  -> local stdio MCP server
  -> get_context(task) and list_constraints()
```

No hosted account, database, deploy, migration, or production write is
required.

---

## Requirements

- Node.js installed.
- A repo or folder that contains `.agentctx/`.
- An MCP-capable client such as Claude Code, Cursor, or another local MCP
  stdio client.

This repo currently dogfoods the source layout. A standalone package can later
wrap the same flow as `mind-ontology`.

---

## Step 1 - Install dependencies

From the repo root:

```sh
npm install
```

Do not run deploy, migration, or production commands for this quickstart.

---

## Step 2 - Confirm source files exist

The source directory holds up to nine files, all compiled:

```text
.agentctx/
  constraints.md   # ALWAYS included
  identity.md      direction.md     projects.md
  decisions.md     architecture.md  agent-roles.md
  glossary.md      cq.md            # scored against the task + scope
```

`constraints.md` is always included in context packs. The other eight files are
scored against the task and optional scope; a file you omit simply contributes
no blocks, so a minimal project shipping only `constraints.md` still works.

Neutral starter files are available in
[`templates/mind-ontology/.agentctx/`](../templates/mind-ontology/.agentctx/).

To scaffold them into a new project folder:

```sh
npm run agentctx:init -- --cwd "C:/path/to/my-project"
```

If `.agentctx/` already exists, the command stops instead of overwriting files.
Use `--force` only when you intentionally want to overwrite template files.

Adopting Mind Ontology in an **existing** repository? Add `--from-repo` to
generate a populated draft from the repository's own artifacts (manifest,
README, LICENSE, layout, an existing `CLAUDE.md`/`AGENTS.md`, recent git
commit subjects) instead of placeholder files:

```sh
npm run agentctx:init -- --cwd "C:/path/to/my-project" --from-repo
```

See [init-from-repo.md](init-from-repo.md) for what is read, what is written,
and the safety contract.

---

## Step 3 - Compile a context pack

Run:

```sh
npm run agentctx:compile -- --task "Start Mind Ontology MCP quickstart" --scope "mind-ontology,mcp,quickstart"
```

Expected result:

- output starts with `# agentctx context pack`;
- constraints are included;
- at least one direction/decision/architecture block is selected;
- unrelated blocks are omitted instead of dumping the whole ontology.

For JSON:

```sh
npm run agentctx:compile -- --task "Start Mind Ontology MCP quickstart" --scope "mind-ontology,mcp,quickstart" --format json
```

Expected JSON shape:

```json
{
  "task": "Start Mind Ontology MCP quickstart",
  "scopes": ["mind-ontology", "mcp", "quickstart"],
  "selected": [],
  "omittedCount": 0,
  "sourceFiles": []
}
```

The exact selected blocks will differ by source content.

### Optional - One-command acceptance smoke

To verify the whole free-layer path (scaffold, idempotency guard, compile, and
the friendly missing-source error) in one shot, run:

```sh
npm run agentctx:smoke
```

It scaffolds a throwaway `.agentctx/` in a temp directory, compiles a real task
pack, and prints a `PASS`/`FAIL` line per check. It never touches your repo and
exits non-zero if any check fails, so it is safe to wire into CI.

### Optional - Measure how focused the pack is

The product promise is *the smallest pack that still covers the task*. Make that
measurable:

```sh
npm run agentctx:metrics -- --task "Start Mind Ontology MCP quickstart" --scope "mcp,quickstart"
```

What the numbers mean:

| Metric | Meaning | Good direction |
|---|---|---|
| **selection ratio** | selected blocks ÷ all available blocks | **lower** = more focused |
| **body ratio** | delivered body bytes ÷ all body bytes | **lower** = more compression |
| **always-included** | constraint blocks forced into every pack | context-dependent |
| **task-matched** | blocks the task/scope actually surfaced (beyond constraints) | `> 0` means the task hit real context |
| **scopes covered** | how many requested scopes appear in the pack | `covered / requested`; raise by tagging blocks |

A pack that is *all* constraints with `task-matched: 0` means your task wording
or tags didn't surface anything — add tags to the relevant `##` heading and
re-run. The metrics need only local files; no hosted memory is involved.

---

## Step 4 - Start the MCP server

Run:

```sh
npm run agentctx:mcp
```

The server is intended for local stdio MCP clients. It exposes the same product
contract regardless of client:

```text
get_context(task: string, scope?: string)
list_constraints()
```

---

## Step 5 - Add the client instruction

Add this operating instruction to each AI client that uses the MCP server:

```text
At task start, call get_context(task). Before destructive or structural changes,
call list_constraints().
```

That single instruction is the adoption wedge. Claude Code, Codex, Cursor, and
ChatGPT-compatible MCP clients should all start from the same source of truth
instead of separately hand-maintained instruction files. (Tools that read a
static `AGENTS.md` / `CLAUDE.md` get one *compiled* from the same source —
`mind-ontology emit` — kept provably fresh by `emit --check`; see the
[emit target spec](workbench-w1-emit-target-spec.md).)

---

## Step 6 - Smoke a real task

Ask the client to begin a bounded task, for example:

```text
Use Mind Ontology context to plan the next OSS MCP foundation PR.
```

The client should call:

```text
get_context("Use Mind Ontology context to plan the next OSS MCP foundation PR",
  scope="mind-ontology,oss,mcp")
list_constraints()
```

The useful result is not that the agent knows every note. The useful result is
that it receives the same current direction and constraints as every other
agent.

---

## Troubleshooting

> Every CLI failure mode and its fix is catalogued in
> [`cli-errors.md`](cli-errors.md). The most common ones are below.

### The compiler cannot find `.agentctx/`

Run from the repo root or pass `--cwd`:

```sh
npm run agentctx:compile -- --cwd "C:/path/to/repo" --task "Test context"
```

If the folder does not have starter files yet, scaffold them:

```sh
npm run agentctx:init -- --cwd "C:/path/to/repo"
```

The compiler requires `.agentctx/constraints.md` because constraints are always
included and should never be silently dropped.

### The pack is too broad

Add a narrower scope:

```sh
npm run agentctx:compile -- --task "Write license boundary docs" --scope "license,oss,boundary"
```

### The pack is missing important context

Add tags to the relevant `##` heading in `.agentctx/` and rerun the compile
command. Keep constraints in `constraints.md` when they must always apply.

### The MCP client sees too many tools

Mind Ontology MCP should stay thin in v0. Expose only:

```text
get_context
list_constraints
```

Do not add hosted writeback, graph, or retrieval tools until the adapter
contract is explicitly scoped.

---

## Scoring and output options

The default compiler behavior is minimal and deterministic. All of the following
flags are **opt-in** — a flag-off run is byte-for-byte identical to before.

### --format compact

Strip all metadata from the output and emit only the block headings and bodies.
Useful when feeding the pack directly into a tight prompt:

```sh
npm run agentctx:compile -- --task "Fix the OAuth flow" --format compact
```

Output: a `# context pack: <task>` header, a risk line if the task is risky, then
each block as `## file / heading` + body. No `Source:`, `Reason:`, `Tags:`,
generated timestamp, or Omitted section.

### --rich-scoring

Boost heading/tag hits over body-only hits, so the block that *names* the topic
outranks one that only mentions it in passing:

```sh
npm run agentctx:compile -- --task "Fix the OAuth flow" --scope auth --rich-scoring
```

Off by default. Does not change which blocks are available — only their rank.

### --recency

Break score ties by a `Date: YYYY-MM-DD` line in the block body. Among
equally-relevant blocks the newer date is preferred. Deterministic: no decay,
no current-time comparison, just stable ISO-date ordering. Blocks with no date
or an invalid date are neutral:

```sh
npm run agentctx:compile -- --task "Latest caching decision" --recency
```

To use recency, add a `Date:` line to any block:

```markdown
## Cache booking availability #performance #cache

Status: accepted
Date: 2026-02-10

Availability lookups dominate booking latency…
```

### --aliases

Honor a block's `Aliases: a, b, c` line. A task/scope term matching a declared
synonym is treated as a heading-tier hit, surfacing the block even when the task
uses a different word:

```sh
npm run agentctx:compile -- --task "Fix the auth bug" --aliases
```

To use aliases, add an `Aliases:` line to any block that should respond to synonyms:

```markdown
## OAuth 2.0 integration #security

Aliases: auth, authentication, login, sign-in

Implemented as a PKCE flow with short-lived tokens…
```

`--aliases` is static and author-declared: no stemming, no inference, no schema
change. The `Aliases:` line is part of the block body, so it already earns a
body-tier hit without the flag; enabling it adds a heading-tier hit on top.

### --explain

Add per-block provenance to the output. Each included block gets an `Explain:`
line showing `sourceFile`, `heading`, `score`, and `reason` (`constraint` /
`scored` / `risk-forced`). When `--recency` fires, `recencyDate` is added; when
`--aliases` fires, `matchedAliases` is added:

```sh
npm run agentctx:compile -- --task "Fix the auth bug" --aliases --recency --explain
```

Example explain line in markdown output:

```text
Explain: sourceFile=decisions.md heading="OAuth 2.0 integration" score=14 reason=scored recencyDate=2026-02-10 matchedAliases=auth
```

### --max-tokens

Cap the pack size to a rough token budget (approximately 4 chars/token). Mandatory
blocks (constraints, risk-forced safety guidance) are always kept; lower-priority
blocks are dropped to fit:

```sh
npm run agentctx:compile -- --task "Fix the OAuth flow" --max-tokens 2000
```

Combine with `--format compact` for the tightest budgets — the token estimate
counts the compact rendering, so what you estimate is what the agent receives:

```sh
npm run agentctx:compile -- --task "Fix the OAuth flow" --max-tokens 2000 --format compact
```

---

## Library routing (layer ①)

One ontology handles a single product or domain. When you have more than one,
keep each in its own subdirectory of a **library** folder, each with its own
`.agentctx/` and a `manifest.json`:

```text
ontologies/
  my-product/.agentctx/      + manifest.json
  other-service/.agentctx/   + manifest.json
```

The `manifest.json` for each box declares the trigger terms that route to it:

```json
{
  "id": "my-product",
  "name": "My Product",
  "triggers": ["checkout", "payment", "stripe"],
  "scopes": ["backend", "billing"]
}
```

### Route a task to the best-matching box

```sh
npm run mind-ontology -- route --library ./ontologies --task "debug the checkout flow"
```

Output: which box was selected, whether the decision was ambiguous, and the
candidate scores.

### Compile from a library in one step

```sh
npm run mind-ontology -- compile --library ./ontologies --task "debug the checkout flow"
```

Routes to the best box and compiles it. The same flags as a single-ontology
compile apply (`--rich-scoring`, `--recency`, `--aliases`, `--format`,
`--max-tokens`, etc.):

```sh
npm run mind-ontology -- compile --library ./ontologies \
  --task "debug the checkout flow" --aliases --recency --format compact
```

### Lint the whole library

```sh
npm run mind-ontology -- doctor --library ./ontologies
```

`doctor` flags duplicate box ids, boxes with no triggers, and trigger sets that
would always produce an ambiguous match. Run this in CI alongside `emit --check`
to keep the routing contract fresh.

### Draft a manifest from an existing ontology

```sh
npm run mind-ontology -- scaffold --cwd ./ontologies/my-product
```

`scaffold` reads the existing project names, glossary terms, and direction
blocks, and emits a draft `manifest.json` with suggested triggers. Review and
trim the suggestions before saving — the router only trusts author-confirmed
terms, and a manifest with no triggers is rejected.

Pass `--format json` to emit a machine-readable draft:

```sh
npm run mind-ontology -- scaffold --cwd ./ontologies/my-product --format json
```

### MCP opt-in: route via environment variable

Start the MCP server with `AGENTCTX_LIBRARY` set to the library path:

```sh
AGENTCTX_LIBRARY=./ontologies npm run agentctx:mcp
```

When a library is present, `get_context(task)` routes to the best-matching box
before compiling. Without the variable, the server compiles from `AGENTCTX_HOME`
(or the server's working directory) as before. Library routing is transparent to
the client: same two-tool surface, same instruction text.

---

## Done state

The quickstart is successful when:

- a local compile command returns a task-scoped pack;
- the local MCP server starts;
- the client can call `get_context(task)`;
- the client can call `list_constraints()`;
- no hosted dependency is required;
- no deploy, migration, or live write occurs.

At that point the free layer has proven its core promise: one portable meaning
source for multiple AI agents.
