# Mind Ontology `adopt` — guided adoption spec (v1)

`mind-ontology adopt` is the one command an existing project runs to wire itself
for Mind Ontology across every supported client. It replaces the "remember the
scattered commands" onboarding (`init` → `emit` → `agent-setup`, per client)
with a single guided, **local-first, read-only-by-default** entry point that
says exactly what will happen, what needs manual action, and how to verify the
result.

This document is normative: it locks the public interface, the per-target
mapping, the write policy, and the `manual_required` contract so the
implementation lanes (the planner, the write mode, the fixtures) have no open
decisions. It does not introduce any new safety surface — it composes the
already-shipped [`emit`](workbench-w1-emit-target-spec.md),
[`agent-setup`](agent-setup.md), and `init --from-repo`
([init-from-repo.md](init-from-repo.md)) contracts and inherits their guarantees.

## Public interface

```sh
mind-ontology adopt [--cwd <path>] [--targets all|claude-code,codex,cursor,paste-block] [--write] [--format text|json]
```

| Flag | Default | Meaning |
|---|---|---|
| `--cwd <path>` | process cwd | Project root to adopt. |
| `--targets <list>` | `all` | `all`, or a comma list of client ids (`claude-code`, `codex`, `cursor`, `paste-block`). |
| `--write` | absent | Required to create any file. Without it, `adopt` is a read-only plan. |
| `--format text\|json` | `text` | Output format. |

Rules:

- **Default mode is a read-only plan.** A bare `mind-ontology adopt` writes
  nothing — it inspects the project and prints the plan it *would* apply.
- `--write` is **required** for file creation. It is the single gate between the
  plan and any filesystem change.
- `--targets all` expands to all four client ids in this fixed order:
  `claude-code`, `codex`, `cursor`, `paste-block`. An explicit list preserves
  the order the operator typed and rejects unknown ids.

## Target mapping

Each client id maps to an emit target (the static artifact the client reads) and,
where the client supports it, a project-local config file:

| Client id | Emit target | Emitted artifact | Config file (create-only) |
|---|---|---|---|
| `claude-code` | `claude-md` | `CLAUDE.md` | `.mcp.json` |
| `codex` | `agents-md` | `AGENTS.md` | `.codex/config.toml` |
| `cursor` | `cursor` | `.cursor/rules/mind-ontology.mdc` | — |
| `paste-block` | `paste-block` | `mind-ontology-paste-block.md` | — |

- `claude-code` and `codex` get **both** a generated instruction file *and* an
  MCP config block, exactly as `agent-setup` produces them today.
- `cursor` and `paste-block` are **emit-only**: there is no machine config to
  wire, so adoption is just the artifact plus instructions.
- `cursor` and `paste-block` stay **supported-but-not-default for `emit`**:
  `adopt` may select them (they are first-class adoption clients), but it never
  changes the default `emit` output set — a bare `mind-ontology emit` still
  writes `AGENTS.md` + `CLAUDE.md` only. `adopt` reaches the non-default emit
  targets the same way an operator would: by naming them with `--target`.

## ChatGPT / Claude.ai

The `paste-block` client is the **manual** path for ChatGPT and Claude.ai
project instructions. `adopt` produces exactly one artifact —
`mind-ontology-paste-block.md` — plus a manual step telling the operator to paste
it into the model's project-instructions box. `adopt` performs **no browser or UI
automation** and drives no hosted account. The paste step is always a
`manual_step`, never an `action`.

## Write policy

Write mode (`--write`) performs only safe, local, create-or-refresh setup:

1. **Sources.** If `.agentctx/` is absent, `adopt --write` calls `initFromRepo()`
   **once** to scaffold a populated draft from the repository's own public
   artifacts (the same scanner `init --from-repo` already ships, with its
   credential scrub and machine-local-detail filter). An existing `.agentctx/`
   is never overwritten or re-scanned.
