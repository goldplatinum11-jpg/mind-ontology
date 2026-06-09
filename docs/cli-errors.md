# CLI Error Reference

Every Mind Ontology CLI fails **closed and loud**: it exits non-zero, writes a
single actionable message to **stderr**, and never silently produces a wrong
result. This page catalogs each failure mode and the fix.

> Exit codes: CLIs exit `1` on error, `0` on success. The MCP server instead
> returns JSON-RPC error objects (it is a long-lived server, not a one-shot CLI).

---

## `agentctx:compile`

| Failure | Message (stderr) | Fix |
|---|---|---|
| No `--task` | `Missing required --task argument` | Pass `--task "…"`. |
| No `.agentctx/` in cwd | `Missing .agentctx/ in <cwd>. Run "npm run agentctx:init …" to scaffold starter files.` | Run `agentctx:init`, or pass `--cwd` to the right folder. |
| Missing `constraints.md` | `Missing required Mind Ontology source: .agentctx/constraints.md. Run "npm run agentctx:init …" or add the file manually.` | Add `constraints.md` (it is always required). |
| Bad `--format` | `--format must be "markdown" or "json", got: <x>` | Use `markdown` or `json`. |
| Bad `--risk` | `--risk must be "auto", "safe", or "risky", got: <x>` | Use `auto`, `safe`, or `risky`. |
| Unknown flag | `Unknown argument: <arg>` | Remove the unknown flag (see `--help`). |
| Unknown command | `Unknown command: <x>` | Use `compile`. |

## `agentctx:init`

| Failure | Message (stderr) | Fix |
|---|---|---|
| `.agentctx/` already exists | `.agentctx/ already exists. Re-run with --force to overwrite template files.` | Pass `--force` (preserves your own non-template files). |
| Unknown template | `Template not found: <name>` | Use an existing template under `templates/` (default `mind-ontology`). |
| Unknown flag | `Unknown argument: <arg>` | Remove it (see `--help`). |

## `agentctx:metrics`

| Failure | Message (stderr) | Fix |
|---|---|---|
| No `--task` | `Missing required --task argument` | Pass `--task "…"`. |
| No `.agentctx/` | same `Missing .agentctx/ …` as compile | Run `agentctx:init` first. |

## `agentctx:validate`

`validate` never throws on a clean tree; it reports issues and exits non-zero
only when there are errors. A missing directory yields a `[missing-dir]` issue
naming `agentctx:init`. See [schema validation](mind-ontology-schema-validation-v0.md).

## `agentctx:mcp` (JSON-RPC error codes)

| Failure | Code | Meaning |
|---|---|---|
| Malformed JSON line | `-32700` | Parse error. |
| Unknown method / tool | `-32601` | Method or tool not found. |
| Missing `task` / bad `format` | `-32602` | Invalid parameters. |
| Unexpected internal error | `-32603` | Internal error (returned, not crashed). |

See [`agentctx-mcp.md`](agentctx-mcp.md) for the full transport contract.

---

These messages are stable and covered by `tests/unit/cli-error-ux.test.mjs`, so a
change to any of them is a deliberate, reviewed UX change — not an accident.
