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
