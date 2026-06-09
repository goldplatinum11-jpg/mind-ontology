# Next Lanes

Candidate standalone Mind Ontology lanes after the M1–M40 hardening pass. Every
candidate is **safe by construction**: docs/schema/tests only, local-first, no
deploy, no migration, no secrets, no live data, no hosted SIRT write. Each is one
bounded, reviewable lane.

> Engine code (`scripts/**`, `src/**`) is treated as read-only in the hardening
> lanes; candidates that need engine changes are marked **[engine]** and must be
> done in a lane that has write access to the compiler, with backward-compat tests.

## Ready to pick up (docs + tests only)

1. **Deeper CQ regression suite** — table-driven tests that compile the template
   and assert each competency question is answerable from the named source files
   (e.g. the `#scope` CQ surfaces `projects.md`/`direction.md` blocks). Locks the
   "CQs are the verification core" promise against drift.
2. **Richer local examples** — a second worked `.agentctx/` example folder under
   `docs/examples/` (a non-trivial multi-project ontology) plus a test that
   compiles it and checks scoping/metrics, so examples can't rot.
3. **Doc audit tooling expansion** — extend `doc-link-audit` to also flag (a)
   headings referenced by `#anchor` links that don't exist, and (b) cited
   `npm run <script>` commands that aren't in `package.json`.
4. **MCP setup fixture validation** — golden-file tests that parse every config
   under `docs/agentctx-setup/` and assert it launches the same server entry with
   the two-tool surface (extend `connector-surface-thin`).
5. **CLI error-UX catalog** — a doc + tests cataloguing every CLI failure mode
   (missing task, bad `--format`, missing `.agentctx/`, bad `--risk`) and asserting
   each prints an actionable, stable message.
6. **Schema authoring guide** — a single contributor doc that consolidates the
   per-file `*-schema-v0.md` rules into one authoring reference, with a guard test
   that it stays consistent with `ONTOLOGY_SCHEMA`.
7. **Release packaging dry-run docs** — document `npm pack` contents and a
   `.npmignore`/`files` allowlist plan (dry-run only; no publish), gated behind the
   open license decision.

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

Remaining follow-on autopilot lanes (still docs/tests only):

- **Trust-model tie-in** — relate the autopilot two-tool surface to the product
  trust & security model in one doc + guard.
- **Operator FAQ** — the questions an operator asks before wiring a line, each
  answered from a local artifact.
- **Deeper compiler-backed retrieval guards** — more table-driven CQ rows over the
  example fixtures as the schema grows.

## Needs an engine lane (out of scope for docs/tests hardening)

- **[engine]** `--format` extensions (e.g. a compact pack) — additive, semver-minor.
- **[engine]** richer scoring signals (heading weight, recency) — must keep the
  minimal/safe-task behavior byte-for-byte and ship backward-compat tests.
- **[engine]** a `mind-ontology` CLI wrapper renaming `agentctx:*` per the
  extraction map — a packaging lane, still local.

## Never in this product (hosted/closed boundary)

Memory graph storage, vector retrieval, typed-edge inference execution, writeback
execution, tenant storage, hosted auth, autonomous controller/runner internals,
deploy/wrangler config, and any live SIRT write. These stay in hosted SIRT behind
the adapter contracts.
