# `mind-ontology` CLI (v0)

A single product-facing command that fronts the engine. It is a **thin
dispatcher**: each subcommand routes to the same `scripts/agentctx/*` entry
point the matching `agentctx:*` npm script already runs, forwarding your
options verbatim and propagating the exit code. The wrapper adds **no behavior
of its own** — it exists so the package has one discoverable entry point.

> **Local only — unpublished.** The package is publish-ready but unpublished;
> publishing is an explicit operator decision. The `bin` simply makes the
> command available after a local `npm install`/`npm link`; it does not change
> the publish posture (see [packaging](packaging.md)).

## Commands

| Command | Wraps (`npm run …`) | Underlying script | What it does |
|---|---|---|---|
| `compile`  | `agentctx:compile`  | `compile.mjs`          | Compile a task-scoped context pack from `.agentctx/`. |
| `init`     | `agentctx:init`     | `init.mjs`             | Scaffold a starter `.agentctx/` template. |
| `validate` | `agentctx:validate` | `schema.mjs`           | Validate sources against the ontology schema. |
| `metrics`  | `agentctx:metrics`  | `metrics.mjs`          | Report context-quality metrics for a pack. |
| `mcp`      | `agentctx:mcp`      | `mcp-server.mjs`       | Run the MCP server (stdio JSON-RPC). |
| `smoke`    | `agentctx:smoke`    | `acceptance-smoke.mjs` | Run the acceptance smoke checks. |

`--help` / `-h` (or no arguments) prints usage; `--version` / `-v` prints the
package version.

## Usage

Once installed locally (`npm install`, then `npm link` or `npx`):

```sh
mind-ontology --help
mind-ontology init
mind-ontology compile --task "Plan the next PR" --scope mcp
mind-ontology validate
mind-ontology metrics --task "Plan the next PR"
mind-ontology mcp
```

Without linking, the same wrapper is reachable through the package script:

```sh
npm run mind-ontology -- compile --task "Plan the next PR" --scope mcp
```

Each command forwards its own flags. For a command's options, append `--help`:

```sh
mind-ontology compile --help
```

## Guided adoption: `adopt`

Beyond the engine commands above, the wrapper is also the only spelling for the
**operator commands** — units born inside the CLI with no `agentctx:*` npm alias
(`emit`, `agent-setup`, `status`, `adopt`, and others; run `mind-ontology --help`
for the grouped list). The headline operator command for a new project is
`adopt`: the one guided, **local-first, read-only-by-default** entry point that
wires a project for Mind Ontology across every supported client at once, instead
of remembering `init` → `emit` → `agent-setup` per client.

```sh
mind-ontology adopt [--cwd <path>] [--targets all|claude-code,codex,cursor,paste-block] [--write] [--format text|json]
```

| Flag | Default | Meaning |
|---|---|---|
| `--cwd <path>` | process cwd | Project root to adopt. |
| `--targets <list>` | `all` | `all`, or a comma list of client ids (`claude-code`, `codex`, `cursor`, `paste-block`), in the order you type them. |
| `--write` | absent | Required to create any file. Without it, `adopt` is a read-only plan. |
| `--format text\|json` | `text` | Output format; `json` prints the locked machine shape. |

Behavior, in one breath:

- **Plan by default.** A bare `mind-ontology adopt` writes nothing — it inspects
  the project and prints the plan it *would* apply. `--write` is the single gate
  to any filesystem change.
- **All four clients.** `--targets all` expands to `claude-code`, `codex`,
  `cursor`, `paste-block`. `claude-code` / `codex` get a generated instruction
  file *and* an MCP config; `cursor` / `paste-block` are emit-only.
- **Never clobbers.** An existing config or an unmanaged / hand-edited artifact is
  never overwritten or merged — the conflict downgrades to a `manual_required`
  step and every *other* safe action still applies. A conflict is **not** a
  hard error: the run completes and the exit code stays `0`.
- **No UI automation.** The `paste-block` step is always a manual paste into the
  ChatGPT / Claude.ai project-instructions box; `adopt` drives no browser.
- **Names its own verify commands.** Every plan/result ends with
  `mind-ontology validate`, `mind-ontology status`, and
  `mind-ontology emit --check --target <selected emit targets>`.

The interface, per-target mapping, write policy, and JSON shape are locked in the
[adopt spec](mind-ontology-adopt-spec-v1.md); the failure / `manual_required`
vocabulary is in the [CLI error catalog](cli-errors.md).

## Backward compatibility

Every original command is preserved. The wrapper is additive — these continue
to work exactly as before:

```sh
npm run agentctx:init
npm run agentctx:compile -- --task "Fix the OAuth flow" --scope auth
npm run agentctx:validate
npm run agentctx:metrics  -- --task "Fix the OAuth flow"
npm run agentctx:smoke
npm run agentctx:proof
```

`mind-ontology compile …` and `npm run agentctx:compile -- …` invoke the same
script and produce the same output.

## Error behavior

The wrapper fails closed and routes errors to stderr with a non-zero exit:

- an **unknown command** exits `1`, prints `Unknown command: <name>` to stderr,
  and lists the valid commands;
- a command's **own errors** (e.g. `compile` with no `--task`) pass through
  unchanged from the underlying script, with the same message and exit code.

See the [CLI error catalog](cli-errors.md) for the per-command failure modes.
