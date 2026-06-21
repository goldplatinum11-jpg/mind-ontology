# Mind Ontology — Workbench v1 Design Packet

**Status:** design record · Workbench v1 CLI implementation is shipped
(`status`, `preview`, `cq`, `emit`, `review`)
**Scope:** this document records the Workbench design and original ADL
decomposition. The implementation now lives under `scripts/agentctx/` and is
guarded by the W3-W10 test suites. It still ships no deploy and no secret.

This packet contains three deliverables:

- **Part A — Workbench v1 design** (users, surfaces, engine connection points,
  OSS↔paid boundary including the AGENTS.md compile-target strategy).
- **Part B — implementation ADL decomposition** (session-sized, dependency-ordered).
- **Part C — open questions for the operator** (decisions only Kei can make).

## Current implementation status

The Workbench v1 CLI track has landed:

- `scripts/agentctx/emit.mjs` — W3/W4 emit, drift check, reconcile, and
  block-level provenance.
- `scripts/agentctx/preview.mjs` — W6 pack preview over the W5 explain tuple.
- `scripts/agentctx/status.mjs` — W7 health roll-up over validate, metrics, CQ,
  and emit freshness.
- `scripts/agentctx/cq.mjs` / `scripts/agentctx/cq-core.mjs` — W8
  competency-question answerability.
- `scripts/agentctx/review.mjs` / `scripts/agentctx/result-pack.mjs` — W9
  Result Pack shape review.

The table in Part B is retained as the implementation history and dependency
map. It is no longer the active backlog for W1-W10.

---

## Part A — Workbench v1 design

### A1. What the Workbench is

The engine (`agentctx` compiler + MCP server) is **agent-facing**: agents call
`get_context(task)` / `list_constraints()` and act. Today the **human** side of
the product — the person who curates the ontology, checks what agents actually
see, and verifies the CQ contract — works with raw npm scripts and reads JSON
by hand.

The **Workbench** is the human-facing operator surface over the same engine:

```text
.agentctx/ source files
   ├─→ agentctx compiler ─→ get_context / list_constraints ─→ agents   (engine, shipped)
   └─→ the same compiler ─→ Workbench views & emitted artifacts ─→ the operator  (this design)
```

It is **not** a second implementation of the ontology. Every Workbench view is
a thin presentation over the existing compile/validate/metrics modules — the
same "thin transport, unchanged core" rule the
[thin connector strategy](mind-ontology-thin-connector-strategy-v0.md) already
established for hosted clients.

Three product jobs, in priority order:

1. **See what the agent sees.** Preview a compiled pack for a task, with
   provenance: which source file and heading each block came from, why it was
   included (score, constraint, risk-forced).
2. **Trust the ontology's health.** One status view that aggregates validate,
   metrics, CQ answerability, and staleness — instead of four separate scripts.
3. **Distribute the meaning everywhere.** Emit static per-tool artifacts
   (`AGENTS.md`, `CLAUDE.md`, Cursor rules) as **compile targets**, and detect
   when they drift from the source (see A5).

Explicit non-goals for v1:

- **Not an editor.** Ontology files are edited in the user's editor and reviewed
  in PRs — that is a feature (the trust story), not a gap.
- **Not a hosted dashboard.** Everything runs locally over local files.
- **Not an agent runner.** The Workbench never executes tasks; the
  [Autopilot Pack](mind-ontology-autopilot-pack-v1.md) covers agent-side
  operation and stays unchanged.

### A2. Target users

| User | Situation | What the Workbench gives them |
|---|---|---|
| **Solo operator** (primary) | One person driving several AI agents (Claude Code, Codex, Cursor, chat clients) off one `.agentctx/` | a single `status` view; pack preview before trusting an agent with a risky task; one `emit` instead of N hand-synced instruction files |
| **Team ontology maintainer** | Curates a shared `.agentctx/` in a repo; reviews ontology PRs | pack preview as a review tool ("what changes in what agents see?"); drift check in CI; CQ verification as the merge gate |
| **Autopilot controller** | Human in the controller role of the [two-roles model](mind-ontology-autopilot-two-roles-v1.md), reviewing worker Result Packs | one place to re-run gates and inspect the Result Pack against the [stop policy](mind-ontology-autopilot-stop-policy-v1.md) |
| **Evaluator** | Deciding whether to adopt Mind Ontology at all | `init` → `status` → `preview` is a self-explanatory 5-minute tour with no MCP wiring required |

Non-targets: end users of the agents (they never see the Workbench), and
multi-tenant/enterprise administration (hosted SIRT concern, out of this repo).

### A3. Core screens and CLI surface

