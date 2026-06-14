# Next Lanes

Candidate standalone Mind Ontology lanes after the M1–M40 hardening pass. Every
candidate is **safe by construction**: docs/schema/tests only, local-first, no
deploy, no migration, no secrets, no live data, no hosted SIRT write. Each is one
bounded, reviewable lane.

> Engine code (`scripts/**`, `src/**`) is treated as read-only in the hardening
> lanes; candidates that need engine changes are marked **[engine]** and must be
> done in a lane that has write access to the compiler, with backward-compat tests.

## Shipped since this list was written

Every "ready to pick up" candidate below has since landed. This section is kept
truthful so the backlog cannot send anyone to re-do finished work; each item
names the tests/docs that now own it.

1. **Deeper CQ regression suite** — shipped. `tests/unit/cq-regression-table.test.mjs`
   (M55, per-CQ file presence) and `tests/unit/cq-regression-deep.test.mjs` (each CQ
   resolves from its named source blocks + cq.md sync guards).
2. **Richer local examples** — shipped. `docs/examples/team-ontology/`,
   `docs/examples/solo-founder-ai-os/`, and `docs/examples/studio-multi-client/`
   (multi-client isolation), each exercised by an `example-*-ontology` /
   `example-*-multi-client` test.
3. **Doc audit tooling expansion** — shipped. `#anchor` and `npm run` citation
   audits in `tests/unit/doc-anchor-audit.test.mjs` (M46); cited `node scripts/...`
   paths in `tests/unit/doc-script-command-audit.test.mjs`.
4. **MCP setup fixture validation** — shipped. `tests/unit/mcp-setup-fixtures.test.mjs`
   (M43; every `docs/agentctx-setup/` config parsed against one manifest, two-tool
   surface pinned, directory-completeness guarded) + `http-endpoint-openapi-consistency`.
5. **CLI error-UX catalog** — shipped. `docs/cli-errors.md` +
   `tests/unit/cli-error-ux-catalog.test.mjs` / `cli-error-ux.test.mjs`.
6. **Schema authoring guide** — shipped. `docs/schema-authoring.md` +
   `tests/unit/schema-authoring-guide.test.mjs`.
7. **Release packaging dry-run docs** — shipped. `docs/packaging.md` +
   `tests/unit/packaging-dry-run-contract.test.mjs` / `packaging-plan.test.mjs` /
   `package-metadata.test.mjs`.

## Autopilot Integration Pack (shipped in this lane)

The [Autopilot Integration Pack v1](docs/mind-ontology-autopilot-pack-v1.md) makes
Mind Ontology consumable by autonomous AI development lines — local-first, no
hosted SIRT. Shipped here (docs/tests/fixtures/templates only):

- Pack frame, [reading protocol](docs/mind-ontology-autopilot-reading-protocol-v1.md),
  [stop policy](docs/mind-ontology-autopilot-stop-policy-v1.md), and
  [adoption walkthrough](docs/mind-ontology-autopilot-adoption-v1.md).
- Drop-in `templates/mind-ontology/autopilot/` blocks and MCP configs.
- A compiler-backed `tests/fixtures/autopilot-line/` ontology, an autopilot CQ
  regression, and a machine-readable stop-policy decision table.

The pack has since grown to ~20 cross-linked docs (concepts, failure modes,
risk modes, controller checklist, worker self-check, scope discipline, checkpoint
cadence, portability, two-tool contract and rationale, connector parity, manifest,
and more), three example fixtures (`autopilot-line/` nine-file, `autopilot-roles/`,
`autopilot-minimal/`), a full drop-in kit, and pack/kit-completeness guards. Earlier
follow-on ideas (wrong-axis corpus, result-pack shape guard, multi-agent role
matrix) are all shipped.

Follow-on autopilot lanes — all shipped (docs/tests only):

- **Trust-model tie-in** — shipped. `docs/mind-ontology-autopilot-trust-tie-in-v1.md`
  + `tests/unit/autopilot-trust-tie-in.test.mjs` (and the broader
  `agentctx-trust-security-model` / `trust-security-enforcement` tests).
- **Operator FAQ** — shipped. `docs/mind-ontology-autopilot-operator-faq-v1.md` and
  the contributor FAQ, each with an `autopilot-*-faq` test.
- **Deeper compiler-backed retrieval guards** — shipped as the deep CQ regression
  (`tests/unit/cq-regression-deep.test.mjs`) and the multi-client example's scoping
  and isolation assertions.

## Engine lanes — shipped / status

- **[engine]** `--format` compact pack — shipped. `--format compact` renders the
  answer blocks only (no metadata/omitted), guarded by
  `tests/unit/compile-format-compact.test.mjs`; markdown/json paths unchanged.
- **[engine]** richer scoring signals — heading weight **shipped** as opt-in
  `--rich-scoring` (default-off, byte-for-byte legacy ranking otherwise), guarded by
  `tests/unit/compile-rich-scoring.test.mjs`. **Recency is still open** and parked:
  blocks carry no reliable per-block date signal to rank on, so it needs a data
  decision before it can ship without guesswork.
- **[engine]** the `mind-ontology` CLI wrapper — shipped. `scripts/agentctx/cli.mjs`
  is the product `bin`, a thin verbatim dispatcher over the `agentctx:*` scripts
  (which stay intact, backward compatible), guarded by `tests/unit/cli-wrapper.test.mjs`.
  The new compile flags above flow through it verbatim.
- **[engine]** budget-aware compaction — shipped. `--max-tokens <n>` fits the pack
  inside a rough token budget by principled selection (constraints always kept,
  risk-forced safety next, then a source-priority order), not truncation; over-budget
  blocks move to omitted with reason `budget`, and the mandatory-only-overrun case is
  flagged. Opt-in/additive (unset = byte-for-byte legacy), guarded by
  `tests/unit/compile-budget.test.mjs`.

Genuinely open after this campaign: scoring **recency** (needs a date-signal design),
and any further additive `--format`/scoring extensions as the product grows.

## New direction — ontology library + router (layer ①)

Beyond the hardening backlog, a strategy dialogue opened the product's next axis: a
**library of many ontologies (boxes), routed deterministically**. The compiler already
picks the right *blocks* within one box (layer ②) and fits them to a token budget
(layer ③, `--max-tokens`); the router adds layer ① — pick the right *box* for a task
out of many, before compiling.

Shipped (MVP): each box declares `.agentctx/manifest.json` (`id`, `name`, `triggers`,
`scopes`, optional `excludeTerms`); `scripts/agentctx/router.mjs` scores a task against
those signatures (verbatim trigger match, so it handles non-English terms) and picks one
box deterministically, never blending — close calls are flagged `ambiguous` with ranked
candidates + reasons. `route --library <dir>` and `compile --library <dir>` (route then
compile) expose it; the MCP two-tool contract is untouched. Guarded by
`tests/unit/router.test.mjs`; backward compatible (no `--library` = unchanged).

Open follow-on: route inside the MCP `get_context` when a library is configured; manifest
auto-derivation from existing sources; a `doctor` health check over a library.

## Never in this product (hosted/closed boundary)

Memory graph storage, vector retrieval, typed-edge inference execution, writeback
execution, tenant storage, hosted auth, autonomous controller/runner internals,
deploy/wrangler config, and any live SIRT write. These stay in hosted SIRT behind
the adapter contracts.
