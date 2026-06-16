# `import-sirt` — harvest SIRT memory nodes into `.agentctx/`

`mind-ontology import-sirt` pulls nodes from your
[SIRT](https://sirtai.org) memory graph and runs them through the same
harvester pipeline used by `import` and the auto-session hook. Decisions,
constraints, principles, and glossary terms stored in SIRT land in the
matching `.agentctx/` files; uncertain or low-confidence text goes to
`inbox.md` for human review.

```
mind-ontology import-sirt [--cwd <dir>] [--dry-run] [--format json]
                          [--limit <n>] [--query <str>]
```

---

## Requirements

- A project that has already run `mind-ontology init` (`.agentctx/` must exist).
- A `SIRT_API_KEY` environment variable set to a valid bearer token.
  No other setup is required; no new key registration is needed if you already
  have access to SIRT.

---

## Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--cwd <dir>` | `process.cwd()` | Project root containing `.agentctx/`. |
| `--dry-run` | off | Run the full pipeline without writing any files. |
| `--format json` | text | Print a machine-readable JSON summary instead of plain text. |
| `--limit <n>` | 50 | Maximum number of SIRT nodes to fetch. |
| `--query <str>` | none | Semantic filter passed to `sirt_nodes_list`. Useful for scoping to a topic. |

---

## What gets harvested

Each fetched node's `summary` and `body` fields are split into sentence-level
candidates and passed through the classifier. The same rules apply as for
ChatGPT exports and Claude sessions:

- **Decisions** — standing choices with rationale (`decisions.md`)
- **Constraints** — non-negotiable limits (`constraints.md`)
- **Principles** — persistent guidelines (`principles.md`)
- **Glossary terms** — named concepts (`glossary.md`)
- **Inbox** — low-confidence text, ambiguous entries (`inbox.md`)
- **Rejected** — implementation details, bug-fix notes, progress markers
  (silently filtered)

Writes are idempotent: a node whose summary is already present as a heading
in the target file is skipped. Provenance is recorded under
`.agentctx/sources/` so a re-run never double-writes.

---

## Example

Fetch the 20 most recent SIRT nodes and preview what would be written:

```sh
SIRT_API_KEY=<your-key> mind-ontology import-sirt --limit 20 --dry-run
```

Scope to architecture decisions only:

```sh
SIRT_API_KEY=<your-key> mind-ontology import-sirt --query "architecture decision"
```

Write results as JSON for scripting:

```sh
SIRT_API_KEY=<your-key> mind-ontology import-sirt --format json | jq .
```

Sample text output:

```
import-sirt: fetched 12 nodes from SIRT
  nodes:      12
  candidates: 47
  written:    8
  duplicates: 3
  inboxed:    4 (→ .agentctx/inbox.md)
  rejected:   32 (implementation details filtered)
```

---

## SIRT is optional

The rest of mind-ontology — `init`, `compile`, `validate`, `emit`, `mcp`,
`import` (ChatGPT), and the Claude Code Stop hook — work without SIRT and
without any network access. `import-sirt` is an additive operator command
for teams that already use SIRT as their memory backend.

If `SIRT_API_KEY` is absent or the SIRT endpoint is unreachable, the command
exits with a clear error and leaves `.agentctx/` untouched.