**v1 is CLI-first.** Every screen is a CLI subcommand with `--format text|json`
(JSON for CI and controllers, text for humans). A local read-only web view is
deliberately deferred behind an open question (Part C, Q1) — the CLI versions
of the same screens are the contract either way.

The Workbench extends the existing [`mind-ontology` CLI](mind-ontology-cli-v0.md)
with new subcommands, same thin-dispatcher pattern, all existing commands
untouched:

| Screen | Command | What it shows | Built on |
|---|---|---|---|
| **Status** | `mind-ontology status` | one health roll-up: schema validity, per-file block counts, CQ answerability summary, pack-focus metrics for representative tasks, emitted-target freshness | `schema.mjs` + `metrics.mjs` + the CQ check + the emit manifest |
| **Pack preview** | `mind-ontology preview --task "…" [--scope s] [--risk r]` | the compiled pack **with provenance per block**: source file, heading, score, inclusion reason (`constraint` / `scored` / `risk-forced`) | `compile.mjs` with an additive `--explain` output |
| **CQ verification** | `mind-ontology cq [--id n]` | each competency question, whether the compiled pack answers it, and from which blocks — the [CQ schema](mind-ontology-cq-schema-v0.md) made operational | compile + the CQ source file |
| **Emit** | `mind-ontology emit [--target agents-md\|claude-md\|cursor] [--check]` | generates per-tool static artifacts from the ontology; `--check` exits non-zero when an emitted artifact is stale (drift gate for CI) | compile + a per-target template (A5) |
| **Result Pack review** | `mind-ontology review --pack <path>` | validates a worker [Result Pack](mind-ontology-autopilot-result-pack-v1.md) against its shape and the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md), and prints the guard tests to re-run | the existing Result Pack shape guard logic |

Design rules for all screens:

1. **Read-only by default.** Only `emit` (without `--check`) writes, and only
   the declared target artifacts. No screen ever edits `.agentctx/` sources.
2. **Same engine, no parallel logic.** Each command calls the same modules the
   npm scripts run (`compile.mjs`, `schema.mjs`, `metrics.mjs`, `risk.mjs`).
   Anything the Workbench needs that the engine lacks (e.g. per-block explain
   data) is added to the engine additively, never re-derived in the Workbench.
3. **Stable, actionable errors.** Every failure mode gets a row in
   [`cli-errors.md`](cli-errors.md) and a guard test, matching the existing
   error-UX discipline.
4. **Fail closed.** A broken ontology fails `status` loudly; `emit --check`
   fails CI on drift; no command degrades to a partial silent answer.

### A4. Connection points to the existing engine

| Engine piece (today) | Workbench use | Change needed |
|---|---|---|
| `compile.mjs` (compileFromCwd) | every screen compiles through it verbatim | **[engine]** additive `--explain` flag exposing per-block `{ sourceFile, heading, score, reason }` — output without the flag stays byte-for-byte identical |
| `schema.mjs` (validate) | `status` embeds validation results | none — consumed as-is |
| `metrics.mjs` | `status` embeds pack-focus metrics | none — consumed as-is |
| `risk.mjs` | `preview` shows the detected risk mode and which blocks were risk-forced | none for detection; forced-block attribution rides on `--explain` |
| `init.mjs` / `templates/mind-ontology/` | the evaluator path: `init` → `status` → `preview` | none |
| `cli.mjs` dispatcher | new subcommands registered in the same table | **[engine]** additive rows only; all `agentctx:*` scripts keep working unchanged |
| `mcp-server.mjs` (two-tool surface) | **untouched.** The agent-facing surface stays exactly `get_context` + `list_constraints` ([two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md)). The Workbench is human-facing and may use internal modules directly, but never widens the MCP surface | none |
| Result Pack shape guard | `review` reuses the shape rules the existing guard test encodes | **[engine]** extract the shape check into a callable module the test and the CLI share |
| [Thin connector](mind-ontology-thin-connector-strategy-v0.md) | unchanged; hosted clients still get the two read operations only | none |

The boundary invariant: **agents keep the narrow two-tool contract; the
operator gets the wide view.** Nothing the Workbench adds is reachable by an
agent through MCP.

### A5. OSS ↔ paid boundary — including AGENTS.md as a compile target

The standing rule from
[commercial positioning](mind-ontology-commercial-positioning-v0.md): *anything
local and file-based is free; anything that requires running a service, storing
data, or isolating tenants is the hosted layer.* Three options were considered
for where the Workbench sits.

**Option A — Workbench fully OSS, boundary unchanged.** All screens are local
and file-based, so by the standing rule they are free. Paid stays what it is
today: hosted memory, retrieval enrichment, writeback execution, multi-tenant.
Simple, honest, no new wedge.

