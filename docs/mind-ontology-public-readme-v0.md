# Mind Ontology

> **Draft status:** this was the P5 draft of the public README. The live
> [top-level README](../README.md) supersedes it; since Workbench W10 the
> public headline is the compile-target positioning ("Stop hand-writing
> AGENTS.md. Compile it."). This draft is kept as provenance.

**Your portable meaning layer for AI agents.**

One curated source of *what you're doing and why* — direction, decisions,
constraints, vocabulary, projects, roles — compiled into exactly the context an
AI agent needs for the task in front of it, and served to every agent the same
way.

---

## The problem

Every AI tool keeps its own memory and its own instruction file. `CLAUDE.md` for
Claude Code. `AGENTS.md` for Codex. Cursor rules. ChatGPT project instructions.
The *same* meaning, hand-copied into N drifting places. Change your direction
once and you update it everywhere — or your agents quietly disagree.

## The idea

Keep the meaning **once**, in a small folder of Markdown files (`.agentctx/`),
and compile a **task-scoped** slice of it on demand:

```text
.agentctx/ source files
  → agentctx compiler (scores blocks against your task)
  → get_context(task) / list_constraints()
  → any MCP-capable agent
```

Agents don't get your whole ontology on every task. They get the relevant
direction, the matching decisions, the full set of non-negotiable constraints —
and, on a risky task, the safety blocks forced in.

## Why it's different

- **Not a notes app, not a vector DB, not another hand-written instruction
  file.** It's a tiny compiler + MCP adapter over files you can read and review
  in a PR — and static instruction files become its compile *targets*
  (`mind-ontology emit`), not competing sources.
- **Scoped, not dumped.** `get_context("fix the OAuth flow")` returns a focused
  pack, not the whole brain. (Typical: a quarter of the ontology body.)
- **Portable.** The same source feeds Claude Code, Codex, Cursor, and — via a
  thin self-hosted connector — ChatGPT and Claude.ai.
- **Local-first and trustable.** The free layer needs no account, no database, no
  network. Hosted memory is an *optional*, fail-closed on-ramp you can turn off
  at any time.

---

## 60-second start

```sh
npm run agentctx:init                     # scaffold .agentctx/ from the template
npm run agentctx:compile -- --task "Plan the next PR" --scope mcp
npm run agentctx:validate                 # check your ontology against the schema
npm run agentctx:metrics  -- --task "Plan the next PR"   # how focused is the pack?
npm run agentctx:smoke                    # one-command end-to-end check
```

Wire it into an agent (Claude Code shown; Codex/Cursor analogous):

```json
// .mcp.json
{ "mcpServers": { "agentctx": { "command": "node", "args": ["scripts/agentctx/mcp-server.mjs"] } } }
```

Then give every agent the same one-line instruction:

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

---

## What's in the box

| Layer | What | Status |
|---|---|---|
| Sources | `.agentctx/` schema for constraints, identity, direction, projects, decisions, architecture, roles, glossary, competency questions | shipped |
| Compiler | task-scoped scoring, risk-aware forcing, JSON/Markdown | shipped |
| Tooling | `init`, `compile`, `validate`, `metrics`, `smoke` | shipped |
| Clients | Claude Code / Codex / Cursor (proven), ChatGPT / Claude.ai (thin connector, designed) | shipped / designed |
| Hosted on-ramp | optional SIRT memory + writeback, fail-closed, off by default | contracts shipped |

---

## Trust

- The free layer is local, file-based, and reviewable — no account, no network.
- Every hosted feature is opt-in, fail-closed, and reversible; the local path is
  never load-bearing.
- No credentials live in this repo: connector URLs and tokens are operator-supplied.

See the trust & security model and the OSS↔hosted boundary docs for the full
posture.

---

## Status

Mind Ontology is built in public, one reviewable PR at a time, across five
phases: OSS foundation → schema & context quality → multi-client distribution →
hosted on-ramp → launch readiness.
