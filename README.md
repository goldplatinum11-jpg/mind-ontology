# Mind Ontology

**Your portable meaning layer for AI agents.**

One curated source of *what you're doing and why* — direction, decisions,
constraints, vocabulary, projects, roles — compiled into exactly the context an
AI agent needs for the task in front of it, and served to every agent the same
way.

> **Status:** standalone, pre-release, **local-first**. The free layer needs no
> account, no database, and no network. Hosted memory is an *optional*,
> fail-closed on-ramp that is **off by default**.
>
> **License:** not yet finalized — distribution is **fail-closed** until the OSS
> license is chosen. See [Distribution & license boundary](#distribution--license-boundary).

---

## The problem

Every AI tool keeps its own memory and its own instruction file. `CLAUDE.md` for
Claude Code. `AGENTS.md` for Codex. Cursor rules. ChatGPT project instructions.
The *same* meaning, copied into N drifting places. Change your direction once and
you update it everywhere — or your agents quietly disagree.

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

- **Not a notes app, not a vector DB, not another static instruction file.** It's
  a tiny compiler + MCP adapter over files you can read and review in a PR.
- **Scoped, not dumped.** `get_context("fix the OAuth flow")` returns a focused
  pack, not the whole brain.
- **Portable.** The same source feeds Claude Code, Codex, Cursor, and — via a
  thin self-hosted connector — ChatGPT and Claude.ai.
- **Local-first and trustable.** No account, no database, no network for the free
  layer. Hosted memory is opt-in and reversible.

---

## 60-second start

```sh
npm install                               # vitest is the only dependency
npm run agentctx:init                     # scaffold .agentctx/ from the template
npm run agentctx:compile -- --task "Plan the next PR" --scope mcp
npm run agentctx:validate                 # check your ontology against the schema
npm run agentctx:metrics  -- --task "Plan the next PR"   # how focused is the pack?
npm run agentctx:smoke                    # one-command end-to-end check
```

Validate the install before trusting it:

```sh
npm run agentctx:proof                    # smallest viable gate (fast, local)
npm test                                  # full unit suite
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

See the [quickstart](docs/mind-ontology-quickstart.md) for the install-first flow
and [client setup proofs](docs/mind-ontology.md#client-setup) for per-tool wiring.

---

## Competency Questions — the verification core

Mind Ontology is verified by the concrete questions an agent must be able to
answer before it acts. These **Competency Questions (CQs)** are the product's
correctness contract — not decoration:

- *Which files am I allowed to write in this task?*
- *What is the current direction this work serves?*
- *What must I never do, and when must I fail closed?*

The compiled context pack must answer the active CQs from local files alone. See
the [CQ schema](docs/mind-ontology-cq-schema-v0.md) and the template at
`templates/mind-ontology/.agentctx/cq.md`.

---

## What's in the box

| Layer | What | Status |
|---|---|---|
| Sources | `.agentctx/` schema: constraints, identity, direction, projects, decisions, architecture, roles, glossary, competency questions | shipped |
| Compiler | task-scoped scoring, risk-aware forcing, JSON/Markdown | shipped |
| Tooling | `init`, `compile`, `validate`, `metrics`, `smoke`, `proof` | shipped |
| Clients | Claude Code / Codex / Cursor (proven), ChatGPT / Claude.ai (thin connector, designed) | shipped / designed |
| Hosted on-ramp | optional SIRT memory + writeback, fail-closed, off by default | contracts only |

---

## Distribution & license boundary

This package is **not yet licensed for distribution.** The OSS license has not
been finalized, so distribution is intentionally **fail-closed**:

- `package.json` carries `"license": "SEE docs/mind-ontology-license-boundary.md"`
  rather than a concrete SPDX identifier.
- The recommended posture (Apache-2.0 default, MIT acceptable) is documented in
  [`docs/mind-ontology-license-boundary.md`](docs/mind-ontology-license-boundary.md),
  but **no `LICENSE` file is shipped yet** and none should be invented.
- The fail-closed state and what must happen before distribution are tracked in
  [`LICENSE-DECISION.md`](LICENSE-DECISION.md).

Until a `LICENSE` file exists, treat this repository as **source-available for
review only**, not as an OSS-licensed release.

---

## Trust

- The free layer is local, file-based, and reviewable — no account, no network.
- Every hosted feature is opt-in, fail-closed, and reversible; the local path is
  never load-bearing.
- No credentials live in this repo: connector URLs and tokens are
  operator-supplied. The hosted boundary is enforced by
  [`tests/unit/agentctx-no-leakage-audit.test.mjs`](tests/unit/agentctx-no-leakage-audit.test.mjs).

See the [trust & security model](docs/mind-ontology-trust-security-model-v0.md)
and the [OSS↔hosted boundary](docs/mind-ontology.md) docs for the full posture.

---

## Documentation

Start at the [docs index](docs/mind-ontology.md). Provenance for this standalone
extraction is recorded in [`EXTRACTION-INVENTORY.md`](EXTRACTION-INVENTORY.md)
and [`docs/mind-ontology-extraction-map.md`](docs/mind-ontology-extraction-map.md)
— those are read-only history, not a user quickstart.

---

## Status

Mind Ontology is built in public, one reviewable change at a time, across five
arcs: OSS foundation → schema & context quality → multi-client distribution →
hosted on-ramp → launch readiness. The hosted SIRT backend remains a closed,
optional service; this repository is the open, local-first product surface.