**Option B — AGENTS.md as a compile target (the distribution-surface
strategy).** Today the docs *argue against* static instruction files
([vs instruction files](mind-ontology-autopilot-vs-instruction-files-v1.md)):
they load everything every run and drift apart per tool. Option B inverts the
relationship instead of fighting it: **static files stop being a competitor and
become a build artifact.** `mind-ontology emit` compiles the ontology into
per-tool surfaces:

```text
.agentctx/  ──compile──►  AGENTS.md        (Codex)
                          CLAUDE.md        (Claude Code)
                          .cursor/rules    (Cursor)
                          paste-block.md   (ChatGPT / Claude.ai project instructions)
```

Each emitted artifact carries a generated-file header (`generated by
mind-ontology emit — do not hand-edit; source: .agentctx/`) plus a source
fingerprint, so `emit --check` can detect drift and CI can enforce freshness.

Why this is the strongest adoption wedge available:

- **Zero-MCP on-ramp.** Today the minimum viable adoption is "wire an MCP
  server". With emit, the minimum is "run one command, get a better AGENTS.md
  than you'd write by hand" — value before any agent config changes. MCP
  becomes the *upgrade* (task-scoped, live), not the entry fee.
- **It fixes the drift problem users already have.** N hand-synced instruction
  files is the README's opening pain. Emit solves it mechanically even for
  users who never adopt MCP.
- **It makes the message stronger, not weaker.** "Stop *hand-writing*
  AGENTS.md; compile it" is a sharper pitch than "stop using AGENTS.md".

Known risks, with mitigations:

- *Static targets lose task-scoping* — the compiler's core advantage. Mitigate:
  each target compiles a named **profile** (scope + budget defined per target),
  not the whole brain; the header states that the live MCP path is richer.
  Whole-ontology dump stays an explicit opt-in flag.
- *Positioning whiplash* — docs that argue against static files must be updated
  to "static files as *targets*, not *sources*" in the same change that ships
  emit messaging (Part C, Q3).
- *Hand-edit erosion* — users editing the artifact instead of the source.
  Mitigate: the do-not-hand-edit header, fingerprint mismatch flagged by
  `emit --check` and surfaced in `status`.

**Option C — Workbench (or emit) as the paid layer.** Rejected. Both are local
and file-based, so charging for them breaks the standing boundary rule and the
no-crippleware honesty commitment. A paid local feature would also poison the
trust story that *is* the product.

**Recommendation: A + B.** The Workbench and the emit targets are OSS. The
boundary line does not move — it gets a cleaner articulation:

| | Free OSS (Workbench + engine) | Hosted / paid (SIRT) |
|---|---|---|
| Compile & serve context | local MCP, two tools | retrieval-enriched context |
| Distribute meaning | `emit` to local static targets, drift check | team-wide distribution: shared ontology sync across machines/members, org policy overlays |
| Verify | `status` / `cq` / `review`, local CI gates | fleet observability across many repos/operators |
| Memory | files you own | durable shared memory + writeback execution |

The paid layer's distribution story ("every teammate's agents compile from the
same synced ontology") becomes a natural extension of the free emit feature,
not a fence around it.

---

## Part B — Implementation ADL decomposition

Each ADL is one session-sized [atomic development loop](mind-ontology-autopilot-concepts-v1.md):
inspect → artifact → guard test → focused tests green → continue. Docs-only
ADLs can run in the current lane class; **[engine]** ADLs need a lane with
`scripts/**` write access and must keep default output byte-for-byte stable
with backward-compat tests (the standing rule in [`NEXT-LANES.md`](../NEXT-LANES.md)).

Dependency order (W1→W2 are pure docs and unblock everything; W3 is the engine
keystone):

