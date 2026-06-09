# Mind Ontology MCP Quickstart

**Status:** Draft for Phase 1 / P1-PR04  
**Goal:** Get the local stdio MCP layer running from `.agentctx/` files.

This quickstart is install-first. It assumes a user wants to prove the free OSS
layer before caring about hosted SIRT, extraction, UI, or advanced schema work.

---

## What you will run

```text
.agentctx/ Markdown files
  -> agentctx compiler
  -> local stdio MCP server
  -> get_context(task) and list_constraints()
```

No hosted SIRT account, database, deploy, migration, or production write is
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
instead of separate drifting instruction files.

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
npm run agentctx:compile -- --task "Write license boundary docs" --scope "license,oss,sirt"
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

Do not add hosted SIRT writeback, graph, or retrieval tools until the adapter
contract is explicitly scoped.

---

## Done state

The quickstart is successful when:

- a local compile command returns a task-scoped pack;
- the local MCP server starts;
- the client can call `get_context(task)`;
- the client can call `list_constraints()`;
- no hosted SIRT dependency is required;
- no deploy, migration, or live write occurs.

At that point the free layer has proven its core promise: one portable meaning
source for multiple AI agents.
