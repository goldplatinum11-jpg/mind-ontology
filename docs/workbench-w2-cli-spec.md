# Workbench W2 — CLI Surface Specification (v1)

**Status:** specification only · docs-only lane (`claude/workbench-w2-emit-cli-spec` class)
**Fulfills:** ADL **W2** of the
[Workbench v1 design packet](mind-ontology-workbench-design-v1.md) (Part B).
The packet's provisional artifact name was `mind-ontology-workbench-cli-v0.md`;
the controller assigned this filename instead — treat this document as that
artifact.
**Ground truth:** the [W1 emit target spec](workbench-w1-emit-target-spec.md).
Everything W1 marks normative is consumed unchanged here; the three places this
document *refines* W1 (the `--check` exit-code split, the dual-target advisory,
and one added sentence to the CLAUDE.md notice line) are each flagged inline as
refinements, with rationale.
**Operator decisions baked in** (resolving W1's section 11 open questions):
the default profile split is approved as specified (Q1); the 400-line budget
stays **warn-only** — no `--strict` flag exists or is planned (Q2); artifact
paths stay fixed at the `--cwd` root (Q3); section-level emit stays rejected
(Q4).

This document specifies the **operator-facing CLI surface**: flags, output
formats, stream discipline, exit codes, error rows, and how the new verbs hang
off the existing `agentctx` engine CLI. Engine implementation is W3+ and ships
nothing here.

---

## 1. Scope

Commands specified: `status`, `preview`, `cq`, `emit` (including
`emit --check`), `review`. Per the design packet's A3 rules, every command is
read-only except `emit` without `--check`, every command is a thin presentation
over existing engine modules, and nothing specified here is reachable by an
agent through MCP — the
[two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md) is
untouched.

Where a command's *exact* output bytes matter (golden files), this document
locks the **shape** (keys, enums, stream, exit code) and leaves byte-level
freezing to the named downstream ADL (W3–W9). Text renderings shown below are
illustrative unless marked normative.

## 2. Shared command contract

These rules bind every Workbench command. They exist so an operator (or an
agent worker reading [cli-errors.md](cli-errors.md)) learns one contract, not
five.

### 2.1 Common flags

| Flag | Meaning | Default |
|---|---|---|
| `--format text\|json` | output format of the **stdout result/report** | `text` |
| `--cwd <path>` | directory containing `.agentctx/` | process cwd |
| `--help` / `-h` | per-command usage text | — |

Notes:

- The value set is `text|json`, not the engine `compile` command's
  `markdown|json`. Workbench commands are *screens*, not pack serializers; the
  `text` rendering of `preview` is annotated markdown for a human, while
  `compile --format markdown` remains the byte-stable pack serialization
  agents and tests depend on. The two flag vocabularies coexist deliberately
  and are documented side by side in the help text.
- `--format` affects **stdout only**. Stderr is always human-readable text
  (section 2.3).
- `review` takes no `--cwd`: its one input is the explicit `--pack <path>`
  (resolved against the process cwd), and v1 shape validation reads nothing
  else from the project.

### 2.2 One contract for agents and humans

**Ruling: there is no caller detection.** No TTY sniffing, no `--agent` flag,
no environment-variable mode switch, no color codes in v1. A human and an
agent worker invoking the same argv get byte-identical behavior.

Rationale:

1. The existing error contract in [cli-errors.md](cli-errors.md) is already
   caller-neutral and explicitly addressed to both audiences: *exit code +
   one stderr line* is the machine signal, and the same line is the human
   message. Adding a second, caller-detected surface would mean two error
   paths to keep in sync and test.
2. Output that varies with the caller's terminal breaks golden-file tests
   (W3/W6) and makes agent transcripts differ from what the operator sees
   when reproducing a failure — the worst possible property for a debugging
   surface.
3. Machine consumers that want structure opt in explicitly with
   `--format json`. Explicit beats detected.

Consequently there is also **no JSON error envelope** in v1: on failure,
stdout carries no fabricated JSON (with the report-command exception below),
and the error is one actionable stderr line. A consumer that received exit
≠ 0 must not parse stdout as a result — the standing rule from
[cli-errors.md](cli-errors.md).

### 2.3 Stream discipline

Two command classes, following the precedent set by `validate` (which prints
a *report* to stdout and still exits non-zero):

| Class | Commands | stdout | stderr |
|---|---|---|---|
| **Result commands** | `preview`, `emit` (write mode) | the result, only on success | user/compile errors (one line); warnings (e.g. budget overflow, dual-target advisory) |
| **Report commands** | `status`, `cq`, `emit --check`, `review` | the report, **even when the verdict is negative** | only *hard* errors that prevented producing a report (e.g. broken ontology, unreadable pack file) |

A negative verdict (drift found, CQ unanswered, pack invalid, section
unhealthy) is a successful *report* of a bad *state*: report on stdout,
non-zero exit. A hard error is a failure to produce any verdict: one stderr
line, empty stdout (no partial JSON), non-zero exit. This is W1's fail-closed
principle applied to streams — no partial silent answer.

### 2.4 Exit codes

| Command | `0` | `1` | `2` |
|---|---|---|---|
| `status` | every section healthy | any section unhealthy, or hard error | — |
| `preview` | pack compiled | user/compile error | — |
| `cq` | every selected CQ answered | any CQ unanswered, or hard error | — |
| `emit` (write) | all requested targets written | refusal, user, or compile error | — |
| `emit --check` | every checked target `OK` | ≥1 target in any drift class | hard error (compile failure, unknown target, invalid flag combo) |
| `review` | pack valid | pack invalid, or hard error | — |

**Refinement of W1 §8 (flagged):** W1 required only "non-zero for both" drift
and hard errors and delegated the split to W2 (its handoff item 3). Ruling:
`emit --check` — and only `emit --check` — distinguishes **`1` = drift** (the
next safe action is mechanical: re-run `emit`) from **`2` = hard error** (the
next safe action needs a human: fix the ontology or the invocation). This is
the established checker convention (`git diff --exit-code`, formatter
`--check` modes) and lets CI branch in shell without parsing JSON. Within
check mode, usage errors (e.g. unknown `--target`) exit `2`, keeping `1`
reserved to mean exactly "drift". Every other command keeps the uniform
`0`/`1` of the existing catalog. Naive CI that treats any non-zero as failure
remains correct.

## 3. Command map

| Command | Job | Writes? | Engine modules used | Lands in |
|---|---|---|---|---|
| `status` | one health roll-up | no | `schema.mjs`, `metrics.mjs`, compile (CQ answerability), the `emit --check` core | W7 |
| `preview` | the pack the agent would see, with provenance | no | `compile.mjs` + `--explain` (W5), `risk.mjs` | W6 |
| `cq` | per-CQ answerability | no | compile + `.agentctx/cq.md` | W8 |
| `emit` | compile static per-tool artifacts | **yes** (declared targets only) | compile + emit templates | W3 |
| `emit --check` | drift gate | no | same, in-memory | W4 |
| `review` | Result Pack shape verdict | no | shared shape-check module extracted in W9 | W9 |

## 4. `status`

```text
mind-ontology status [--format text|json] [--cwd <path>]
```

Aggregates four sections, each sourced verbatim from its engine module — no
re-derived logic, per the packet's design rule 2:

| Section | Source | Healthy means |
|---|---|---|
| `validate` | the schema validator (`schema.mjs`) | 0 errors (warnings allowed) |
| `metrics` | `metrics.mjs` over the **representative tasks** (below) | metrics computed without error |
| `cq` | the `cq` command's core (section 6) | every CQ answered |
| `emit` | the `emit --check` core, result embedded verbatim (W1 §8: headers are the manifest) | every v1 target `OK` |

**Representative tasks** for the metrics section are the rendered CQ question
titles from `.agentctx/cq.md`, in source order. Rationale: the design packet
asks for "pack-focus metrics for representative tasks" without saying where
tasks come from; CQs *are* the ontology's own statement of what it must
answer ([CQ schema](mind-ontology-cq-schema-v0.md)), they are deterministic,
versioned with the sources, and require no new config surface (a config file
is a v1 non-feature, section 12).

Degradation rules (a `status` that only works on rich ontologies is useless):

- `.agentctx/cq.md` absent → the `cq` and `metrics` sections report
  `"skipped"` with a one-line reason, and **do not** make the roll-up
  unhealthy. A minimal ontology is valid (W1 §9) and must show green.
- A broken ontology (missing/empty `constraints.md`, missing `.agentctx/`) is
  a **hard error**: the standard compile/validate message from
  [cli-errors.md](cli-errors.md) on stderr, exit `1`, no partial report.

JSON shape (`--format json`; key set normative, section internals locked by
W7):

```json
{
  "ok": false,
  "sections": {
    "validate": { "ok": true, "errors": 0, "warnings": 1 },
    "metrics":  { "ok": true, "tasks": [ { "task": "What must the agent avoid?" } ] },
    "cq":       { "ok": false, "total": 4, "answered": 3 },
    "emit":     { "ok": false, "targets": [ { "target": "claude-md", "path": "CLAUDE.md", "status": "stale", "detail": "sources changed since last emit; run: mind-ontology emit --target claude-md" } ] }
  }
}
```

`sections.emit` is byte-for-byte the `emit --check --format json` `targets`
payload (section 7.4) — one shape, two consumers, as W1's handoff item 7
requires. Exit: `0` iff `ok` is `true`.

## 5. `preview`

```text
mind-ontology preview --task "…" [--scope <csv>] [--risk auto|safe|risky]
                      [--format text|json] [--cwd <path>]
```

`preview` is `compile` plus the W5 `--explain` data, rendered for a human.
Flag names, value sets, validation, and error messages for `--task`,
`--scope`, `--risk`, and `--cwd` are **identical to `compile`'s** (same
parser path) — an operator who knows one knows the other, and the compile
error rows in [cli-errors.md](cli-errors.md) apply verbatim. `--task` is
required.

