# Workbench W1 — Emit Target Specification (v1)

**Status:** specification only · docs-only lane (`claude/workbench-w1-emit-target-spec`)
**Fulfills:** ADL **W1** of the
[Workbench v1 design packet](mind-ontology-workbench-design-v1.md) (Part B).
The packet's provisional artifact name was `mind-ontology-emit-targets-v0.md`;
the controller assigned this filename instead — treat this document as that
artifact.
**Operator decisions baked in** (resolving the packet's Part C questions):
emit is OSS (Q2); v1 targets are `AGENTS.md` + `CLAUDE.md` only (Q4);
`emit --check` **fails** CI on drift, not warn (Q7); the Workbench is CLI-only
and "Workbench" stays an internal name (Q1, Q5).

This document specifies *what* `mind-ontology emit` produces and how drift is
detected. The CLI surface (flags, error rows, `--format` contract) is W2; the
engine implementation and golden files are W3/W4. Nothing here ships code.

---

## 1. Design principles

1. **Compiled, not hand-written — and not LLM-generated.** The positioning is
   "stop hand-writing static instruction files; compile them." One anticipated
   objection must be answered in the spec itself: research from ETH Zurich
   reports that *LLM-auto-generated* context files (auto-summarized repo
   instructions) can degrade agent performance. That finding does not apply
   here, and the distinction is a design invariant: **emit performs a
   deterministic, rule-based compilation of human-curated `.agentctx/`
   sources. No language model is invoked at any point in the emit pipeline,
   and no emitted byte is model-generated.** The human curates the meaning
   once; emit only re-projects it per tool. Any future feature that would put
   an LLM inside the emit path is out of scope for this spec and would need a
   new design review.
2. **Deterministic and hashable.** Identical canonicalized sources + identical
   target + identical profile + identical emit format version ⇒ byte-identical
   output. See section 7 for the exact guarantee and the list of prohibited
   inputs (timestamps, machine info, locale).
3. **Shared payload, per-target frame.** Where two targets include the same
   source block, the rendered block body is byte-identical across targets.
   Targets differ only in their *frame*: title, preamble, section names and
   order, and footer. This keeps the targets provably "the same meaning,
   different packaging" and keeps golden-file tests (W3) cheap.
4. **Static targets assume worst-case risk.** A live compile knows its task
   and can apply [risk modes](mind-ontology-autopilot-risk-modes-v1.md); a
   static file serves every future task, including risky ones. Therefore emit
   always behaves as if the task were risky: every safety-tagged block
   (the `SAFETY_TAGS` set in `scripts/agentctx/compile.mjs`: `safety`,
   `destructive`, `security`, `secrets`, `irreversible`) from **any** source
   file — `cq.md` excepted, see section 3 — is forced into the artifact's
   Constraints section, regardless of the profile's per-file selection rules.
5. **Fail closed.** `emit --check` exits non-zero on any drift, missing
   artifact, or unmanaged file (section 8). A broken ontology
   (missing/empty `constraints.md`) fails `emit` with the same errors
   `agentctx:compile` already raises — see [cli-errors.md](cli-errors.md).
6. **Targets are artifacts, never sources.** Emit writes only the declared
   target files. It never reads an existing artifact to "merge" content, and
   it never writes into `.agentctx/`. The reframe of the
   [vs-instruction-files position](mind-ontology-autopilot-vs-instruction-files-v1.md)
   ("static files as targets, not sources") ships atomically with W10.

## 2. Target registry

The registry below is the normative list of targets. W3 must define a matching
`EMIT_TARGETS` registry constant in the engine, and add the W1 guard test: a
spec-consistency test that parses this table (column 1 = target id) and asserts
it stays in sync with the constant. Rows are keyed by the stable target id.

| Target id | Artifact path (relative to `--cwd`) | Consumer | v1 status |
|---|---|---|---|
| `agents-md` | `AGENTS.md` | Codex and other AGENTS.md-reading agents | **v1** |
| `claude-md` | `CLAUDE.md` | Claude Code project memory | **v1** |
| `cursor` | `.cursor/rules/mind-ontology.mdc` | Cursor rules | fast-follow (post-W4) |
| `paste-block` | `mind-ontology-paste-block.md` | ChatGPT / Claude.ai project instructions (manual paste) | fast-follow (post-W4) |

Registry rules:

- Target ids are kebab-case, stable forever (they appear in emitted headers).
- Artifact paths are fixed per target and resolved against `--cwd` (default:
  the project root containing `.agentctx/`). v1 has no path override; a
  config/manifest file is an explicit non-feature for v1 (section 9 and the
  W2 handoff).
- The default target set for both `emit` and `emit --check` is **all v1
  targets** (`agents-md`, `claude-md`). `--target <id>` restricts to a subset;
  this is also the v1 escape hatch for a repo that intentionally hand-tunes
  one file (per the operator's Q7 ruling, drift still fails CI for every
  target that *is* checked — the escape hatch is selecting which targets are
  managed, never downgrading a failure to a warning).

## 3. Profiles — what each target includes

A static artifact must not be a whole-brain dump (the packet's A5 risk:
"static targets lose task-scoping"). Each target compiles a named **profile**:
a deterministic per-source-file selection rule plus a size budget. v1 profiles
are fixed constants in the engine (no user-facing profile editing; see W2
handoff).

Selection rules are deliberately *not* score-based: lexical scoring
(see [how scoring works](how-scoring-works.md)) needs a task, and a static
target has none. v1 rules are structural and therefore trivially
deterministic:

| Rule | Meaning |
|---|---|
| `all` | every block of the file, in source order |
| `none` | the file contributes nothing (except safety-forced blocks, principle 4) |

The **`default` profile** (used by both v1 targets):

| Source file | Rule | Rationale |
|---|---|---|
| `constraints.md` | `all` | mirrors the compiler's always-include invariant |
| `identity.md` | `all` | small, stable, identity belongs in every static surface |
| `direction.md` | `all` | "why we are building this" frames every task |
| `agent-roles.md` | `all` | role expectations are per-agent standing orders |
| `projects.md` | `none` | task-scoped; the live MCP path serves it better |
| `decisions.md` | `none` | same — high churn, task-relevance varies |
| `architecture.md` | `none` | same |
| `glossary.md` | `none` | same |
| `cq.md` | `none` | verification scaffolding, not agent instructions |

Plus, from principle 4: safety-tagged blocks in `none`-rule files are always
emitted (appended to the Constraints section, annotated with their source
file). A block is never emitted twice; if it is selected by its file's rule it
is not re-appended by the safety sweep.

**Exception — `cq.md` never participates in the safety sweep** (operator
ruling recorded in W4; shipped as the `emit_version` 1 → 2 bump, constant
`SWEEP_EXEMPT_FILES` in `scripts/agentctx/emit.mjs`). Competency questions
are verification scaffolding: a `#safety` tag on a CQ marks the question's
*topic* — it is the CQ schema's required safety question — not an executable
constraint. The sweep's semantics are "force enforceable rules into the
artifact's Constraints section", and an unanswered question cannot be
enforced; sweeping one in would put a non-instruction into an instruction
file. No safety *rule* is lost by the exemption: rules live in
`constraints.md` (rule `all`) and in the safety-tagged blocks of every other
excluded file, which are swept as before. CQ surfacing belongs to the live
MCP path.

Modifiers:

- `--full` — opt-in whole-ontology dump: every rule becomes `all`. The header
  records `profile: full` so `--check` recompiles with the same profile.
- **Budget:** each profile carries a soft budget, default **400 lines** of
  emitted payload per target. Exceeding it emits successfully but prints a
  warning to stderr naming the overflowing target and the largest
  contributing files. Whether budget overflow should ever hard-fail is an
  open question for the operator (section 11); v1 warns only, because an
  over-budget artifact is verbose, not wrong, and `emit` must stay
  deterministic in its *output* regardless of warnings.
- Files absent from a project's `.agentctx/` contribute nothing, exactly as
  in the compiler — a minimal ontology with only `constraints.md` emits a
  valid (constraints-only) artifact.

Ordering within the artifact is always: source files in the compiler's
`SOURCE_FILES` order, blocks in source order within each file. No
re-sorting, no dedup heuristics beyond the single safety-sweep rule above.

## 4. AGENTS.md output specification

Section mapping (`.agentctx/` element → AGENTS.md section):

| AGENTS.md section | Source | Notes |
|---|---|---|
| *(header comment)* | generated | machine block, section 6 |
| `# AGENTS.md` + notice line | generated frame | notice: generated file, do-not-edit, source pointer, refresh command |
| `## Constraints` | `constraints.md` (all blocks) + safety-forced blocks from other files | non-negotiables first, always complete |
| `## Identity` | `identity.md` | omitted entirely if the file is absent/empty |
| `## Direction` | `direction.md` | same omission rule |
| `## Agent roles` | `agent-roles.md` | same omission rule |
| *(footer)* | generated frame | how to refresh; pointer to the richer live MCP path |

Block rendering, identical across all targets (principle 3):

```markdown
### <block title> <!-- (from .agentctx/<file>) -->
<block body, verbatim>
```

- `<block title>` is the heading title with inline `#tags` stripped — exactly
  the `title` field the block parser in `scripts/agentctx/compile.mjs`
  produces. Tags are curation metadata, not agent instructions; they are not
  rendered.
- The body is emitted verbatim (after canonicalization, section 7), with
  exactly one blank line between blocks.
- The HTML provenance comment is part of the deterministic output (it is the
  per-block provenance trail, and it survives in raw text for the agent
  while staying invisible in rendered views). Safety-forced blocks appearing
  under `## Constraints` keep their true source file in this comment.
- Source-level `##` blocks render as `###` so they nest under the generated
  `##` sections without colliding with them.

Empty-section rule: a section whose source file is absent, empty, or
contributes zero blocks is omitted entirely — heading included. No "(none)"
placeholders; an instruction file must contain only instructions.

Skeleton of a complete artifact:

```markdown
<!-- mind-ontology:emit … (section 6) -->
# AGENTS.md

> Generated by `mind-ontology emit` from `.agentctx/` — **do not hand-edit.**
> Edit the source files and re-run `mind-ontology emit`. Agents with MCP
> access get richer, task-scoped context from the live `get_context` tool.

## Constraints

### No SIRT dependency in core <!-- (from .agentctx/constraints.md) -->
…

## Identity
…

## Agent roles
…

---
*Source: `.agentctx/` · refresh: `mind-ontology emit` · verify: `mind-ontology emit --check`*
```

## 5. CLAUDE.md output specification

CLAUDE.md is the same compilation with a different frame. The payload —
every rendered block — is byte-identical to its AGENTS.md counterpart.
Differences, exhaustively:

| Aspect | AGENTS.md | CLAUDE.md | Why |
|---|---|---|---|
| Title line | `# AGENTS.md` | `# CLAUDE.md` | file convention |
| Notice line | generic agent wording | mentions Claude Code reads this as project memory, and that the `agentctx` MCP server (`get_context` / `list_constraints`) is the richer live path | CLAUDE.md readers can be pointed at a concrete upgrade: the [two-tool MCP surface](mind-ontology-autopilot-two-tool-contract-v1.md) |
| Section order | Constraints → Identity → Direction → Agent roles | identical | no reorder — diffing the two artifacts must show frame-only differences |
| Section names | as in section 4 | identical | same |
| `@path` imports | n/a | **not used** in v1 | imports would split the artifact across files and break the single-file content digest; revisit only if a real need appears |
| Footer | refresh + check commands | identical + one line noting per-user overrides belong in `CLAUDE.local.md` / user memory, not in this generated file | steers hand-edits to a safe location instead of into the artifact |

Rationale for "identical structure, different notice": Claude Code and
AGENTS.md consumers both want imperative, sectioned markdown; inventing
per-tool structure would multiply golden files without changing agent
behavior. The frame is where tool-specific guidance (MCP upgrade path,
local-override etiquette) belongs, and the frame is cheap to vary.

## 6. Generated-file header — marker and fingerprint format

Every emitted artifact begins with a machine-readable HTML comment block,
line 1, byte 0 (invisible in rendered markdown, present in raw text):

```text
<!-- mind-ontology:emit
target: agents-md
profile: default
emit_version: 1
source: .agentctx/
source_digest: sha256:<64 lowercase hex>
content_digest: sha256:<64 lowercase hex>
note: GENERATED FILE - do not hand-edit. Edit .agentctx/ and re-run: mind-ontology emit
-->
```

Format rules (normative for W3/W4):

- First line is exactly `<!-- mind-ontology:emit`; last line of the block is
  exactly `-->`. Between them, one `key: value` pair per line, no indentation,
  keys in the fixed order shown. Parsers must ignore unknown keys (forward
  compatibility) but reject a block missing any of the seven required keys.
- `target` — registry id (section 2). `profile` — profile name used.
- `emit_version` — integer format version of the emit templates. Bumped
  whenever the frame, header format, canonicalization, or digest definition
  changes. `--check` treats a version mismatch as stale (section 8).
- `source_digest` — fingerprint of the *inputs*: SHA-256 over the
  concatenation, in `SOURCE_FILES` order, of
  `<file name> + "\n" + <canonicalized file content> + "\0"` for **every
  source file the profile includes** (rule ≠ `none`), with absent files
  contributing an empty content string. Files the profile excludes are *not*
  digested — editing an unused source must not dirty the artifact. The one
  asymmetry: because safety-tagged blocks in excluded files can be forced in
  (principle 4), excluded files (minus the sweep-exempt `cq.md`, section 3)
  are scanned for safety tags, and any excluded
  file that currently contributes ≥1 forced block **is** included in the
  digest. (Consequence: edits to such a file re-flag the artifact — correct,
  since its safety blocks are in the output.)
- `content_digest` — fingerprint of the *output*: SHA-256 over the artifact
  payload, defined as every byte **after** the header terminator line
  (`-->` + one `\n`) to EOF, canonicalized per section 7. The header is
  excluded from its own digest, so the digest is computable before the header
  is written.
- `note` — fixed human-facing warning string; ASCII only (no typographic
  dashes) so the header survives naive encoding round-trips.

The header is deliberately redundant with the visible notice line (section 4):
the comment is for machines (`--check`, `status`), the blockquote is for the
human who opens the file. Both ship in every target.

**Block-level provenance is on-demand, never persisted.** The header records
only the two *file-level* digests above (`source_digest` over included files,
`content_digest` over the whole payload). The per-block manifest —
`source_file` / `source_block_index` / `source_block_digest` / `rendered_digest`
/ `emitted_index` / `section` / `forced` for each emitted block — is recomputed
from the sources only when a reader asks for it (`emit --check --explain
--format json --block-manifest`, W2 §7.4). It is **not** a header field and
**not** a sidecar file: persisting a second source of truth is the same
`config/manifest file` non-feature ruled out in section 1, and adding a header
field would change the artifact bytes and force an `emit_version` bump. Because
the manifest derives from the same `(canonicalized source bytes, target,
profile, emit_version)` inputs as the artifact, it inherits the section 7
determinism guarantee for free. A future **block-level reconcile** (patching
only the drifted blocks rather than rewriting the whole artifact) will consume
this same manifest; until then `--reconcile` stays file-level.

## 7. Determinism guarantee

**Guarantee:** emitted artifact bytes are a pure function of
`(canonicalized included source bytes, target id, profile, emit_version)`.
Two runs with equal inputs produce byte-identical files on any OS, at any
time, in any locale. Therefore every artifact is hashable and the digests in
section 6 are stable.

Canonicalization (applied to source content before parsing/digesting, and to
artifact payloads before digest comparison):

1. Strip a leading UTF-8 BOM if present.
2. Normalize `\r\n` → `\n` (the block parser already does this; emit and
   `--check` apply it everywhere bytes are hashed or compared).
3. No other transformation — no trim, no Unicode normalization, no reflow.

Output rules: UTF-8, `\n` line endings, exactly one trailing newline at EOF.

Prohibited inputs — the emit path must never read or embed:

- wall-clock time (no `generatedAt`; this is an intentional difference from
  the live context pack, whose `generatedAt` timestamp would break
  reproducibility),
- machine identity, usernames, absolute paths, environment variables,
- locale/collation (all ordering is `SOURCE_FILES` order + source block
  order; no string sorting),
- randomness, and
- network or model calls (principle 1).

W3's guard tests must include a double-emit byte-equality test and the
backward-compat test that all existing commands' output is untouched.

## 8. Drift detection — emit --check

`emit --check` writes nothing. For each target in the check set (default: all
v1 targets; `--target` restricts) it classifies the artifact:

1. **Read** the artifact file. Absent → `MISSING`.
2. **Parse** the header (section 6). No header block / unparseable / missing
   required keys → `UNMANAGED` (covers pre-existing hand-written files and
   files whose header someone deleted).
3. **Hand-edit check:** compute the digest of the actual payload (bytes after
   the header, canonicalized). If it differs from the header's
   `content_digest` → `HAND-EDITED`. This check runs first so the operator
   gets the right message: the artifact disagrees *with itself*, independent
   of whether sources also moved.
4. **Staleness check:** recompile in memory using the header's `target` and
   `profile` and the current `emit_version`, producing expected artifact
   bytes (header included). If the header's `emit_version` differs from the
   current one, or the expected bytes differ from the canonicalized file
   bytes → `STALE`. (This single byte comparison subsumes comparing
   `source_digest`: any source change to an included file changes the
   recompiled header, hence the bytes.)
5. Otherwise → `OK`.

Classifications are mutually exclusive and checked in the order above; every
target gets exactly one. A broken ontology (compile error during step 4)
fails the whole check with the underlying compile error from
[cli-errors.md](cli-errors.md) — fail closed, no partial verdict.

**Exit code:** `0` iff every checked target is `OK`; otherwise `1`. This is
the CI gate, and per the operator's ruling it **fails** the build — there is
no warn mode and no flag that converts drift to a warning. The only
configuration is *which targets are checked* (`--target`).

**Text output** (stdout), one line per target plus a summary:

```text
OK           AGENTS.md (agents-md, profile default)
STALE        CLAUDE.md (claude-md) - sources changed since last emit; run: mind-ontology emit --target claude-md
DRIFT - 1 of 2 targets need attention
```

Per-class operator guidance (final wording is a W2 error-catalog row; the
required content is normative here):

| Class | Message must say | Next safe action |
|---|---|---|
| `MISSING` | artifact has never been emitted (or was deleted) | `mind-ontology emit --target <id>` |
| `UNMANAGED` | file exists but is not managed by emit; **emit will not touch it without `--force`** | move hand-written content into `.agentctx/` source blocks, then `mind-ontology emit --force --target <id>` |
| `HAND-EDITED` | the file was edited after generation; hand edits will be **lost** on re-emit | port the hand edits into `.agentctx/` (that is where meaning lives), then re-emit; diff hint: `git diff <artifact>` |
| `STALE` | `.agentctx/` changed (or emit_version bumped) since last emit | re-run `mind-ontology emit` |

**JSON output** (`--format json`, exact shape locked in W2): an object with
`targets: [{ target, path, status, detail }]` and `ok: boolean`, mirroring the
text classification 1:1 so CI annotations and the `status` screen consume the
same data. The `status` command's "emitted-target freshness" section (W7) is
defined as exactly this check's result — in v1 the emitted headers *are* the
manifest; no separate manifest file exists (see W2 handoff).

**CI recipe** (documented in this doc per the W4 ADL): see section 12 for the
GitHub Actions step with exit-code branching and the optional pre-commit
variant. Repos using markdown formatters must exclude the artifact paths
(e.g. in `.prettierignore`) — a formatter rewrite is, by design,
indistinguishable from a hand edit.

## 9. Edge cases

- **Pre-existing hand-written AGENTS.md / CLAUDE.md (first emit).** `emit`
  refuses and exits `1`: the file exists and has no emit header
  (`UNMANAGED`). It is **never silently overwritten and never merged** —
  merge would make output depend on the artifact's prior state, destroying
  determinism, and a hand-written file is exactly the meaning that belongs in
  `.agentctx/`. The error message tells the user to move the content into
  source blocks and re-run with `--force` to overwrite. `--force` is the only
  way emit replaces an unmanaged file; replacing a *managed* (headered) file
  needs no flag — that is the normal refresh path, including over a
  `HAND-EDITED` artifact (the header's presence is the user's standing
  consent; `--check` is the tool that catches unintended edits first).
- **Partial / section-level emit: rejected for v1.** The unit of emit is the
  whole target artifact; `--target` selects *which artifacts*, never which
  sections. A section-level emit would reintroduce intra-file hand-sync (some
  sections generated, some hand-owned), which is the exact drift disease this
  feature exists to cure, and `content_digest` covers the whole payload so a
  partially-owned file can never verify. A repo wanting a hand-written
  preamble plus compiled content should put the preamble in `.agentctx/`
  sources. Revisit only with a concrete user case (logged for the operator,
  section 11).
- **CRLF working trees.** Git `autocrlf` may check the artifact out with CRLF
  line endings. Canonicalization (section 7) makes `--check` immune; emitted
  files are written LF. The W1 doc's CI recipe recommends a `.gitattributes`
  line (`AGENTS.md text eol=lf`, same for `CLAUDE.md`) to keep working trees
  byte-stable too.
- **Minimal ontology.** Only `constraints.md` present → the artifact is
  frame + Constraints section only. Valid, `OK` under `--check`. Empty or
  missing `constraints.md` → the standard compile errors from
  [cli-errors.md](cli-errors.md); nothing is written.
- **emit_version bump.** After upgrading the package, `--check` reports every
  previously-emitted artifact `STALE` (version mismatch) until re-emitted —
  intended: the freshness contract covers the generator, not just the
  sources.
- **Two targets, one repo, divergent freshness.** Each target is classified
  independently; `emit` always rewrites every requested target (rewriting a
  fresh artifact is a byte-identical no-op, so it is safe and keeps the
  command idempotent).

## 10. Handoff to W2 (CLI surface spec)

W2 must specify, consuming this document as ground truth:

1. **Flag surface for `emit`:** `--target <id>` (repeatable or CSV),
   `--check`, `--force`, `--full`, `--format text|json`, `--cwd <path>`;
   defaults per section 2. Plus `mind-ontology emit --help` text.
2. **Error catalog rows** in [cli-errors.md](cli-errors.md) for: unknown
   target id, `UNMANAGED` refusal without `--force`, compile errors
   passing through, `--check` drift classes (section 8 table), and the
   budget-overflow warning (stderr, exit 0).
3. **Exit-code contract:** `0` success/fresh; `1` error or drift. W2 decides
   whether drift gets a distinct exit code from hard errors (CI consumers may
   want to distinguish "re-emit needed" from "ontology broken"); this spec
   only requires non-zero for both.
4. **`--format json` shapes** for `emit` (written targets + digests) and
   `emit --check` (section 8), locked so W7's `status` can embed the check
   result verbatim.
5. **Target registry sync test** (the W1 guard): parse the section 2 table,
   assert ids/paths match the engine's registry constant once W3 lands;
   spec-level placeholder until then.
6. **Explicit v1 non-features to document as such:** no config/manifest
   file, no per-repo path overrides, no profile editing, no section-level
   emit, no warn-only mode. Each needs a one-line "why" so W2's doc doesn't
   silently re-open them.
7. **`status` integration note:** emitted-target freshness = the `--check`
   JSON, headers-as-manifest (no new state file).

## 11. Open questions for the operator

Defaults are picked and specified above; these are flagged because they are
product calls an implementer should not lock in silently:

1. **Default profile contents** (section 3): static targets include
   `constraints` + `identity` + `direction` + `agent-roles` in full, and
   exclude `projects` / `decisions` / `architecture` / `glossary` / `cq`
   (live MCP path covers those). Confirm or adjust the split.
2. **Budget policy** (section 3): 400-line soft budget, warn-only. Should any
   overflow ever hard-fail (e.g. a `--strict` flag in W3+)?
3. **Artifact paths** (section 2): fixed at `--cwd` root (`AGENTS.md`,
   `CLAUDE.md`). Acceptable for v1, or is a path override needed before W3
   freezes golden files?
4. **Section-level emit** (section 9): rejected for v1 with rationale; any
   known user case that should reverse this before W3?

## 12. CI recipe (W4)

**The promise.** A static instruction file is only trustworthy if it provably
matches its sources, and the only way that property survives contact with a
team is to make its violation a build failure. That is the core promise this
product makes about emitted artifacts: **drift fails CI.** There is no warn
mode and no flag that downgrades drift (operator ruling Q7, section 8); the
moment `.agentctx/` and a committed `AGENTS.md` / `CLAUDE.md` disagree, the
gate goes red and stays red until someone re-emits — so the artifact an agent
reads is never silently older, or stranger, than the meaning the operator
curated. A context file you cannot trust is worse than none; the CI gate is
what upgrades "generated once" to "guaranteed current".

`emit --check` uses the three-way exit-code split ratified in the
[W2 CLI spec](workbench-w2-cli-spec.md) §2.4: `0` = every checked target
fresh, `1` = drift (the fix is mechanical: re-emit and commit), `2` = hard
error (broken ontology or invocation — needs a human, not a re-emit). Naive
CI that treats any non-zero exit as failure is already correct; the branching
below just gives operators the right next action in the log.

**GitHub Actions step** (any CI runs the same two commands — install, then
check):

```yaml
jobs:
  ontology-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Verify emitted artifacts are fresh
        run: |
          set +e
          npx mind-ontology emit --check
          code=$?
          set -e
          if [ "$code" -eq 1 ]; then
            echo "::error::AGENTS.md / CLAUDE.md drifted from .agentctx/." \
                 "Fix: run 'mind-ontology emit', commit the refreshed artifacts."
          elif [ "$code" -eq 2 ]; then
            echo "::error::emit --check could not produce a verdict" \
                 "(broken ontology or bad invocation) - fix the ontology, not the artifacts."
          fi
          exit "$code"
```

Treat exit `2` as an infrastructure failure, not a drift signal: re-emitting
cannot fix it, and a red gate with a "re-emit" hint would send the operator
to the wrong tool. The check writes nothing (section 8), so the step needs no
working-tree cleanup and is safe to run on any ref.

**Pre-commit hook** (optional, local-only — CI remains the enforcement
layer; the hook just shortens the feedback loop):

```sh
#!/bin/sh
# .git/hooks/pre-commit — optional adoption, chmod +x
npx mind-ontology emit --check
code=$?
if [ "$code" -eq 1 ]; then
  echo "emit drift: run 'mind-ontology emit' and stage AGENTS.md / CLAUDE.md" >&2
fi
exit "$code"
```

Working-tree hygiene that keeps both layers byte-stable: the
`.gitattributes` lines from section 9 (`AGENTS.md text eol=lf`, same for
`CLAUDE.md`) and the formatter exclusions from section 8
(e.g. `.prettierignore`).
