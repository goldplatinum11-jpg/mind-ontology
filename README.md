# Mind Ontology

**Stop hand-writing AGENTS.md. Compile it.**

One ontology, every agent. Compile AGENTS.md, CLAUDE.md, and more from a
single git-native source.

Mind Ontology ships as the **`mind-ontology`** package and CLI — a small,
auditable compiler + MCP server over a folder of plain Markdown files you own.
`agentctx` is the internal compiler name; it survives as the source folder
(`.agentctx/`) and the MCP server name.

> **Status:** standalone, pre-release, **local-first**. The free layer needs no
> account, no database, and no network. Hosted memory is an *optional*,
> fail-closed on-ramp that is **off by default**.
>
> **License:** [Apache-2.0](LICENSE). The package is publish-ready (`0.1.0`) but
> not yet published — see [Distribution & license boundary](#distribution--license-boundary).

---

## The problem: you are the sync mechanism

Every AI tool demands its own instruction file. `CLAUDE.md` for Claude Code.
`AGENTS.md` for Codex. Cursor rules. ChatGPT project instructions. The *same*
meaning — direction, constraints, vocabulary, roles — hand-copied into N files
that start drifting the moment you stop babysitting them. Change a constraint
once and you get to re-phrase it everywhere, by hand — or your agents quietly
disagree about the rules.

That maintenance loop is a build step you have been running manually. Nobody
hand-syncs compiled output in any other part of their stack; instruction files
somehow got an exemption.

## The inversion: static files as targets, not sources

Mind Ontology stops treating `AGENTS.md` and `CLAUDE.md` as documents you
*write* and starts treating them as artifacts you *build*. The meaning lives
once, in `.agentctx/` — small Markdown files you review in PRs like any other
source — and everything an agent reads is compiled from it:

```text
.agentctx/ source files   (one ontology: plain Markdown, git-native, PR-reviewed)
   ├── mind-ontology emit ───────► AGENTS.md + CLAUDE.md   static compile targets
   └── agentctx MCP server ──────► get_context(task)        live, task-scoped packs
```

Emitted artifacts are never sources: `emit` writes only the declared targets,
never reads them back, and never merges. Each artifact carries a
machine-readable header with a source fingerprint and a content fingerprint,
so a stale or hand-edited file is mechanically detectable — and
[fails CI](#drift-fails-ci).

## Try it in 30 seconds

From this repo (the package is not published yet):

```sh
npm install
npm run mind-ontology -- init     # scaffold .agentctx/ from the template
npm run mind-ontology -- emit     # compile the static artifacts
```

Adopting Mind Ontology in an existing repository? `init --from-repo` drafts
the ontology from what the repo already states — manifest, README, LICENSE,
layout, an existing `CLAUDE.md`/`AGENTS.md`, and recent git history — instead
of placeholders. See [docs/init-from-repo.md](docs/init-from-repo.md).

```text
WROTE  AGENTS.md  (agents-md, profile default, 96 payload lines)
WROTE  CLAUDE.md  (claude-md, profile default, 100 payload lines)
```

Every emitted file opens with its own audit trail. This is the actual header
of the `AGENTS.md` compiled from the bundled template — emit is deterministic
(no timestamps, no machine info, no model calls), so you get these exact
bytes:

```text
<!-- mind-ontology:emit
target: agents-md
profile: default
emit_version: 2
source: .agentctx/
source_digest: sha256:c3fea6fbf665ff3740ea3c868ec659f34921d62316417a98a52aea9a5bc39e2d
content_digest: sha256:9b947e91092255cb55a665d51f9c0cafdc3ec5a1ca75b0e42df8543ff99c859f
note: GENERATED FILE - do not hand-edit. Edit .agentctx/ and re-run: mind-ontology emit
-->
```

Now edit any source file — and the artifacts know they are stale:

```sh
npm run mind-ontology -- emit --check
```

```text
STALE        AGENTS.md (agents-md) - .agentctx/ changed (or emit_version bumped) since last emit; run: mind-ontology emit --target agents-md
STALE        CLAUDE.md (claude-md) - .agentctx/ changed (or emit_version bumped) since last emit; run: mind-ontology emit --target claude-md
DRIFT - 2 of 2 targets need attention
```

Re-emit, and the gate goes green:

```text
OK           AGENTS.md (agents-md, profile default)
OK           CLAUDE.md (claude-md, profile default)
OK - 2 of 2 targets fresh
```

Every command and output block above is the real behavior of the shipped
engine, verified against this README by
`tests/unit/readme-claims-audit.test.mjs`. A bare `emit` writes the two
**default** targets; two more **supported** targets are emitted on demand with
`--target`:

| Target | Command | Writes | For |
|---|---|---|---|
| `agents-md` | `mind-ontology emit` (default) | `AGENTS.md` | Codex and other AGENTS.md readers |
| `claude-md` | `mind-ontology emit` (default) | `CLAUDE.md` | Claude Code project memory |
| `cursor` | `mind-ontology emit --target cursor` | `.cursor/rules/mind-ontology.mdc` | Cursor project rules |
| `paste-block` | `mind-ontology emit --target paste-block` | `mind-ontology-paste-block.md` | ChatGPT / Claude.ai project instructions (manual paste) |

`cursor` and `paste-block` are **supported but not default** — a bare `emit`
never writes them, so they never grow your default output set unasked; emit
both at once with `mind-ontology emit --target cursor,paste-block`. `--full`
opts into a whole-ontology dump, and a pre-existing hand-written file is never
silently overwritten (see the
[emit target spec](docs/workbench-w1-emit-target-spec.md)).

## Drift fails CI

A static instruction file is only trustworthy if it provably matches its
sources, so `emit --check` is built to be a CI gate, not a suggestion. There
is no warn mode:

```sh
npx mind-ontology emit --check    # exit 0 fresh · 1 drift (re-emit) · 2 hard error (fix the ontology)
```

The three-way exit code lets CI tell "re-emit and commit" apart from "the
ontology itself is broken" without parsing anything. A copy-paste GitHub
Actions step and an optional pre-commit hook are in the
[emit target spec §12](docs/workbench-w1-emit-target-spec.md#12-ci-recipe-w4).

## "Generated context files degrade agents, though?"

A fair objection — research from ETH Zurich found that *LLM-auto-generated*
context files (auto-summarized repo instructions) can degrade agent
performance. That finding is about machine-written meaning, and it does not
apply here: **there is no LLM anywhere in the emit pipeline.** `emit` is a
deterministic, rule-based compilation of the `.agentctx/` sources a human
curated; no emitted byte is model-generated, and identical sources produce
byte-identical artifacts. The same body of research is consistent with
human-curated context helping agents — and that is exactly the split this
design lands on: humans curate the meaning once, the compiler only re-projects
it per tool.

## The live path: compile per task, not per file

Static targets are the on-ramp. The same ontology also serves **live,
task-scoped** context to any MCP-capable agent — that is the "and more" in the
headline:

```sh
npm run mind-ontology -- compile --task "Plan the next PR" --scope mcp
```

Agents don't get the whole brain. `get_context("fix the OAuth flow")` returns
the relevant direction, the matching decisions, and the full set of
non-negotiable constraints — scored for the task in front of them. Wire it in
once (Claude Code shown; Codex/Cursor analogous):

```json
// .mcp.json
{ "mcpServers": { "agentctx": { "command": "node", "args": ["scripts/agentctx/mcp-server.mjs"] } } }
```

Then give every agent the same one-line instruction:

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

One command produces this wiring per client — the MCP config plus a startup /
first-action bootstrap instruction (deterministic, local-only, never
overwrites an existing config):

```sh
npx mind-ontology agent-setup --target claude-code --print   # or: codex
```

See [agent setup](docs/agent-setup.md) for the adoption-autoload flow, the
[quickstart](docs/mind-ontology-quickstart.md) for the install-first
flow and [client setup proofs](docs/mind-ontology.md#client-setup) for
per-tool wiring. The engine's classic entry points keep working too:

```sh
npm run agentctx:compile -- --task "Plan the next PR" --scope mcp
npm run agentctx:validate                 # check your ontology against the schema
npm run agentctx:metrics  -- --task "Plan the next PR"   # how focused is the pack?
npm run agentctx:smoke                    # one-command end-to-end check
npm run agentctx:proof                    # smallest viable gate (fast, local)
npm test                                  # full unit suite
```

The full command map is in the
[`mind-ontology` CLI guide](docs/mind-ontology-cli-v0.md).

**Risk-aware by default.** When a task reads as destructive or structural, the
compiler forces your safety blocks into the pack — no prompt engineering
needed:

```sh
npm run agentctx:compile -- --task "Drop the orders table" --risk auto   # forces #safety context
npm run agentctx:compile -- --task "Tidy docs"            --risk risky  # force it anyway
```

Static targets get the same floor: `emit` assumes worst-case risk, so every
safety-tagged block is compiled into the artifact's Constraints section. This
decides *what context the agent sees*; the **live-write boundary is enforced
separately and fails closed** at the adapter layer (flags off by default,
writeback is proposal-only). See
[task risk modes](docs/mind-ontology-task-risk-modes-v0.md).

---

## Adopt it in one command

Wiring an existing project for every client is a single guided, **local-first,
read-only-by-default** command. A bare `mind-ontology adopt` writes nothing — it
inspects the project and prints the plan it *would* apply: which sources to
scaffold, which artifacts to emit, which MCP configs to create, and the manual
steps it can't do for you. `--write` is the one gate that turns the plan into
files:

```sh
npx mind-ontology adopt
npx mind-ontology adopt --write
```

It covers all four clients in one pass — Claude Code, Codex, Cursor, and the
ChatGPT / Claude.ai paste-block — and never overwrites or merges an existing
config or a hand-edited artifact: such conflicts come back as **manual steps**,
not silent clobbering, and the run still applies every other safe action. Pick a
subset with `--targets`:

```sh
npx mind-ontology adopt --targets cursor,paste-block --write
```

`adopt` automates **no** ChatGPT / Claude.ai UI — the paste-block is always a
manual paste into the model's project-instructions box. And wiring an MCP config
is a practical helper, **not** a guarantee that every agent run auto-calls the
server: the generated instruction files are what a client auto-reads at startup,
and the one-line bootstrap instruction is what asks the agent to actually call
`get_context` / `list_constraints`. `adopt` composes the same per-client wiring
[`agent-setup`](docs/agent-setup.md) produces; the full per-target mapping, write
policy, and `manual_required` contract are in the
[adopt spec](docs/mind-ontology-adopt-spec-v1.md).

---

## Three-layer mental model

Mind Ontology has three layers, each opt-in from the one before it:

```text
① route     —  pick which ontology (box) a task belongs to, from a library of many
② compile   —  select the right blocks within that box, scored for the task
③ budget    —  trim the pack to fit a token window (--max-tokens)
```

Starting with one `.agentctx/` folder? You are already at layer ②. Add more
ontologies in a library folder and layer ① routes between them. Layer ③ is
on-demand — add `--max-tokens` only when a downstream model has a tight context
window.

---

## Library routing (layer ①)

When you have more than one ontology, keep each in its own subdirectory of a
library folder. Each box declares a `manifest.json` with the trigger terms that
route to it:

```json
{
  "id": "my-product",
  "name": "My Product",
  "triggers": ["checkout", "payment", "stripe"],
  "scopes": ["backend", "billing"]
}
```

Then route a task to the best-matching box:

```sh
npm run mind-ontology -- route   --library ./ontologies --task "debug the checkout flow"
npm run mind-ontology -- compile --library ./ontologies --task "debug the checkout flow"
```

`route` prints which box was selected (and why). `compile --library` routes and
then compiles in one step — the agent calls one command and gets the right
context from the right box, deterministically.

To lint the whole library for routing problems (duplicate ids, boxes with no
triggers, ambiguous trigger sets):

```sh
npm run mind-ontology -- doctor --library ./ontologies
```

To draft a `manifest.json` for an existing `.agentctx/` folder:

```sh
npm run mind-ontology -- scaffold --cwd ./ontologies/my-product
```

`scaffold` reads the existing project names, glossary terms, and direction
blocks, and emits a draft `manifest.json` with suggested triggers. Review and
trim the suggestions before committing — the router only trusts author-confirmed
terms.

---

## Scoring signals (opt-in upgrades)

The default scorer is minimal and deterministic. Three optional flags extend it
without changing the default behavior (a flag-off run is byte-for-byte identical
to before):

**`--rich-scoring`** — boosts heading/tag hits over body-only hits. A block that
*names* the topic in its `## heading #tag` outranks one that only mentions it in
passing:

```sh
npm run agentctx:compile -- --task "Fix OAuth bug" --scope auth --rich-scoring
```

**`--recency`** — breaks score ties by the `Date: YYYY-MM-DD` line in a block's
body. Among equally-relevant blocks the newer date is preferred. Deterministic:
no decay, no current-time comparison, just a stable ISO-date ordering:

```sh
npm run agentctx:compile -- --task "What changed recently" --recency
```

Add a `Date:` line to any block you want recency-aware:

```markdown
## Adopt async-first messaging #architecture

Date: 2026-05-10

All inter-service calls use async messaging by default…
```

**`--aliases`** — expands a block's `Aliases: a, b, c` line into the heading
token set. A task term that matches a declared synonym is treated as a
heading-tier hit (not just a body hit), surfacing the block even when the task
uses a different word:

```sh
npm run agentctx:compile -- --task "Fix the auth bug" --aliases
```

Add an `Aliases:` line to any block that should respond to synonyms:

```markdown
## OAuth 2.0 integration #security

Aliases: auth, authentication, login, sign-in

Implemented as a PKCE flow with short-lived tokens…
```

**`--explain`** — adds per-block provenance to the output. Each block shows
`sourceFile`, `heading`, `score`, and `reason` (`constraint` / `scored` /
`risk-forced`). When `--recency` fires, `recencyDate` appears; when `--aliases`
fires, `matchedAliases` appears:

```sh
npm run agentctx:compile -- --task "Fix auth" --aliases --recency --explain
```

---

## Token budgets (layer ③)

When a downstream model has a tight context window, add `--max-tokens` to cap
the pack size. Mandatory blocks (constraints, risk-forced safety guidance) are
always kept; lower-priority blocks are dropped in priority order to fit:

```sh
npm run agentctx:compile -- --task "Fix the OAuth flow" --max-tokens 2000
```

For the tightest budgets, combine with `--format compact` to strip all metadata
and emit only the block headings and bodies:

```sh
npm run agentctx:compile -- --task "Fix the OAuth flow" --max-tokens 2000 --format compact
```

`--format compact` removes the generated timestamp, per-block Source/Reason/Tags
lines, and the Omitted section — just the task header, a risk note if risky, and
the block content. The `--max-tokens` estimate counts the compact rendering, so
what you estimate is what the agent receives.

---

## Competency Questions — the verification core

Mind Ontology is verified by the concrete questions an agent must be able to
answer before it acts. These **Competency Questions (CQs)** are the product's
correctness contract — not decoration:

- *Which files am I allowed to write in this task?*
- *What is the current direction this work serves?*
- *What must I never do, and when must I fail closed?*

The compiled context pack must answer the active CQs from local files alone. See
the [CQ schema](docs/mind-ontology-cq-schema-v0.md) and the template at
`templates/mind-ontology/.agentctx/cq.md`.

---

## What's in the box

| Layer | What | Status |
|---|---|---|
| Sources | `.agentctx/` schema: constraints, identity, direction, projects, decisions, architecture, roles, glossary, competency questions | shipped |
| Compiler | task-scoped scoring, risk-aware forcing, JSON/Markdown/compact output | shipped |
| Scoring signals | `--rich-scoring` heading boost, `--recency` date tie-breaker, `--aliases` synonym expansion, `--explain` per-block provenance | shipped |
| Budget | `--max-tokens` opt-in compaction (priority-ordered, never drops constraints or risk-forced safety) | shipped |
| Library routing | `route` / `compile --library` deterministic box selection, `doctor` library linter, `scaffold` manifest drafter | shipped |
| Emit | `AGENTS.md` + `CLAUDE.md` default targets, plus on-demand `cursor` `.mdc` and a ChatGPT/Claude.ai paste-block (`--target`), deterministic with fingerprint headers, `emit --check` drift gate for CI | shipped |
| Tooling | `init`, `compile`, `validate`, `metrics`, `smoke`, `proof` — plus a unified [`mind-ontology` CLI](docs/mind-ontology-cli-v0.md) | shipped |
| Clients | Claude Code / Codex / Cursor (proven), ChatGPT / Claude.ai (thin connector, designed) | shipped / designed |
| Hosted on-ramp | optional hosted memory + writeback, fail-closed, off by default | contracts only |

Everything in this repo that runs locally over your files — the compiler, the
MCP server, **emit and its drift check included** — is free OSS, forever; the
paid hosted layer is for things a file on your disk cannot do (shared durable
memory across machines and teammates). See
[commercial positioning](docs/mind-ontology-commercial-positioning-v0.md).

---

## Distribution & license boundary

Mind Ontology is licensed under **Apache-2.0** (chosen 2026-06-09; full text in
[`LICENSE`](LICENSE), attribution/trademark scope in [`NOTICE`](NOTICE)). The
rationale is in [`docs/mind-ontology-license-boundary.md`](docs/mind-ontology-license-boundary.md)
and the decision record in [`LICENSE-DECISION.md`](LICENSE-DECISION.md).

**Choosing the license is not the same as publishing.** Distribution stays
deliberately gated:

- The first release is **prepared but unpublished**: version `0.1.0`, with a
  `files` allowlist so the tarball ships only the product surface. The package
  is publish-ready, but there is no public remote and nothing is pushed.
- Publishing is a separate, later step — an explicit operator decision — see
  [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) and
  [`docs/packaging.md`](docs/packaging.md).

So the **source license is settled (Apache-2.0)**, while **distribution remains a
deliberate, separate decision.**

---

## Trust

- The free layer is local, file-based, and reviewable — no account, no network.
- The emit pipeline is deterministic and model-free: identical sources compile
  to byte-identical artifacts, and the fingerprint header proves it.
- Every hosted feature is opt-in, fail-closed, and reversible; the local path is
  never load-bearing.
- No credentials live in this repo: connector URLs and tokens are
  operator-supplied. The hosted boundary is enforced by
  [`tests/unit/agentctx-no-leakage-audit.test.mjs`](tests/unit/agentctx-no-leakage-audit.test.mjs).

See the [trust & security model](docs/mind-ontology-trust-security-model-v0.md)
and the [OSS↔hosted boundary](docs/mind-ontology.md) docs for the full posture.

---

## Documentation

Start at the [docs index](docs/mind-ontology.md). For emit specifically: the
[emit target spec](docs/workbench-w1-emit-target-spec.md) (what is compiled,
headers, drift classes, CI recipe) and the
[operator CLI spec](docs/workbench-w2-cli-spec.md) (flags, exit codes, JSON
shapes). Provenance for this standalone extraction is recorded in
[`EXTRACTION-INVENTORY.md`](EXTRACTION-INVENTORY.md) and
[`docs/mind-ontology-extraction-map.md`](docs/mind-ontology-extraction-map.md)
— those are read-only history, not a user quickstart.

Wiring an autonomous AI development line? See the local-first
[Autopilot Integration Pack](docs/mind-ontology-autopilot-pack-v1.md) — when each
agent reads `.agentctx/`, the stop policy, and a drop-in kit, with no hosted backend.

Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md). Release readiness:
[`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md).

**Support & contact: GitHub Issues only.** No email, chat, or paid support
channel exists; questions and bug reports go through the issue tracker of the
public repository.

---

## Positioning

Mind Ontology is the **open, local-first on-ramp**; an optional paid hosted
backend adds durable memory, retrieval, typed graph, and writeback.
The free layer is genuinely useful on its own — one compiled meaning source for
every agent, static or live — and never depends on the hosted layer. The
hosted backend stays closed and is not part of this repository. This is
open-core, not crippleware: the local path is complete. See
[commercial positioning](docs/mind-ontology-commercial-positioning-v0.md) for
the full framing.

---

## Status

Mind Ontology is built in public, one reviewable change at a time, across five
arcs: OSS foundation → schema & context quality → multi-client distribution →
hosted on-ramp → launch readiness. The hosted backend remains a closed,
optional service; this repository is the open, local-first product surface.
