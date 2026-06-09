# Mind Ontology — Autopilot vs Per-Tool Instruction Files v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why an autopilot line uses **one compiled constitution** instead of a separate
hand-maintained instruction file per tool (`CLAUDE.md`, `AGENTS.md`, Cursor rules,
ChatGPT project instructions). This is the product's core wedge, applied to an
autonomous line.

Local-first throughout: one folder of Markdown, no hosted SIRT.

---

## The instruction-file problem

Every AI tool keeps its own static instruction file. The *same* meaning —
direction, constraints, roles — is copied into N places that drift:

- change your direction once and you must update it everywhere, by hand,
- each file phrases the rules slightly differently, so agents quietly disagree,
- nothing is task-scoped: each file is a long dump the agent reads whole,
- there is no safety floor that is *guaranteed* present on a risky step.

For a single chat this is tolerable. For an autonomous **line** of cooperating
agents over hours, the drift compounds into agents that disagree about the rules.

## The constitution approach

The autopilot line keeps the meaning **once**, in `.agentctx/`, and compiles a
task-scoped slice on demand:

| Per-tool instruction files | One compiled constitution |
|---|---|
| N files, hand-synced | one source, compiled for all |
| whole-file dump per tool | task-scoped pack per step |
| drift between tools | identical rules everywhere |
| no guaranteed safety floor | `constraints.md` always included |
| edited in N places | edited once, reviewed in a PR |

See [portability](mind-ontology-autopilot-portability-v1.md) for the same-surface
guarantee and the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md)
for when each step reads it.

## It does not forbid your `CLAUDE.md`

A tool-specific instruction file can still exist for tool-specific quirks. The
point is that the *shared meaning* — direction, decisions, constraints, roles —
lives in the constitution and is not duplicated. The instruction file shrinks to
"call `get_context(task)` at task start" plus anything truly tool-local.

---

One source, compiled per task, served the same way to every agent: that is the
difference between an autopilot line that stays coherent over hours and N drifting
files that do not. See [the pack frame](mind-ontology-autopilot-pack-v1.md).
