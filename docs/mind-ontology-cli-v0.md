# `mind-ontology` CLI (v0)

A single product-facing command that fronts the engine. It is a **thin
dispatcher**: each subcommand routes to the same `scripts/agentctx/*` entry
point the matching `agentctx:*` npm script already runs, forwarding your
options verbatim and propagating the exit code. The wrapper adds **no behavior
of its own** — it exists so the package has one discoverable entry point.

> **Local / private only.** `package.json` stays `"private": true`, so nothing
> is published. The `bin` simply makes the command available after a local
> `npm install`/`npm link`; it does not change the publish posture (see
> [packaging](packaging.md)).

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
