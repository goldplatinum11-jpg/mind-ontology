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
| Bad `--format` | `--format must be "markdown" or "json", got: <x>` | Use `markdown` or `json`. |
| Bad `--risk` | `--risk must be "auto", "safe", or "risky", got: <x>` | Use `auto`, `safe`, or `risky`. |
| Unknown flag | `Unknown argument: <arg>` | Remove the unknown flag (see `--help`). |
| Unknown command | `Unknown command: <x>` | Use `compile`. |

## `agentctx:init`

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| `.agentctx/` already exists | `.agentctx/ already exists. Re-run with --force to overwrite template files.` | Pass `--force` (preserves your own non-template files). |
| Unknown template | `Template not found: <name>` | Use an existing template under `templates/` (default `mind-ontology`). |
| Unknown flag | `Unknown argument: <arg>` | Remove it (see `--help`). |

## `agentctx:metrics`

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| No `--task` | `Missing required --task argument` | Pass `--task "…"`. |
| No `.agentctx/` | same `Missing .agentctx/ …` as compile | Run `agentctx:init` first. |

## `agentctx:validate`

`validate` never throws on a clean tree; it prints a **report to stdout** and
exits non-zero only when there are errors. So unlike compile/init, the message
to act on is on **stdout**, prefixed by its severity and rule name, e.g.:

```
  ERROR  [missing-dir] Missing .agentctx/ in <cwd>. Run "npm run agentctx:init" to scaffold starter files.
  ERROR  [empty-required] Required source is empty: .agentctx/constraints.md
INVALID — 1 error(s), 0 warning(s)
```

| Failure | Issue line (stdout) | Next safe action |
|---|---|---|
| No `.agentctx/` | `[missing-dir] Missing .agentctx/ …` | Run `agentctx:init`. |
| Empty required source | `[empty-required] Required source is empty: .agentctx/<file>` | Add content to the named file. |
| Schema violations | `[required-tag] / [enum-field] / [no-credentials] / …` naming the file, block, and rule | Fix the named block; see [schema validation](mind-ontology-schema-validation-v0.md). |

The `INVALID — N error(s)` summary plus a non-zero exit is the machine signal.
See [schema validation](mind-ontology-schema-validation-v0.md) for the full rule
list.

## `mind-ontology emit` (write mode)

Exit `1` on every failure. A multi-target emit is **all-or-nothing**: when it
refuses, nothing is written for *any* target, so a half-written pair can never
exist. Specs: [W1 emit targets](workbench-w1-emit-target-spec.md),
[W2 CLI surface](workbench-w2-cli-spec.md).

| Failure | Message (stderr) | Next safe action |
|---|---|---|
| Unknown target id | `--target must be one of "agents-md", "claude-md", got: <x>` | Use a registry id (`agents-md`, `claude-md`). |
| Existing un-managed file, no `--force` | `Refusing to overwrite <path>: file exists but has no emit header. Move its content into .agentctx/ sources, then re-run with --force to overwrite.` | Port the content into `.agentctx/`, then `mind-ontology emit --force --target <id>`. |
| `--full` with `--check` | `--full cannot be combined with --check (--check verifies against the profile recorded in the artifact header)` | Drop one flag. |
| `--force` with `--check` | `--force cannot be combined with --check (--check never writes)` | Drop one flag. |
| Bad `--format` | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Compile errors | unchanged pass-through of the `agentctx:compile` rows above | per the compile section |
| Unknown flag | `Unknown argument: <arg>` | Remove it (see `--help`). |

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
| Unknown flag | stderr | `Unknown argument: <arg>` | Remove it (see `--help`). |

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
| Unknown flag | `Unknown argument: <arg>` | Remove it (see `--help`). |

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
| `--id` out of range | stderr | `--id must be between 1 and <N>, got: <x>` | Use a listed id. |
| Unanswered required CQ(s) | **stdout report** | per-CQ `UNANSWERED … (required)` lines + `FAIL` summary | Add/extend the source blocks the CQ's topic tags point at. |
| Bad `--format` | stderr | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Broken ontology | stderr | compile pass-through (the `agentctx:compile` rows above) | per the compile section |
| Unknown flag | stderr | `Unknown argument: <arg>` | Remove it (see `--help`). |

## `mind-ontology review`

`review` is a **report command**: shape violations are a report on **stdout**
(per-invariant `FAIL` lines), exit `1`. Hard errors go to stderr with no
report. `review` takes no `--cwd` — its one input is the explicit `--pack`
path ([W2 §2.1](workbench-w2-cli-spec.md)).

| Failure | Stream | Message | Next safe action |
|---|---|---|---|
| Missing `--pack` | stderr | `Missing required --pack argument` | Pass `--pack <path>`. |
| Unreadable path | stderr | `Cannot read Result Pack: <path>` | Check the path. |
| Not valid JSON | stderr | `Result Pack is not valid JSON: <path>` | Fix or regenerate the pack. |
| Shape violations | **stdout report** | per-invariant `FAIL` lines + `INVALID` summary | Send back to the worker with the failed invariant. |
| Bad `--format` | stderr | `--format must be "text" or "json", got: <x>` | Use `text` or `json`. |
| Unknown flag | stderr | `Unknown argument: <arg>` | Remove it (see `--help`). |

## `mind-ontology setup`

`setup` wires an agent client (MCP config + startup bootstrap instruction,
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
| Unknown flag | `Unknown argument: <arg>` | Remove it (see `--help`). |

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

These messages already **name the problem** and the CLI fails closed correctly,
but they do **not yet point to a next action**. They are usable today; improving
them is a future *engine* change (out of scope for a docs/tests lane), tracked
here so the gap is visible rather than silently accepted:

- **`Unknown argument: <arg>`** (compile & init) — names the offending flag but
  does not point to `--help`. Candidate: append `(see --help)`.
- **`Template not found: <name>`** (init) — names the bad template but does not
  list the available ones. Candidate: append `Available: <list>`.
- **`validate` issue lines** — name the file, block, and rule but carry no inline
  fix hint or doc link. Candidate: attach a one-line remedy per rule.

Until then, fall back to `--help` (for the flag/template cases) or the
[schema validation](mind-ontology-schema-validation-v0.md) doc (for validate
rules).

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
- [`tests/unit/setup-command.test.mjs`](../tests/unit/setup-command.test.mjs) —
  locks the `setup` write/print contract end-to-end, including the exit-`0`
  warning paths above (which the catalog's non-zero-exit shape cannot carry).
