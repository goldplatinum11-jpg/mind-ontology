# CLI Error Reference

Every Mind Ontology CLI fails **closed and loud**: it exits non-zero, writes a
single actionable message to **stderr**, and never silently produces a wrong
result. This page catalogs each failure mode and the fix.

## How to read an error (operators & agent workers)

You don't need to read the code to recover. Every failure follows the same
shape, so the recovery loop is always the same:

1. **Check the exit code.** Non-zero (`1`) means the command did nothing useful —
   do **not** treat whatever printed as a result. Zero means success.
2. **Read the one line on stderr.** It names *what* is wrong (a missing flag, a
   bad value, an absent file).
3. **Do the next safe action it points to** — pass the named flag, run
   `agentctx:init`, re-run with `--force`, or use one of the allowed values.
   When in doubt, run the command with `--help`.
4. **Never parse stdout on failure.** On a user error stdout is empty; the
   message is on stderr. (`validate` is the one exception — it prints a *report*
   to stdout and still exits non-zero when there are errors.)

Agent workers can rely on the same contract: a non-zero exit + a stderr line is
a structured, stable signal — branch on the exit code, surface the stderr line
to the operator, and apply the named fix. Do not retry verbatim.

> Exit codes: CLIs exit `1` on error, `0` on success. The MCP server instead
> returns JSON-RPC error objects (it is a long-lived server, not a one-shot CLI).
> One deliberate exception: `mind-ontology emit --check` is three-way — `0`
> fresh, `1` drift, `2` hard error — so CI can branch without parsing JSON
> (see its section below).

---

## `agentctx:compile`

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| No `--task` | `Missing required --task argument` | Pass `--task "…"`. |
| No `.agentctx/` in cwd | `Missing .agentctx/ in <cwd>. Run "npm run agentctx:init …" to scaffold starter files.` | Run `agentctx:init`, or pass `--cwd` to the right folder. |
| Missing `constraints.md` | `Missing required Mind Ontology source: .agentctx/constraints.md. Run "npm run agentctx:init …" or add the file manually.` | Add `constraints.md` (it is always required). |
| Empty `constraints.md` | `Required Mind Ontology source is empty: .agentctx/constraints.md. Add at least one ## constraint block before compiling.` | Add at least one `## …` constraint block. |
| Bad `--format` | `--format must be "markdown", "json", or "compact", got: <x>` | Use `markdown`, `json`, or `compact`. |
| Bad `--risk` | `--risk must be "auto", "safe", or "risky", got: <x>` | Use `auto`, `safe`, or `risky`. |
| Bad `--max-tokens` | `--max-tokens must be a positive integer, got: <x>` | Pass a positive integer, e.g. `--max-tokens 400`. |
| Unknown flag | `Unknown argument: <arg>. Run "mind-ontology compile --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |
| Unknown command | `Unknown command: <x>` | Use `compile`. |

## `agentctx:init`

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| `.agentctx/` already exists | `.agentctx/ already exists. Re-run with --force to overwrite template files.` | Pass `--force` (preserves your own non-template files). |
| Unknown template | `Template not found: <name>. Available templates: <list>. Pass one with --template <name>.` | Use one of the listed templates (default `mind-ontology`). |
| Unknown flag | `Unknown argument: <arg>. Run "mind-ontology init --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

## `agentctx:metrics`

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| No `--task` | `Missing required --task argument` | Pass `--task "…"`. |
| No `.agentctx/` | same `Missing .agentctx/ …` as compile | Run `agentctx:init` first. |

## `agentctx:validate`

`validate` never throws on a clean tree; it prints a **report to stdout** and
exits non-zero only when there are errors. So unlike compile/init, the message
to act on is on **stdout**, prefixed by its severity and rule name. Every issue
line carries an indented `fix:` continuation line naming the concrete next
action, and a failing report ends with a pointer to the authoring doc, e.g.:

```text
  ERROR  [missing-dir] Missing .agentctx/ in <cwd>
         fix: Run "npm run agentctx:init" to scaffold starter files.
  ERROR  [required-tag] identity.md is missing a block tagged #style
         fix: Add a block headed "## <title> #style" to identity.md.
INVALID — 2 error(s), 0 warning(s)
See docs/schema-authoring.md for the block format and per-file rules.
```

| Failure | Issue line (stdout) | Next safe action (the `fix:` line) |
|---|---|---|
| No `.agentctx/` | `[missing-dir] Missing .agentctx/ in <cwd>` | `Run "npm run agentctx:init" to scaffold starter files.` |
| Missing required source | `[required-file] Missing required source: .agentctx/<file>` | `Run "npm run agentctx:init" to scaffold it, or create the file …` |
| Empty required source | `[empty-required] Required source is empty: .agentctx/<file>` | `Add at least one "## <title> #<tag>" block to <file>.` |
| Schema violations | `[required-tag] / [enum-field] / [no-credentials] / …` naming the file, block, and rule | per-rule remedy from `RULE_REMEDIES`, parameterized with the offending tag / field / allowed values |

The `INVALID — N error(s)` summary plus a non-zero exit is the machine signal;
warnings also carry `fix:` lines but never flip the exit code. Programmatic
consumers get the same hint as a `remedy` field on each issue. See
[schema validation](mind-ontology-schema-validation-v0.md) for the full rule
list and [schema authoring](schema-authoring.md) for the block format the
remedies point at.

## `mind-ontology emit` (write mode)

