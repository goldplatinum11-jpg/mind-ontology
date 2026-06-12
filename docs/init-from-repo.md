# `init --from-repo` — draft an ontology from an existing repository

`mind-ontology init` scaffolds nine placeholder files. That is correct for a
brand-new project, but a user adopting Mind Ontology inside an existing
repository should not stare at nine empty templates: the repository already
states most of the facts an ontology starts from.

```text
mind-ontology init --from-repo [--cwd <path>] [--force]
```

`--from-repo` inspects the repository at `--cwd` and writes a populated
`.agentctx/` draft instead of placeholders. The draft validates clean
(`mind-ontology validate` reports zero errors) and compiles immediately, so
`get_context(task)` is useful from the first session.

## What it reads

The scanner reads a fixed allowlist of public project artifacts — nothing
else:

| Artifact | Used for |
| --- | --- |
| `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` | project name, description, language, scripts, notable dependencies |
| `README.md` | title and first real paragraph (badges and HTML skipped) |
| `LICENSE` | license name |
| top-level directory names (`src/`, `tests/`, `docs/`, …) | architecture layout |
| `.github/workflows` presence | CI hint |
| top-level `CLAUDE.md` / `AGENTS.md` | existing safety/workflow rules and role hints (short keyword-matched lines only) |
| `git log` (up to 8 recent commit subjects) | recent change history and activity drafts |

It never reads `.env`, dotfiles, or arbitrary source files. Every extracted
string passes through a credential scrub (the same pattern the schema
validator enforces) plus a machine-local-detail filter (absolute paths, raw
IPs, ssh targets are dropped) before it can appear in a generated block, and
the generator refuses to write any file that still matches the credential
pattern.

Two deliberate exclusions: a `CLAUDE.md` that carries a `mind-ontology:emit`
header is a compiled artifact of this tool and is skipped rather than
recycled, and a missing `git` binary (or a non-repository directory) simply
yields no history drafts — the command never fails because version control
is absent.

## What it writes

All nine ontology source files, schema-valid by construction:

- `projects.md` — the active project with `Name:`/`Status:` fields, the
  manifest description, license, and recent activity notes from git history.
- `decisions.md` — the detected stack recorded as a standing decision, plus a
  recent-change-history draft from commit subjects when git is available.
- `architecture.md` — repository layout plus build/test/lint commands.
- `constraints.md` — the safety baseline, a "verify with the project's
  own checks" block naming the detected test command, and any safety/workflow
  rules imported from an existing `CLAUDE.md`/`AGENTS.md`.
- `agent-roles.md` — Implementer and Reviewer roles wired to that command,
  plus role/workflow hints imported from `CLAUDE.md`/`AGENTS.md`.
- `direction.md` — the README summary as a draft direction.
- `glossary.md` — the project and detected frameworks as first terms.
- `cq.md` — two competency questions the draft can already answer.
- `identity.md` — deliberately TODO: repository artifacts say nothing about
  the human operator, so the draft asks rather than invents.

Every generated block carries a `Source:` line naming the artifact it came
from, and everything the scanner could not know is marked `TODO:` for the
operator to replace.

## Safety contract

Same as plain `init`: an existing `.agentctx/` is never touched without
`--force`, and a refused run leaves user edits byte-for-byte intact. With no
manifest and no README the command still succeeds — the draft degrades to
TODO placeholders with the directory name as the project name.