Output adds, per block, the W5 explain tuple — this is the provenance the
design packet's job 1 ("see what the agent sees") demands:

| Field | Meaning |
|---|---|
| `sourceFile` | `.agentctx/` file the block came from |
| `heading` | the block's heading title |
| `score` | lexical score, `null` for non-scored inclusion |
| `reason` | `constraint` \| `scored` \| `risk-forced` |

The detected risk mode (and whether it was forced by `--risk` or classified
by `auto` — see [risk modes](mind-ontology-autopilot-risk-modes-v1.md)) leads
the output; `risk-forced` blocks are visibly flagged in text mode.

Illustrative text rendering (bytes frozen by W6's snapshot test, not here):

```text
Pack preview — task: "Plan the next PR"  ·  risk: risky (auto)  ·  scopes: (none)

.agentctx/constraints.md
  • No SIRT dependency in core            [constraint]
  • Never write secrets to disk           [constraint]
.agentctx/decisions.md
  • Local-first before hosted             [scored 0.62]
  • Rollback policy                       [risk-forced]
```

JSON: the `compile --format json` object extended additively with the explain
fields per selected block. Normative requirements on W5/W6: the non-explain
`compile` output stays byte-for-byte identical, and explain output is
deterministic. Exit: `0` success, `1` on the compile error set.

## 6. `cq`

```text
mind-ontology cq [--id <n>] [--format text|json] [--cwd <path>]
```

Operationalizes the [CQ schema](mind-ontology-cq-schema-v0.md): for each
competency question block in `.agentctx/cq.md`, compile a pack using the
rendered question as the task and report whether the pack **answers** it,
and from which blocks.

- **Ids** are 1-based source order. Inserting or reordering CQs renumbers
  them — documented limitation; ids are a session-scoped selector, not a
  stable reference. (A stable slug scheme is deliberately deferred: it would
  need an authoring-contract change in the CQ schema, out of W2 scope.)
- `--id <n>` restricts the run and the verdict to that one CQ. An id outside
  `1..N` is a hard error naming the valid range.
- **Answerability predicate** (implemented in W8; normative properties
  here): deterministic, purely structural/lexical — tag intersection and the
  compiler's own selection; **no language model** (W1 principle 1 extends to
  every Workbench verdict). A CQ counts as answered when the compiled pack
  for it contains at least one block sharing a topic tag with the CQ or
  selected by scoring against the question text. The exact predicate is W8's
  to lock with table-driven fixtures; it must never depend on wall-clock,
  locale, or randomness.
