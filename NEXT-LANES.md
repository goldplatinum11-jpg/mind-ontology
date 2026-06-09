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
