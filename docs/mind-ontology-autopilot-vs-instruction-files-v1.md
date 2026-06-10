# Mind Ontology — Autopilot vs Per-Tool Instruction Files v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why an autopilot line uses **one compiled constitution** instead of a separate
hand-maintained instruction file per tool (`CLAUDE.md`, `AGENTS.md`, Cursor rules,
ChatGPT project instructions). This is the product's core wedge, applied to an
autonomous line.

The position is **not** "static files are bad" — it is **"stop hand-writing
them; compile them."** Static instruction files are *targets*, not *sources*:
`mind-ontology emit` builds `AGENTS.md` / `CLAUDE.md` from the same
constitution, and `emit --check` fails CI when they drift (see the
[emit target spec](workbench-w1-emit-target-spec.md)).

Local-first throughout: one folder of Markdown, no hosted SIRT.

---

## The instruction-file problem

Every AI tool keeps its own static instruction file. By default it is
*hand-written*, so the *same* meaning — direction, constraints, roles — is
copied into N places that drift:

- change your direction once and you must update it everywhere, by hand,
- each file phrases the rules slightly differently, so agents quietly disagree,
- nothing is task-scoped: each file is a long dump the agent reads whole,
- there is no safety floor that is *guaranteed* present on a risky step.

For a single chat this is tolerable. For an autonomous **line** of cooperating
agents over hours, the drift compounds into agents that disagree about the rules.

## The constitution approach

The autopilot line keeps the meaning **once**, in `.agentctx/`, and compiles a
task-scoped slice on demand:

| Hand-written per-tool instruction files | One compiled constitution |
|---|---|
| N files, hand-synced | one source, compiled for all |
| whole-file dump per tool | task-scoped pack per step |
| drift between tools | identical rules everywhere |
| no guaranteed safety floor | `constraints.md` always included |
| edited in N places | edited once, reviewed in a PR |

See [portability](mind-ontology-autopilot-portability-v1.md) for the same-surface
guarantee and the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md)
for when each step reads it.

## Static files as targets, not sources

A tool that only reads a static file is not excluded from the constitution —
it just gets the *compiled* one. `mind-ontology emit` builds `AGENTS.md` and
`CLAUDE.md` from `.agentctx/` deterministically, stamps each artifact with
source and content fingerprints, and `emit --check` turns drift into a CI
failure instead of a silent disagreement. The drift column of the table above
is solved twice over: agents on the live MCP path never see a stale file, and
agents on static files see one that provably matches the source or fails the
build. What stays true either way: the file is never the place meaning is
*edited*. Hand edits to an emitted artifact are detected (`HAND-EDITED`) and
belong in the source blocks instead.

## It does not forbid your `CLAUDE.md`

A tool-specific instruction file can still exist for tool-specific quirks. The
point is that the *shared meaning* — direction, decisions, constraints, roles —
lives in the constitution and is not duplicated. A hand-maintained instruction
file shrinks to "call `get_context(task)` at task start" plus anything truly
tool-local — or is replaced outright by an emitted one, compiled from the same
constitution.

---

One source — compiled per task for live agents, compiled per tool for static
files — served the same way to every agent: that is the difference between an
autopilot line that stays coherent over hours and N drifting hand-written files
that do not. See [the pack frame](mind-ontology-autopilot-pack-v1.md).