- **Missing `cq.md` is a hard error** for `cq` (the operator explicitly asked
  for a CQ report; there is nothing to report) — message and next action in
  section 10. This is deliberately asymmetric with `status`, which skips the
  section: an aggregate view tolerates absence, an explicit invocation does
  not.

Exit: `0` iff every selected CQ is answered; any unanswered CQ → `1`. This
is the merge-gate strength the design packet's A2 promises the team
maintainer ("CQ verification as the merge gate"): an unanswered CQ is a
broken promise by the ontology, not a style nit.

> **Ratified amendment (operator ruling, 2026-06-10 — supersedes the
> paragraph above for v1; W8 implements this version):** the v1 gate is
> softened to the **required** CQs only — an unanswered CQ whose topic is one
> of the [CQ schema](mind-ontology-cq-schema-v0.md)'s required topics
> (`#context` / `#safety`) exits `1`; every other unanswered CQ renders as an
> advisory `UNANSWERED` line in the report without failing the gate. A
> `--strict-cq` flag restoring full-gate strength is logged for v2
> consideration and does not exist in v1.

JSON shape (normative keys):

```json
{
  "ok": false,
  "total": 4,
  "answered": 3,
  "cqs": [
    {
      "id": 1,
      "question": "What should the agent know before starting?",
      "tags": ["cq", "context"],
      "answered": true,
      "answered_by": [ { "sourceFile": "direction.md", "heading": "Why we are building this" } ]
    }
  ]
}
```

## 7. `emit` and `emit --check`

### 7.1 Synopsis and flags

```text
mind-ontology emit [--target <id>[,<id>…]]…
                   [--check [--explain [--block-manifest] [--block-reconcile-plan]]]
                   [--reconcile [--block-level]] [--force] [--full]
                   [--format text|json] [--cwd <path>]
mind-ontology emit --reconcile-source [--apply]
                   [--target <id>[,<id>…]]… [--format text|json] [--cwd <path>]
```

**The reconcile family (two axes).** The reconcile-related flags form a matrix
of *direction* (which side a change lands on) × *granularity*, plus a
read-only provenance surface. This orients the per-flag rows below:

| | preview (read-only) | write |
|---|---|---|
| **artifact-ward** (re-emit AGENTS.md/CLAUDE.md from `.agentctx/`) | `--check --explain --format json [--block-reconcile-plan]` | `--reconcile [--block-level]` |
| **source-ward** (fold a hand-edit of the generated file BACK into `.agentctx/`) | `emit --reconcile-source` | `emit --reconcile-source --apply` |

`--block-level` / `--block-reconcile-plan` act at block granularity rather than
whole-file; `--block-manifest` adds per-block provenance to the `--check`
verdict. Artifact-ward modes write only the generated artifacts and never touch
`.agentctx/`; the source-ward modes are the only ones that write `.agentctx/`
(and never re-emit artifacts — run `emit` afterwards). Every flag below —
artifact-ward, source-ward, and provenance — is in the same table.