Exit `1` on every failure. A multi-target emit is **all-or-nothing**: when it
refuses, nothing is written for *any* target, so a half-written pair can never
exist. Specs: [W1 emit targets](workbench-w1-emit-target-spec.md),
[W2 CLI surface](workbench-w2-cli-spec.md).

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| Unknown target id | `--target must be one of "agents-md", "claude-md", "cursor", got: <x>` | Use a supported registry id (`agents-md`, `claude-md`, `cursor`; `cursor` is supported-but-not-default). |
| Existing un-managed file, no `--force` | `Refusing to overwrite <path>: file exists but has no emit header. Move its content into .agentctx/ sources, then re-run with --force to overwrite.` | Port the content into `.agentctx/`, then `mind-ontology emit --force --target <id>`. |
| `--full` with `--check` | `--full cannot be combined with --check (--check verifies against the profile recorded in the artifact header)` | Drop one flag. |
| `--force` with `--check` | `--force cannot be combined with --check (--check never writes)` | Drop one flag. |
| `--explain` without `--check` | `--explain is only valid together with --check (it never writes)` | Add `--check`, or drop `--explain`. Exit `2`. |
| `--reconcile` with `--check` | `--reconcile cannot be combined with --check (--check never writes; --reconcile is the write side)` | Drop one flag. Exit `2`. |
| `--full` with `--reconcile` | `--full cannot be combined with --reconcile (--reconcile re-emits each target against the profile recorded in its header)` | Drop one flag. Exit `2`. |
| Bad `--format` | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Compile errors | unchanged pass-through of the `agentctx:compile` rows above | per the compile section |
| Unknown flag | `Unknown argument: <arg>. Run "mind-ontology emit --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

Warnings (stderr, exit `0`, artifacts still written — cataloged here so
operators find them; they never change artifact bytes):

| Warning | Message (stderr) |
|---|---|
| Budget overflow | `warning: <target> payload is <n> lines (soft budget 400); largest contributors: <file list>` |
| Dual-target note | `note: AGENTS.md and CLAUDE.md carry identical payloads. If every tool you run reads AGENTS.md, emit only it: mind-ontology emit --target agents-md` — printed only on a no-`--target` emit |

## `mind-ontology emit --check`

The one three-way exit code in the CLI family (W2 §2.4 ruling): `0` every
checked target fresh; `1` drift — the report is on **stdout**, one line per
target plus a summary, and the next safe action is mechanical (re-emit); `2`
hard error on **stderr** (usage errors and compile failures), where the next
safe action needs a human. `1` therefore means exactly "re-emit needed".

| Class (stdout report line) | Detail sentence | Next safe action |
|---|---|---|
| `MISSING` | `artifact has never been emitted (or was deleted); run: mind-ontology emit --target <id>` | Emit it. |
| `UNMANAGED` | `file exists but is not managed by emit; emit will not touch it without --force. Move hand-written content into .agentctx/ sources, then run: mind-ontology emit --force --target <id>` | Port content to sources, then `--force`. |
| `HAND-EDITED` | `file was edited after generation; hand edits will be lost on re-emit. Port the edits into .agentctx/ sources, then re-emit. Diff hint: git diff <path>` | Port the edits, re-emit. |
| `STALE` | `.agentctx/ changed (or emit_version bumped) since last emit; run: mind-ontology emit --target <id>` | Re-run `mind-ontology emit`. |

Hard errors (stderr, exit `2`): the unknown-target and flag-combo rows from
the write-mode table, plus compile failures passing through unchanged. On a
hard error stdout stays empty — no partial verdict (fail closed, W1 §8).

## `mind-ontology emit --reconcile`

SAFE drift repair. Reconcile writes generated artifacts (`AGENTS.md` /
`CLAUDE.md`) **only** — never `.agentctx/` sources — and only for the classes
where nothing is lost. It is **all-or-nothing**: if ANY requested target is in a
refuse class, nothing is written for *any* target (classify first, write second).

| Class | Reconcile action | Why |
|---|---|---|
| `OK` | skip (writes nothing) | already fresh |
| `MISSING` | emit it (default profile) | nothing on disk to lose |
| `STALE` | re-emit against the **profile recorded in the header** | so a `full` artifact stays `full` — reconcile never silently degrades it to `default` |
| `UNMANAGED` | **refuse** | a headerless file is not emit's to claim; needs `--force` |
| `HAND-EDITED` | **refuse** | a re-emit would discard the hand edit |

Exit codes: `0` reconciled or already clean; `1` refused (a real verdict — at
least one target needs a human; report on **stderr**, nothing written); `2` hard
error (usage / flag-combo / compile failure). Refusal messages (stderr):

| Refusal | Message (stderr) | Next safe action |
|---|---|---|
| `UNMANAGED` target | `<path> (<id>) is UNMANAGED (a headerless file emit will not claim); reconcile will not overwrite it. Move its content into .agentctx/ sources, then run: mind-ontology emit --force --target <id>` | Port content to sources, then `--force`. |
| `HAND-EDITED` target | `<path> (<id>) is HAND-EDITED; a re-emit would discard the hand edit. Move the edit into the .agentctx/ source, then run: mind-ontology emit --target <id>` | Port the edit, then re-emit. |
| Unreproducible `STALE` target | `<path> (<id>) records a target/profile that is no longer reproducible; reconcile will not guess a profile. Re-emit it explicitly with a known profile.` | Re-emit with a known profile. |

Each refusal is prefixed by a `Refusing to reconcile: <n> target(s) need a
human (nothing written for any target).` summary line.

## `mind-ontology emit --reconcile-source [--apply]`

The **source-ward** direction (the opposite of `--reconcile`): instead of
re-emitting the artifact from `.agentctx/`, it folds a `HAND-EDITED` artifact's
block-body edits BACK into the `.agentctx/` source blocks they came from (via
block-manifest provenance). `--reconcile-source` alone is a read-only PREVIEW
(writes nothing); adding `--apply` writes the patches — and it is the **only**
mode that writes `.agentctx/` (it never re-emits artifacts; run `mind-ontology
emit` afterwards). All-or-nothing; ambiguity always refuses. Exit `0`
preview/applied, `1` refused, `2` usage error.

Usage errors (stderr, exit `2`):

| Combination | Message (stderr) | Next safe action |
|---|---|---|
| `--reconcile-source` with `--check`/`--reconcile`/`--explain`/`--force`/`--full`/`--block-manifest` | `--reconcile-source cannot be combined with --check/--reconcile/--explain/--force/--full/--block-manifest (it is a read-only preview mode of its own)` | Run `--reconcile-source` on its own (optionally with `--apply`). |
| `--apply` without `--reconcile-source` | `--apply is only valid with --reconcile-source` | Add `--reconcile-source`, or drop `--apply`. |

Refusals (stderr, exit `1`, nothing written). Preview refusals are prefixed by
`Refusing to preview source reconcile: <n> target(s) need a human (nothing
written; .agentctx/ untouched).`; `--apply` refusals by `Refusing to apply
source reconcile: <n> …` (same suffix), plus the apply-only gates below:

| Refusal | Message (stderr) | Next safe action |
|---|---|---|
| Target is `OK` | `<path> (<id>) is OK (fresh); nothing to reconcile to source.` | Nothing to do. |
| Target is `MISSING` | `<path> (<id>) is MISSING; there is no artifact to attribute to source. Run: mind-ontology emit --target <id>` | Emit it first. |
| Target is `UNMANAGED` | `<path> (<id>) is UNMANAGED (headerless); its content cannot be attributed to .agentctx/ blocks.` | Adopt it with `emit --force`, or hand-port. |
| Target is `STALE`, not hand-edited | `<path> (<id>) is STALE, not hand-edited; repair the artifact instead: mind-ontology emit --reconcile --target <id>` | Use artifact-ward `--reconcile`. |
| Recorded profile unreproducible | `<path> (<id>) records a target/profile that is no longer reproducible; it cannot be rebuilt to attribute the edit. Re-emit it explicitly with a known profile.` | Re-emit with a known profile. |
| Sources drifted since emit | `<path> (<id>): .agentctx/ sources changed (or emit_version bumped) since this artifact was generated, so the hand-edit cannot be separated from source drift. …` | Resolve the drift (`--reconcile`/re-emit), re-apply the hand-edit, retry. |
| Edit not isolated to one block body (heading/section/footer/structure or a forged provenance heading) | e.g. `<path> (<id>): could not align the edited artifact to its generated structure; a provenance heading, section heading, notice, or footer changed (only block bodies reconcile to source)` | Move the structural edit into `.agentctx/` by hand, or re-emit. |

`--apply`-only gates (stderr, exit `1`, nothing written), prefixed `Refusing to apply:`:

| Gate | Message (stderr) | Next safe action |
|---|---|---|
| Source not git-tracked / not clean / not a repo | `… .agentctx/ source(s) have uncommitted or untracked changes: …` / `… the project is not a git repository …` (recovery is via git) | Commit/track the affected `.agentctx/` files first. |
| Source path is a symlink / non-regular / multi-hardlink | `.agentctx/<file> is a symlink or special file; refusing to write through it` | Replace the link with a real file. |
| Patches would not reproduce the artifact | `<path> (<id>): applying these edits would not reproduce the hand-edited artifact (the edit is not an exact, body-only reconcile — a heading or structure likely moved). Reconcile by hand.` | Reconcile by hand. |

## `mind-ontology status`

`status` is a **report command** ([W2 §2.3](workbench-w2-cli-spec.md)): an
unhealthy section is a successful report of a bad state — the report stays on
**stdout** and the exit code is `1`. Only a hard error (a broken ontology that
prevents producing any verdict) goes to stderr, with no partial report.

| Failure | Stream | Message | Next safe action |
|---|---|---|---|
| Any section unhealthy | **stdout report** | the per-section report; the summary line names the unhealthy sections (`UNHEALTHY - sections needing attention: …`) | Fix the named sections (re-emit for drift, answer the named CQs, fix schema errors). |
| Broken ontology / missing `.agentctx/` | stderr | compile/validate pass-through (the `agentctx:compile` rows above) | per the compile section |
| Bad `--format` | stderr | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Unknown flag | stderr | `Unknown argument: <arg>. Run "mind-ontology status --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