2. **Artifacts.** Each selected emit target is built through the existing `emit`
   logic. A target that is `MISSING` or `STALE` is (re-)emitted; a target that
   is already `OK` is left untouched (reported as already fresh).
3. **Config files.** For `claude-code` / `codex`, the MCP config file is created
   **only when absent**, byte-identical to what `agent-setup` writes.

Existing files are **never silently overwritten.** Two conflict classes downgrade
to `manual_required` instead of writing:

- An emit artifact that is `UNMANAGED` (a headerless hand-written file) or
  `HAND-EDITED` — `adopt` refuses to clobber it, exactly as `emit` does without
  `--force`.
- A config file (`.mcp.json` / `.codex/config.toml`) that already exists —
  `adopt` refuses to overwrite or merge it, exactly as `agent-setup` does.

A `manual_required` outcome is **honest, not fatal**: the run still completes,
applies every *other* safe action, and surfaces the conflict in `manual_steps`
with the exact command (or merge instruction) to resolve it by hand. A partial
adoption is reported faithfully — it never claims a conflicted target was set up.

## Verify commands

Every plan and every write result names the commands that confirm the setup,
so the operator never has to remember them:

- `mind-ontology validate` — the scaffolded `.agentctx/` is schema-valid.
- `mind-ontology status` — one health roll-up (validate, metrics, CQ, emit
  freshness).
- `mind-ontology emit --check --target <selected emit targets>` — the emitted
  artifacts match their sources (no drift).

The `emit --check` command names exactly the emit targets the selected clients
map to, in emit-registry order (`agents-md`, `claude-md`, `cursor`,
`paste-block`).

## Honest framing (no auto-call guarantee)

`adopt` carries forward `agent-setup`'s honesty contract verbatim: wiring an MCP
config is a **practical helper, not a guarantee** that every agent run auto-calls
the server. The generated instruction files are what a client auto-reads at
startup; the bootstrap instruction is what asks the agent to actually call
`get_context` / `list_constraints`; and the live MCP path returns richer,
task-scoped context than the static file. The bootstrap instruction belongs in
the **non-generated** instruction layer (e.g. `CLAUDE.local.md`, user-level Codex
guidance) — never in the emit-owned `CLAUDE.md` / `AGENTS.md`, which re-emit over
hand edits.

## Output shape (JSON)

`--format json` prints a locked machine shape:

```json
{
  "ok": true,
  "mode": "plan",
  "cwd": "<project root>",
  "targets": ["claude-code", "codex", "cursor", "paste-block"],
  "actions": [],
  "manual_steps": [],
  "verify_commands": [],
  "warnings": []
}
```

- `mode` is `"plan"` without `--write`, `"write"` with it.
- `actions` lists the safe automated units (scaffold sources, emit an artifact,
  create a config) with their per-unit status (`planned` / `written` /
  `skipped` / `manual_required`).
- `manual_steps` lists the human actions: every conflict, the paste-block paste,
  and the bootstrap-instruction paste for `claude-code` / `codex`.
- `verify_commands` lists the three verify commands above.
- `warnings` lists non-fatal advisories (e.g. the MCP server script not found
  under the project yet, or `.agentctx/` absent and about to be scaffolded).
- `ok` reports that the command ran and produced a faithful plan/result; it is
  not flipped by a `manual_required` outcome (that is reported in
  `manual_steps`, not as an error).

## Safety boundaries (inherited)

`adopt` adds no new authority. It:

- writes only inside `--cwd` (project-local), never global user config or user
  memory;
- never reads `.env`, secrets, or arbitrary file contents — `initFromRepo()`
  reads only its fixed public-artifact allowlist;
- emits **no** real endpoint URLs or credentials into any artifact or output;
- automates **no** ChatGPT/Claude.ai UI;
- never overwrites an unmanaged or hand-edited file;
- does not deploy and does not touch production data.

See [the CLI error reference](cli-errors.md) for the `adopt` error vocabulary
and the `manual_required` recovery table.