| Flag | Meaning | Constraints |
|---|---|---|
| `--target` | restrict to a subset of the registry (W1 §2): `agents-md`, `claude-md` | repeatable **and** CSV (mirrors `--scope`); duplicates are deduped; processing order is always registry order regardless of flag order (determinism) |
| `--check` | classify instead of write (W1 §8); writes nothing | — |
| `--explain` | annotate each `--check` verdict with WHY the target got its class and WHAT a reconcile would do; read-only (writes nothing) | valid **only** with `--check`; using it in write mode is a usage error (exit `2`) |
| `--block-manifest` | attach per-block provenance (`source_file` / `source_block_index` / `source_block_digest` / `rendered_digest` / `emitted_index` / `section` / `forced`) to each target, recomputed **on demand** from the current sources under the profile `--explain` reports (or `null` when that profile is no longer reproducible); read-only (writes nothing) | valid **only** with `--check --explain --format json`; any other combination is a usage error (exit `2`). It is on-demand explain data — never persisted to a header or sidecar |
| `--block-reconcile-plan` | preview the per-block drift a block-level reconcile would repair: per target `{ reproducible, expected_profile, would_write_paths, refuse_reason, blocks }`, where each block change is `{ kind: unchanged\|replace\|insert\|delete, emitted_index, source_file, source_block_index, actual_rendered_digest, expected_rendered_digest }`; read-only (writes nothing) | valid **only** with `--check --explain --format json`; any other combination is a usage error (exit `2`). On-demand preview data — never persisted |
| `--reconcile` | SAFE drift repair: re-emit `MISSING`/`STALE` targets (`STALE` keeps the **header's recorded** profile), skip `OK`, and REFUSE `UNMANAGED`/`HAND-EDITED` — all-or-nothing, writing artifacts only (never `.agentctx/`). Exit `0` reconciled/clean, `1` refused, `2` error. The header still records only **file-level** digests; plain `--reconcile` rewrites whole artifacts. | write mode; combining with `--check` is a usage error (opposite modes); combining with `--full` is a usage error (it would override the recorded profile) |
| `--block-level` | with `--reconcile` only: repair drift with a **block-level patch** (splice only the drifted blocks) instead of a whole-file rewrite. The patched bytes are proven **byte-identical** to the file-level reconcile via a full-artifact guard applied before any write; a guard failure refuses the whole run. Same classes, same refusals, same all-or-nothing, never `.agentctx/`. JSON adds `mode: "block-level"` and a per-target `changed_blocks` count. | valid **only** with `--reconcile`; alone it is a usage error (exit `2`). Does not change the header, bump `emit_version`, or alter plain `--reconcile` |
| `--reconcile-source` | source-ward PREVIEW (read-only): for each `HAND-EDITED` artifact, attribute each edited block body back to its `.agentctx/` source block (via block-manifest provenance) and show the patch that WOULD apply; writes nothing (not `.agentctx/`, not the artifact). All-or-nothing; refuses non-`HAND-EDITED` targets, unreproducible recorded profiles, and any change it cannot isolate to a single block body (a heading/section/footer/structure edit). Exit `0` preview, `1` refused, `2` error. | its own mode; combining with `--check`/`--reconcile`/`--explain`/`--force`/`--full`/`--block-manifest` is a usage error (exit `2`). `--apply` switches it from preview to write |
| `--apply` | with `--reconcile-source` only: WRITE the previewed block-body patches into `.agentctx/` sources surgically (the only mode that writes sources; never re-emits artifacts — run `emit` afterwards). All-or-nothing; affected sources must be git-tracked and clean (recovery is via git); refuses symlinked/non-regular source paths; writes only when the patched sources re-emit to the **exact** hand-edited artifact. Exit `0` applied, `1` refused, `2` error. | valid **only** with `--reconcile-source`; alone it is a usage error (exit `2`) |
| `--force` | overwrite an `UNMANAGED` (headerless) existing file — the only way emit replaces one (W1 §9) | write mode only; combining with `--check` is a usage error (`--check` never writes, so `--force` could only mislead) |
| `--full` | whole-ontology dump profile (W1 §3) | write mode only; combining with `--check` is a usage error — `--check` recompiles with the **header's recorded** profile, never a flag |
| `--format` | stdout format | per section 2.1 |
| `--cwd` | project root containing `.agentctx/`; artifacts resolve against it (W1 §2) | per section 2.1 |

Defaults: with no `--target`, both write and check modes operate on **all v1
targets** (`agents-md`, `claude-md`) — see the section 8 ruling for why this
default survives the double-load objection. Invalid flag combos fail closed
(exit `1` write mode / `2` check mode), never silently ignore a flag.

Proposed `emit --help` text (final bytes frozen in W3):

```text
mind-ontology emit — compile static per-tool artifacts from .agentctx/

Usage:
  mind-ontology emit [options]             write all v1 targets (AGENTS.md, CLAUDE.md)
  mind-ontology emit --check [options]     verify freshness; writes nothing
  mind-ontology emit --reconcile [options] safely re-emit only drifted targets

Options:
  --target <id>[,<id>]   Restrict to targets: agents-md, claude-md. Repeatable.
  --check                Classify each target (OK/MISSING/UNMANAGED/HAND-EDITED/STALE).
                         Exit 0 fresh, 1 drift, 2 error.
  --explain              With --check only: explain why each target got its class
                         and what a reconcile would write. Read-only; never writes.
  --block-manifest       With --check --explain --format json only: attach per-block
                         provenance to each target (on-demand; never persisted).
                         Read-only; never writes.
  --block-reconcile-plan With --check --explain --format json only: preview the
                         per-block drift a block-level reconcile would repair
                         (unchanged/replace/insert/delete). Read-only; never writes.
  --reconcile            Repair drift safely: re-emit MISSING/STALE targets
                         (STALE keeps its recorded profile), SKIP OK ones, and
                         REFUSE UNMANAGED/HAND-EDITED (writing nothing for any
                         target). Writes artifacts only, never .agentctx/.
                         Exit 0 reconciled/clean, 1 refused, 2 error.
  --block-level          With --reconcile only: repair drift with a block-level
                         patch instead of a whole-file rewrite, proven byte-
                         identical to the file-level reconcile. Same refusals.
  --force                Overwrite an existing un-managed file (one without an emit
                         header). Never needed for refreshing managed artifacts.
  --full                 Emit the whole ontology instead of the default profile.
  --format text|json     Output format (default: text).
  --cwd <path>           Project root containing .agentctx/ (default: cwd).

Both files carry identical payloads by design; if every tool you run reads
AGENTS.md, emit only it: mind-ontology emit --target agents-md
```

### 7.2 Write mode

For each requested target: compile through the profile (W1 §3), render frame
+ payload (W1 §4–5), write header + artifact (W1 §6–7). Rewriting a fresh
artifact is a byte-identical no-op (idempotent, W1 §9). One stdout line per
target in text mode:

```text
WROTE  AGENTS.md  (agents-md, profile default, 312 payload lines)
WROTE  CLAUDE.md  (claude-md, profile default, 312 payload lines)
```

Warnings go to **stderr** and never change the exit code or the artifact
bytes (W1 §3): the budget-overflow warning, and the dual-target advisory
(section 8). In `--format json` the same warnings are *additionally* embedded
in the result for CI annotation:

```json
{
  "ok": true,
  "written": [
    {
      "target": "agents-md",
      "path": "AGENTS.md",
      "profile": "default",
      "emit_version": 1,
      "source_digest": "sha256:…",
      "content_digest": "sha256:…",
      "payload_lines": 312
    }
  ],
  "warnings": [
    { "type": "budget-overflow", "target": "agents-md", "payload_lines": 412, "budget": 400 }
  ]
}
```

(Key set normative; digests as defined in W1 §6.)

Failure modes (rows in section 10): `UNMANAGED` refusal without `--force`
(exit `1`, nothing written for **any** target — a multi-target emit is
all-or-nothing, so a half-written pair can never exist), unknown target id,
and compile errors passing through unchanged from
[cli-errors.md](cli-errors.md).

### 7.3 Check mode

Exactly W1 §8: per-target classification `OK` / `MISSING` / `UNMANAGED` /
`HAND-EDITED` / `STALE`, mutually exclusive, checked in W1's order; text
output is one line per target plus the `DRIFT — n of m` summary; a compile
error during recompilation fails the whole check (exit `2`, stderr, no
partial verdict).

### 7.4 Check JSON shape (locked)

This is the shape W1's handoff item 4 asked W2 to lock; `status` embeds
`targets` verbatim:

```json
{
  "ok": false,
  "targets": [
    { "target": "agents-md", "path": "AGENTS.md", "status": "ok", "detail": null },
    { "target": "claude-md", "path": "CLAUDE.md", "status": "stale", "detail": "sources changed since last emit; run: mind-ontology emit --target claude-md" }
  ]
}
```

- `status` enum (JSON, lowercase kebab): `ok` | `missing` | `unmanaged` |
  `hand-edited` | `stale`. The uppercase forms remain the text-mode rendering.
- `detail` is the operator-guidance sentence from W1 §8's per-class table;
  `null` for `ok`.
- `ok` is `true` iff every entry is `ok` — exactly the exit-`0` condition.

**Opt-in extension — `--explain`.** Passing `--explain` (valid only with
`--check`) adds one **additive** key, `explain`, to each `targets[]` entry. The
locked base shape above is byte-for-byte unchanged when `--explain` is absent —
in particular `status` always embeds the base shape and never carries `explain`.
The `explain` object reuses the existing classifier internals (it never
re-classifies) and is read-only (a reconcile is described, never run). Its fields:

- `status` — the same classification as the row's `status`.
- `managed` / `headerPresent` — whether the on-disk file carries an emit header.
- `payloadDigestMatchesHeader` — payload vs. the header's `content_digest`
  (`null` when no header).
- `sourceDigestMatchesCurrent` — current sources' fingerprint vs. the header's
  `source_digest` under the recorded profile (`null` when no header, or when the
  recorded target/profile is no longer reproducible).
- `emitVersionMatches` — header `emit_version` vs. the current generator
  (`null` when no header).
- `expectedProfile` — the profile a reconcile would recompile against (the
  header's recorded profile, else the default).
- `reconcileCommand` — the command a user would run to fix the target
  (`mind-ontology emit --target <id>`, or `--force --target <id>` for
  `unmanaged`).
- `wouldWritePaths` — the artifact path(s) a reconcile WOULD write (empty for
  `ok`). File-level, not block-level: the header records only file-level digests,
  so there is no per-block manifest to narrow this to.

## 8. Ruling — default emit targets and the AGENTS.md/CLAUDE.md double-load

**The problem (reviewer-raised):** W1 principle 3 makes the AGENTS.md and
CLAUDE.md payloads byte-identical. In an environment where one tool reads
*both* files (tool ecosystems increasingly read AGENTS.md alongside their
native file), the same context is loaded twice — pure token waste. Three
candidate default behaviors when `--target` is not given: emit both, emit
one recommended target, or detect the installed tools and emit accordingly.

**Ruling: the default stays "emit both v1 targets". No detection. The
double-load is mitigated, not denied, by three measures below.**

Rationale, in decision order:

1. **Detection is rejected on determinism grounds.** Choosing the target
   *set* from machine state (presence of `.claude/`, editor configs,
   environment variables) makes `emit` and `emit --check` disagree across
   machines: the CI container that runs the drift gate has no tool
   directories at all and would systematically check a different set than
   the developer emitted. W1 §7 prohibits machine identity and environment
   as inputs; the target set is an input to the artifact set, so the same
   prohibition applies. A non-reproducible drift gate is worse than no gate.
2. **A single-target default is rejected because the failure modes are
   asymmetric.** Default-both's worst case is a dual-reading tool loading an
   identical payload twice — *visible, bounded* waste (at most one default
   profile, soft-budgeted at 400 lines, and never contradictory precisely
   because W1 principle 3 makes the payloads byte-identical). Default-one's
   worst case is a tool that reads only the *other* file silently getting
   **no ontology at all** — an *invisible* loss of the product's core promise
   ("see what the agent sees" presumes the agent sees something), in exactly
   the mixed-tool fleets the solo-operator persona runs. Visible waste beats
   invisible absence; fail closed applies to context delivery too.
3. **The product cannot know which tools read which file, and should not
   guess.** The honest mechanism already exists: `--target` is the supported
   single-file mode, chosen by the one party who does know — the operator.

The three mitigations (all normative for W3):

- **(a) Documented narrowing.** A repo whose entire toolchain reads
  AGENTS.md runs `mind-ontology emit --target agents-md` and checks only that
  target in CI. This is the same `--target` escape hatch W1 §2 already
  defines; no new mechanism.
- **(b) Dual-target advisory (stderr, write mode).** When emit runs with
  **no** `--target` flag and writes both v1 targets, it prints one stderr
  line after the per-target lines:

  ```text
  note: AGENTS.md and CLAUDE.md carry identical payloads. If every tool you run
  reads AGENTS.md, emit only it: mind-ontology emit --target agents-md
  ```

  Deterministic (a function of the flag set alone), never on `--target`
  invocations, never affects artifact bytes or exit code — same contract as
  the budget warning. In JSON mode it appears as
  `{ "type": "dual-target-note" }` in `warnings`.
- **(c) One sentence added to the CLAUDE.md notice line** (flagged
  refinement of W1 §5 — the frame is W1 territory, so this is recorded here
  as a ratified amendment for W3's template): the CLAUDE.md blockquote
  notice gains *"If your tooling also loads `AGENTS.md`, the two files carry
  identical payloads — keep whichever your tools read and re-emit only that
  target."* The artifact itself thus carries the fix to wherever the
  double-load is actually experienced. (Using a `@AGENTS.md` import instead
  of a payload copy stays rejected per W1 §5: imports break the single-file
  content digest, and they would not help AGENTS.md-only readers anyway.)

Revisit trigger (logged for the operator, section 14): if the ecosystem
converges on AGENTS.md to the point that CLAUDE.md-only readers are
measurably extinct, flipping the default to `agents-md` is a one-line
registry change plus an emit_version bump — nothing in this contract blocks
it.

## 9. `review`

```text
mind-ontology review --pack <path> [--format text|json]
```

Validates a worker [Result Pack](mind-ontology-autopilot-result-pack-v1.md)
against the five invariants its shape guard enforces (required keys & types;
`forbidden_scope_touched` false; no hosted leakage; non-empty
`adls_completed` each naming a guard test; self-consistent stop state), via
the shared module W9 extracts from the existing guard test
(`tests/unit/autopilot-result-pack-shape.test.mjs` is rewired through the
same module — one set of rules, two consumers).

Per the operator's packet ruling (Part C, Q8): **v1 validates shape only and
*prints* the guard-test commands; it does not run them.** The text report,
in order:

1. one line per invariant: `PASS` / `FAIL` + the violation message;
2. the guard tests named in `adls_completed`, as ready-to-paste commands
   (`npx vitest run <file>`), so the controller re-runs proof instead of
   trusting prose;
3. the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md)
   items echoed with a verdict column: `machine` for what shape validation
   covered, `manual` for what remains the human's call (scope diff, lockfile,
   leakage sweep, honesty of the stop state against the
   [stop policy](mind-ontology-autopilot-stop-policy-v1.md)). `review` never
   pretends to have checked what it has not — that would invert the
   trust-minimizing point of the checklist.

Hard errors (stderr, exit `1`, no report): missing `--pack`, unreadable
path, file is not valid JSON. Shape violations are a *report* (stdout,
exit `1`). Exit `0` only when every invariant passes.

JSON shape (normative keys; detail fields locked by W9):

```json
{
  "ok": false,
  "schema": "sirt.result-pack/v1",
  "lane": "docs/example-lane",
  "violations": [ { "invariant": 2, "message": "forbidden_scope_touched is true" } ],
  "guard_tests": [ "tests/unit/autopilot-result-pack-shape.test.mjs" ],
  "checklist": [ { "item": 1, "title": "Write scope respected", "verdict": "manual" } ]
}
```

## 10. Error catalog additions

These rows are the normative wording source for the new commands' failure
modes. They merge into [cli-errors.md](cli-errors.md) **atomically with W3**
(the first ADL that makes any of these commands runnable), not now: that
catalog documents shipped behavior and is held in sync with the real engine
messages by `tests/unit/cli-error-ux.test.mjs` and
`tests/unit/cli-error-ux-catalog.test.mjs` — rows for commands a user cannot
yet run would document fiction and weaken the catalog's "this is what you
will actually see" guarantee. W3 extends the catalog test with one e2e case
per row below (the W2 guard, spec-level until then).

All rows follow the standing contract: problem named, next safe action
pointed to, no stack trace, correct stream per section 2.3.

### `emit` (write mode) — stderr, exit 1

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| Unknown target id | `--target must be one of "agents-md", "claude-md", got: <x>` | Use a registry id (W1 §2). |
| Existing un-managed file, no `--force` | `Refusing to overwrite <path>: file exists but has no emit header. Move its content into .agentctx/ sources, then re-run with --force to overwrite.` | Port content to sources; `emit --force --target <id>`. |
| `--full` with `--check` | `--full cannot be combined with --check (--check verifies against the profile recorded in the artifact header)` | Drop one flag. |
| `--force` with `--check` | `--force cannot be combined with --check (--check never writes)` | Drop one flag. |
| Compile errors | unchanged pass-through of the `agentctx:compile` rows | per the existing catalog |
| Unknown flag | `Unknown argument: <arg>` | Remove it (see `--help`). |

Warning (stderr, exit **0**, artifact still written — not an error row but
cataloged with them so operators find it):

| Warning | Message (stderr) |
|---|---|
| Budget overflow | `warning: <target> payload is <n> lines (soft budget <budget>); largest contributors: <file list>` |
| Dual-target note | section 8(b) text, only on a no-`--target` emit of both targets |

### `emit --check` — exit 1 = drift (stdout report), exit 2 = hard error (stderr)

Drift classes render the W1 §8 per-class guidance verbatim as the `detail`
sentence (`MISSING` → emit it; `UNMANAGED` → emit will not touch it without
`--force`; `HAND-EDITED` → hand edits will be lost on re-emit, diff hint;
`STALE` → re-run emit). Hard errors: unknown target id and flag-combo rows as
above but exit `2`; compile failure during recompile passes the underlying
message through, exit `2`.

### `preview` — stderr, exit 1

Identical rows to `agentctx:compile` (`Missing required --task argument`,
missing `.agentctx/`, bad `--risk`, unknown flag), plus `--format must be
"text" or "json", got: <x>`. No new failure modes by construction (section 5).

### `cq` — exit 1

| Failure | Stream | Message | Next safe action |
|---|---|---|---|
| Missing `cq.md` | stderr | `Missing .agentctx/cq.md. Add competency questions (see the cq schema) before running cq.` | Author `cq.md` per the [CQ schema](mind-ontology-cq-schema-v0.md). |
| `--id` out of range | stderr | `--id must be between 1 and <N>, got: <x>` | Use a listed id. |
| Unanswered CQ(s) | **stdout report** | per-CQ `UNANSWERED` lines + summary | Add/extend the source blocks the CQ's topic tags point at. |
| Broken ontology | stderr | compile pass-through | per the existing catalog |

### `status` — exit 1

| Failure | Stream | Message |
|---|---|---|
| Any section unhealthy | **stdout report** | the per-section report itself; summary line names the unhealthy sections |
| Broken ontology / missing `.agentctx/` | stderr | compile/validate pass-through, no partial report |

### `review` — exit 1

| Failure | Stream | Message | Next safe action |
|---|---|---|---|
| Missing `--pack` | stderr | `Missing required --pack argument` | Pass `--pack <path>`. |
| Unreadable path | stderr | `Cannot read Result Pack: <path>` | Check the path. |
| Not valid JSON | stderr | `Result Pack is not valid JSON: <path>` | Fix or regenerate the pack. |
| Shape violations | **stdout report** | per-invariant `FAIL` lines | Send back to the worker with the failed invariant. |

## 11. Command namespace — integration with the `agentctx` engine CLI

The Workbench adds verbs to the **existing** `mind-ontology` dispatcher
(`scripts/agentctx/cli.mjs`), exactly as the design packet's A4 table
prescribes: additive rows in its `COMMANDS` table, same thin-dispatcher
pattern, every existing command untouched (the W3 backward-compat test holds
all of them byte-for-byte).

**Collision audit.** Existing verbs: `compile`, `init`, `validate`,
`metrics`, `mcp`, `smoke`. New verbs: `status`, `preview`, `cq`, `emit`,
`review`. The sets are disjoint; no collision, no rename, no alias.

**Semantic adjacency** (documented so the help text can disambiguate, not
merged): `validate` stays the raw schema report and `metrics` the raw metrics
dump — `status` *embeds* both but replaces neither (scripts and CI that pipe
the raw outputs keep working). `compile` stays the byte-stable pack
serializer agents and tests depend on — `preview` is its human rendering and
is free to evolve its text format; anything machine-consumed goes through
`preview --format json` or `compile` itself.

**npm-script namespace: no new `agentctx:*` aliases.** The `agentctx:*`
scripts exist as the backward-compatibility surface for commands that
predate the wrapper ([CLI v0](mind-ontology-cli-v0.md): "the wrapper adds no
behavior of its own"). Workbench verbs are born inside the wrapper, so they
have no legacy invocation to preserve — `mind-ontology status` is their only
spelling. This also keeps `package.json` out of every Workbench ADL's diff
(the engine lanes touch `scripts/agentctx/` and the dispatcher table only),
and it stops the npm-script list from growing into a second, drifting copy of
the command map. Direct `node` invocation of the underlying scripts remains
possible for debugging, as with every engine module.

**Engine file placement.** New engine entry points live beside the existing
ones under `scripts/agentctx/` (W3 adds `emit.mjs` there); `preview`,
`status`, `cq`, `review` reuse existing modules plus the W5/W9 extractions
rather than adding parallel implementations.

**Help text.** `buildHelp()` gains the new rows, grouped under two headings —
**Engine** (compile, init, validate, metrics, mcp, smoke) and **Operator**
(status, preview, cq, emit, review) — an additive change; the
unknown-command message continues to list every valid verb. "Workbench"
remains an internal design name (operator ruling Q5) and appears nowhere in
help output.

**Reserved verb.** `serve` is reserved for the deferred local read-only web
view (packet Q1) and must not be claimed by anything else.

**MCP surface: untouched.** None of the new verbs, nor any data only they
expose (explain tuples, drift classes, CQ verdicts), is reachable through the
MCP server. The agent-facing surface stays exactly `get_context` +
`list_constraints` — the boundary invariant of the packet's A4.

## 12. v1 non-features

Per W1's handoff item 6, each rejected surface is recorded with its one-line
why, so future ADLs don't silently re-open them:

| Non-feature | Why not |
|---|---|
| Config / manifest file | the emitted headers *are* the manifest (W1 §8); a config file is a second source of truth that can drift |
| Per-repo artifact path overrides | paths are identity: tools find `AGENTS.md` / `CLAUDE.md` by convention, and an override would have to be stored — see previous row (operator confirmed, W1 Q3) |
| Profile editing | profiles are fixed engine constants so `--check` can always recompile them; user profiles would need storage and versioning (W1 §3) |
| Section-level emit | reintroduces intra-file hand-sync, the disease emit cures; whole-payload digest can't verify a partially-owned file (W1 §9; operator upheld, Q4) |
| Warn-only / `--strict` drift mode | drift **fails** CI, full stop (operator ruling W1 Q7); the only knob is *which* targets are managed (`--target`) |
| Budget hard-fail (`--strict`) | over-budget is verbose, not wrong; warn-only confirmed by operator (W1 Q2) |
| JSON error envelope | exit code + stderr line is the existing, sufficient machine contract; a second error surface would have to be kept in sync (§2.2) |
| Caller detection (TTY / agent flag / color) | one contract for humans and agents; detected output breaks golden tests and transcript reproducibility (§2.2) |
| Tool-detection for emit targets | machine state as an input breaks determinism and CI reproducibility (§8) |
| New `agentctx:*` npm aliases | the legacy namespace is frozen back-compat, not a growth surface (§11) |
| Public "Workbench" branding | internal design name only (operator ruling, packet Q5) |

## 13. Handoff to W3 — golden-file freeze list and guard tests

W3 (and the ADLs behind it) consume this document as ground truth. Proposed
freeze set — all goldens compiled from `templates/mind-ontology/` unless
noted, fixture layout under `tests/fixtures/` at W3's discretion:

**Golden artifacts (byte-frozen):**

1. `agents-md`, default profile — the canonical W1 §4 artifact, header
   included.
2. `claude-md`, default profile — locks the frame-only delta against №1.
3. `agents-md`, `--full` profile — locks the profile switch and the
   `profile: full` header field.
4. Minimal ontology (constraints-only `.agentctx/`) — both targets; locks the
   empty-section omission rule (W1 §4).
5. Safety-sweep ontology (a `#destructive`-tagged block in excluded
   `projects.md`) — locks principle-4 forcing, the true-source provenance
   comment, and the source-digest asymmetry (W1 §6).

**JSON shape locks (snapshot):**

6. `emit --format json` (write result, section 7.2 shape).
7. `emit --check --format json` (section 7.4 shape — also consumed verbatim
   by W7's `status`).

**Behavioral guards (built in temp dirs, not stored goldens):**

8. Double-emit byte equality (W1 §7 determinism).
9. `--check` classification matrix: fresh→`OK`/exit 0; source edit→`STALE`/1;
   payload edit→`HAND-EDITED`/1; header deleted→`UNMANAGED`/1; file
   deleted→`MISSING`/1; broken ontology→exit **2**; each with its section 10
   `detail` wording.
10. CRLF round-trip: artifact rewritten with CRLF still checks `OK` (W1 §9
    canonicalization).
11. Budget overflow: >400-payload-line fixture emits exit 0 + the stderr
    warning naming target and contributors.
12. Dual-target advisory: present on a no-`--target` emit of both targets,
    absent with any `--target` flag; never in artifact bytes.
13. Payload byte-equality between №1 and №2 (W1 principle 3 enforced as a
    test, not trusted from the goldens by eye).
14. `UNMANAGED` refusal is all-or-nothing across a multi-target emit
    (section 7.2).
15. Registry sync (the W1 guard): parse W1 §2's table, assert ids/paths match
    the engine's `EMIT_TARGETS` constant.
16. Backward compat: every pre-existing command's output byte-for-byte
    unchanged; help text additive; unknown-command message lists all verbs.
17. Error-catalog extension: every section 10 row driven e2e in
    `tests/unit/cli-error-ux-catalog.test.mjs`'s table style, and the rows
    merged into [cli-errors.md](cli-errors.md) in the same change.

Later ADLs inherit their shape locks from here the same way: W6 freezes the
`preview` text snapshot and explain-JSON, W7 the `status` JSON (its `emit`
section must be referentially the 7.4 shape), W8 the CQ verdict fixtures, W9
the `review` report against the example pack fixture
(`tests/fixtures/autopilot-result-pack.example.json`).

## 14. Open questions for the operator

Defaults are specified above and are safe to build against; flagged because
they are product calls:

1. **`emit --check` exit-code split** (§2.4): `0` fresh / `1` drift / `2`
   hard error, refining W1 §8's uniform `1`. Confirm the three-way split, or
   collapse to `0`/`1` (CI would then need `--format json` to distinguish
   "re-emit" from "broken").
2. **Double-load ruling** (§8): default emits both targets, no detection,
   mitigations (a)–(c). Confirm — in particular mitigation (c), the one-line
   amendment to W1 §5's CLAUDE.md notice, since it changes frozen-frame bytes
   and therefore belongs in W3's first golden, not a later emit_version bump.
3. **CQ gate severity** (§6): *any* unanswered CQ exits `1`, not just the
   schema's two required topics. Confirm merge-gate strength, or soften to
   required-CQs-only with advisory lines for the rest.
4. **`status` representative tasks = CQ titles** (§4): zero-config and
   deterministic, but it couples the metrics section to `cq.md` authoring.
   Confirm, or name an alternative task source for W7.

**Operator rulings (2026-06-10, recorded before W3 froze the first goldens):**

1. **Confirmed.** The three-way `emit --check` split (`0` fresh / `1` drift /
   `2` hard error) ships in W3 as specified in §2.4.
2. **Confirmed**, including mitigation (c): the CLAUDE.md notice sentence is
   part of W3's first golden frame, so it costs no `emit_version` bump.
3. **Softened** — see the ratified amendment in §6: v1 gates required CQs
   (`#context` / `#safety`) only; other unanswered CQs are advisory report
   lines. `--strict-cq` is a v2 consideration.
4. **Confirmed.** `status` representative tasks are the CQ question titles.
