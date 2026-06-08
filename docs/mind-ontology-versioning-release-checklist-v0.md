# Mind Ontology — Versioning & Release Checklist v0

**Status:** Phase 5 / P5-PR05 (launch readiness)

How Mind Ontology versions itself and what must be true before a release. The
stability boundary is the **contract** (`get_context`, `list_constraints`) and
the **pack shape** — everything else can evolve additively.

---

## What versions

| Thing | Versioning |
|---|---|
| The contract (two tools + pack JSON shape) | the stability promise — semver-major if broken |
| Compiler / CLI | semver; additive features are minor |
| Source schemas (`*-schema-v0.md`) | explicit `vN` suffix; a new major schema is `v1`, etc. |
| Connector OpenAPI | `info.version`; additive paths are minor |

The package version lives in `package.json`.

---

## Breaking vs additive

**Breaking (major):**
- removing or renaming a tool (`get_context`, `list_constraints`);
- removing a field from the pack JSON, or changing a field's type;
- removing a source file from `SOURCE_FILES` or a required block from a schema;
- changing `--risk` / flag semantics so a previously-safe default changes.

**Additive (minor):**
- a new source file in `SOURCE_FILES` (absent files contribute nothing);
- a new pack field (e.g. `risk`), a new flag, a new CLI/metric;
- a new optional block or recommended tag in a schema.

Backward-compatibility is itself tested — e.g. the source-list and risk-mode
tests assert a minimal `constraints.md`-only project and existing safe tasks
behave unchanged.

---

## Release checklist

Run before tagging a release:

- [ ] `npm test` (or `npx vitest run`) — full suite green.
- [ ] `npm run agentctx:smoke` — `SMOKE PASS`.
- [ ] `npm run agentctx:validate` — `0 errors` on the shipped template.
- [ ] No-leakage audit passes (`agentctx-no-leakage-audit.test.mjs`).
- [ ] No secrets / real endpoints introduced (connector configs are placeholders).
- [ ] Docs index reflects any new schema/command/flag.
- [ ] Changelog entry describing additive vs breaking changes.
- [ ] `package.json` version bumped per semver (major only for a contract break).
- [ ] Phase closeout doc updated if a phase completed.

---

## Deprecation policy

- A contract change ships behind a new tool/field first; the old one is marked
  deprecated for at least one minor release before removal.
- Schema majors (`v0` → `v1`) keep the `v0` doc until the next major release so
  existing ontologies have a migration window.