## `mind-ontology preview`

`preview` is `compile` plus per-block provenance ([W2 §5](workbench-w2-cli-spec.md)):
the `--task` / `--scope` / `--risk` / `--cwd` rows are identical to the
`agentctx:compile` section above, by construction. The one new row is the
Workbench `--format` vocabulary (`text|json`, not compile's `markdown|json`).

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| No `--task` | `Missing required --task argument` | Pass `--task "…"`. |
| Bad `--format` | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Bad `--risk` | `--risk must be "auto", "safe", or "risky", got: <x>` | Use `auto`, `safe`, or `risky`. |
| Broken ontology | unchanged pass-through of the `agentctx:compile` rows above | per the compile section |
| Unknown flag | `Unknown argument: <arg>. Run "mind-ontology preview --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

## `mind-ontology cq`

`cq` is a **report command**: unanswered CQs are a report on **stdout**; the
exit code applies the required-only gate ([W2 §6 ratified amendment](workbench-w2-cli-spec.md)) —
an unanswered `#context` / `#safety` CQ exits `1`, other unanswered CQs are
advisory lines. Hard errors go to stderr with no report. Missing `cq.md` is
deliberately a hard error here (the operator explicitly asked for a CQ
report), while `status` skips the section instead.

| Failure | Stream | Message | Next safe action |
|---|---|---|---|
| Missing `cq.md` | stderr | `Missing .agentctx/cq.md. Add competency questions (see the cq schema) before running cq.` | Author `cq.md` per the [CQ schema](mind-ontology-cq-schema-v0.md). |
| `--id` out of range | stderr | `--id must be between 1 and <N>, got: <x>. Run "mind-ontology cq --cwd <path>" without --id to list the questions and their ids.` | Run `cq` without `--id` to list the questions and their ids, then pass a listed id. |
| Unanswered required CQ(s) | **stdout report** | per-CQ `UNANSWERED … (required)` lines + `FAIL` summary | Add/extend the source blocks the CQ's topic tags point at. |
| Bad `--format` | stderr | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Broken ontology | stderr | compile pass-through (the `agentctx:compile` rows above) | per the compile section |
| Unknown flag | stderr | `Unknown argument: <arg>. Run "mind-ontology cq --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

## `mind-ontology review`

`review` is a **report command**: shape violations are a report on **stdout**
(per-invariant `FAIL` lines), exit `1`. Hard errors go to stderr with no
report. `review` takes no `--cwd` — its one input is the explicit `--pack`
path ([W2 §2.1](workbench-w2-cli-spec.md)).

| Failure | Stream | Message | Next safe action |
|---|---|---|---|
| Missing `--pack` | stderr | `Missing required --pack argument` | Pass `--pack <path>`. |
| Unreadable path | stderr | `Cannot read Result Pack: <path>. Check the path exists and is readable, then re-run with --pack <path>.` | Check the path exists and is readable, then re-run with `--pack <path>`. |
| Not valid JSON | stderr | `Result Pack is not valid JSON: <path>` | Fix or regenerate the pack. |
| Shape violations | **stdout report** | per-invariant `FAIL` lines + `INVALID` summary | Send back to the worker with the failed invariant. |
| Bad `--format` | stderr | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Unknown flag | stderr | `Unknown argument: <arg>. Run "mind-ontology review --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

## `mind-ontology agent-setup`

`agent-setup` wires an agent client (MCP config + startup bootstrap instruction,
[agent-setup.md](agent-setup.md)). Exit `1` on every failure, nothing written
on failure. Write mode is **create-only**: an existing config file is never
overwritten or merged — `--print` gives the block to merge by hand. `--print`
itself never touches the filesystem.

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| No `--target` | `Missing required --target argument (allowed: "claude-code", "codex")` | Pass `--target claude-code` or `--target codex`. |
| Unknown target | `--target must be one of "claude-code", "codex", got: <x>` | Use a listed target id. |
| Existing config in write mode | `Refusing to overwrite <path>: file already exists. Re-run with --print and merge the agentctx server block by hand.` | Re-run with `--print`, merge the block by hand. |
| Bad `--format` | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Unknown flag | `Unknown argument: <arg>. Run "mind-ontology agent-setup --help" for the list of options.` | Remove the flag; `--help` lists the valid options. |

Warnings (stderr, exit `0` — the plan is still printed/written; cataloged here
so operators find them):

| Warning | Message (stderr) |
|---|---|
| Server script not found | `warning: MCP server script not found under the project (looked for scripts/agentctx/mcp-server.mjs, node_modules/mind-ontology/scripts/agentctx/mcp-server.mjs); the config assumes "npm install mind-ontology" will provide it` |
| Missing `.agentctx/` | `warning: .agentctx/ not found in the project; the MCP server fails closed (no invented context) until you scaffold sources with: mind-ontology init` |

Missing `.agentctx/` is deliberately a *warning* here, not an error: wiring the
client first and scaffolding sources second is a valid adoption order, and the
MCP server itself fails closed (it never invents context) until the sources
exist.

## `agentctx:mcp` (JSON-RPC error codes)

| Failure | Code | Meaning |
|---|---|---|
| Malformed JSON line | `-32700` | Parse error. |
| Unknown method / tool | `-32601` | Method or tool not found. |
| Missing `task` / bad `format` | `-32602` | Invalid parameters. |
| Unexpected internal error | `-32603` | Internal error (returned, not crashed). |

See [`agentctx-mcp.md`](agentctx-mcp.md) for the full transport contract.

---

## Candidate repair lanes (message quality, not bugs)

No open candidate repair lanes: every failure message above both names the
problem and points to a next safe action. New gaps are recorded here (with the
message and the missing action) before they are fixed, so the backlog stays
visible rather than silently accepted.

(Closed lanes: `review` unreadable `--pack` path now names the path **and** the
next action — `Check the path exists and is readable, then re-run with --pack
<path>.` — and `cq` out-of-range `--id` now names the valid range **and** how to
discover the ids — `Run "mind-ontology cq --cwd <path>" without --id to list the
questions and their ids.` — both locked in the error-UX catalog test (their
`nextAction` rows) and their focused command tests.
`validate` issue lines now carry an inline `fix:` remedy per
rule (parameterized with the offending tag / field / allowed values) and the
failing report links `docs/schema-authoring.md` — locked in the error-UX
catalog test and the schema-messages remedy-coverage test.
`Unknown argument: <arg>` now points at the command's own
`--help` across every command — `Run "mind-ontology <command> --help" for the
list of options.` — locked per command in the error-UX catalog test.
`Template not found: <name>` (init) now lists the available templates and the
`--template <name>` flag to pass one — locked in the error-UX catalog test
and unit-tested down to the empty-templates edge case.)

---

These messages are stable and covered by two test files, so a change to any of
them is a deliberate, reviewed UX change — not an accident:

- [`tests/unit/cli-error-ux.test.mjs`](../tests/unit/cli-error-ux.test.mjs) —
  unit-tests the pure parse/validate functions and keeps this doc in sync with
  the real messages.
- [`tests/unit/cli-error-ux-catalog.test.mjs`](../tests/unit/cli-error-ux-catalog.test.mjs)
  — drives the product-facing `mind-ontology <command>` wrapper end-to-end for
  every failure mode above and asserts the stable properties (non-zero exit,
  problem named, next action where one exists, no stack trace, clean success
  stream) rather than brittle full-stderr snapshots.
- [`tests/unit/emit-check.test.mjs`](../tests/unit/emit-check.test.mjs) —
  locks the `emit --check` classification matrix (every drift class, its
  detail sentence, and the three-way exit code) end-to-end.
- [`tests/unit/agent-setup-command.test.mjs`](../tests/unit/agent-setup-command.test.mjs) —
  locks the `agent-setup` write/print contract end-to-end, including the exit-`0`
  warning paths above (which the catalog's non-zero-exit shape cannot carry).