| ADL | Lane class | Artifact | Guard test | Depends on |
|---|---|---|---|---|
| **W1 — emit-target spec** | docs | `mind-ontology-emit-targets-v0.md`: target registry (agents-md / claude-md / cursor / paste-block), per-target profile (scope, budget), generated-file header + fingerprint format, `--check` exit-code contract | doc added to link/anchor audits; a spec-consistency test asserting the doc's target table stays in sync with the (future) target registry constant | — |
| **W2 — Workbench CLI surface spec** | docs | `mind-ontology-workbench-cli-v0.md`: command map for `status` / `preview` / `cq` / `emit` / `review`, `--format` contract, new rows for [`cli-errors.md`](cli-errors.md) | error-catalog consistency test extended to the new rows (spec-level until W3 lands) | W1 |
| **W3 — `emit` engine + golden files** | **[engine]** | `emit.mjs` (new, under `scripts/agentctx/`) + `emit` wired into `cli.mjs`; emits agents-md + claude-md from the template ontology | golden-file tests per target over `templates/mind-ontology/`; backward-compat test: all existing commands byte-for-byte unchanged | W1, W2 |
| **W4 — drift check** | **[engine]** | `emit --check`: fingerprint comparison, non-zero exit on stale/hand-edited artifact; CI recipe documented in the W1 doc | tests: fresh→0, stale→non-zero, hand-edited→non-zero with actionable message | W3 |
| **W5 — compiler `--explain`** | **[engine]** | additive explain output in `compile.mjs`: per-block `{ sourceFile, heading, score, reason }` | determinism test for explain output; byte-for-byte test that non-explain output is untouched | — (parallel to W3) |
| **W6 — `preview` command** | **[engine]** | `preview` in `cli.mjs` rendering the explain pack (text + json), risk mode and risk-forced blocks highlighted | snapshot test on the template ontology; error-UX rows from W2 asserted | W2, W5 |
| **W7 — `status` command** | **[engine]** | `status` aggregating validate + metrics + CQ answerability + emit freshness into one report (text + json) | test: each section sourced from its engine module; broken-ontology fixture fails loudly; json shape locked | W3, W6 |
| **W8 — `cq` command** | **[engine]** | `cq` rendering per-CQ answerability with contributing blocks | table-driven test over `tests/fixtures/` example ontologies, extending the existing CQ regression suite | W5, W7 |
| **W9 — `review` command** | **[engine]** | Result Pack shape check extracted into a shared module; `review` validates a pack file and prints the controller checklist verdict | existing shape-guard test rewired through the shared module (no behavior change) + CLI-level test on the example pack fixture | W2 |
| **W10 — positioning & docs integration** | docs | README + [docs index](mind-ontology.md) + [commercial positioning](mind-ontology-commercial-positioning-v0.md) updated: emit as compile-target strategy, "static files as targets, not sources" reframe across the vs-instruction-files docs | doc link/anchor/script audits stay green; README claims cross-checked against shipped commands | W3, W4 (and Q3 approved) |

Critical path: **W1 → W2 → W3 → W4 → W10** (the emit wedge end-to-end).
**W5 → W6 → W7 → W8** is the inspection track and can interleave; **W9** is
independent after W2. W1 and W2 are safe to start immediately in a docs lane;
no engine ADL starts until Q6 (Part C) opens an engine-write lane.

---

## Part C — Open questions for the operator (Kei)

Decisions that change the build order or the public posture — engineering picks
defaults below, but these calls are the operator's.

1. **v1 surface: CLI-only, or CLI + local web view?**
   Recommendation: CLI-only for v1; every screen's `--format json` is designed
   so a later `serve` (local, read-only) is a pure renderer. A web view added
   now roughly doubles v1 scope for zero new capability.

2. **Is `emit` (AGENTS.md compile target) OSS?**
   By the standing boundary rule (local + file-based = free) it must be — but
   it is also the strongest adoption wedge, so this is a deliberate business
   call, not a default. Recommendation: OSS. The paid counterpart is *team
   distribution* (synced shared ontology), which the rule already places on the
   hosted side.

3. **Approve the positioning reframe?** Several shipped docs argue *against*
   static instruction files; the emit strategy reframes them as compile
   targets. This touches the public README and the vs-instruction-files
   message. Recommendation: approve, ship the reframe atomically with W10 —
   half-updated messaging is worse than either position.

4. **Which emit targets are v1?** Recommendation: `AGENTS.md` + `CLAUDE.md`
   first (highest-traffic, simplest format), Cursor rules and the
   ChatGPT/Claude.ai paste-block in a fast-follow ADL once the golden-file
   pattern is proven.

5. **Branding: is "Workbench" a named surface, or just new CLI verbs?**
   `mind-ontology status` needs no brand to work. Recommendation: keep
   "Workbench" as the *internal design name* only; introduce it publicly only
   if/when a `serve` UI exists for it to name.

6. **When does the engine-write lane open?** W3–W9 are **[engine]** and the
   current lane class is docs/tests-only. The packet is sequenced so W1+W2 can
   ship as docs lanes immediately; nothing else moves without this call.

7. **Drift policy: should `emit --check` fail CI or warn?** Recommendation:
   fail (it is the whole point of the freshness contract), with a documented
   escape hatch for repos that intentionally hand-tune one target.

8. **Result Pack `review` scope:** validate shape only (cheap, v1) or also
   re-run the named guard tests automatically (slower, more trust)?
   Recommendation: v1 validates shape and *prints* the guard-test commands;
   auto-run is a later flag.
