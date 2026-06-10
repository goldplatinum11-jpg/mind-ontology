# Packaging (dry-run, release-prepared)

How Mind Ontology is packaged for distribution. Everything here is verifiable
locally with a **dry-run only** — nothing here publishes anything.

> **Publishing stays fail-closed even though the package is release-prepared.**
> The OSS license is settled — **Apache-2.0** (see [`../LICENSE`](../LICENSE) and
> [`../LICENSE-DECISION.md`](../LICENSE-DECISION.md)) — the version is bumped to
> `0.1.0` and the `files` allowlist is applied, but `package.json` keeps
> `"private": true`, so `npm publish` refuses outright. Removing `private` is the
> one remaining, deliberate operator decision. Do not run `npm publish`.

---

## Current dry-run

```sh
npm pack --dry-run    # lists would-be contents; writes no tarball, publishes nothing
```

Before release prep this bundled **everything not gitignored** — a broad tree of
~161 files including the whole test suite, the worked examples, and internal
phase-closeout docs. The applied allowlist (below) narrows the tarball to the
product surface: **47 files** — the engine, the init templates, and the
user-facing docs.

## Applied `files` allowlist

`package.json` ships an explicit allowlist so the tarball contains only the
product, not the workshop:

```jsonc
// package.json (applied)
"files": [
  "scripts/agentctx/**",        // the engine: compiler, MCP server, schema, adapters
  "templates/**",               // init templates
  "README.md",
  "LICENSE",                    // Apache-2.0 (shipped)
  "NOTICE",
  "docs/mind-ontology-quickstart.md",
  "docs/mind-ontology-quickstart-examples-v0.md",
  "docs/agentctx-mcp.md",
  "docs/agentctx-mcp-setup.md",
  "docs/cli-errors.md",
  "docs/schema-authoring.md",
  "docs/testing.md"
]
```

Deliberately **excluded** from the published tarball (kept in the repo):

- `tests/**` — consumers run their own tests; ours stay in-repo.
- `docs/examples/**` — useful in-repo, not needed in the installed package.
- internal/provenance docs (`*-phase-*-closeout-v0.md`, `EXTRACTION-INVENTORY.md`,
  `mind-ontology-extraction-map.md`, hosted-boundary contract drafts,
  `CONTROL.md`, `NEXT-LANES.md`, `MIGRATION-PLAN.md`).
- `package-lock.json`, `vitest.config.mjs`, CI/dev config.

`npm` always includes `package.json`, `README`, and `LICENSE` regardless of the
allowlist; it always excludes `node_modules`, `.git`, and gitignored paths.

### `bin` entry

`package.json` declares one binary, `mind-ontology` →
`scripts/agentctx/cli.mjs` (the thin CLI wrapper; see
[the CLI guide](mind-ontology-cli-v0.md)). The target lives under
`scripts/agentctx/**`, so the applied allowlist ships it — the `mind-ontology`
command resolves in an installed package. Declaring a `bin` does **not**
publish anything: `"private": true` still makes `npm publish` refuse, and no
`publishConfig` key exists.

## Tested contract (dry-run pack inspection)

The packaging posture is not just documented — it is regressed. Two test files
hold it against drift:

- `tests/unit/packaging-plan.test.mjs` and `tests/unit/package-metadata.test.mjs`
  assert the *static* posture from `package.json` and this doc (private, applied
  `files` allowlist, no `publishConfig`, Apache-2.0 SPDX, every script-cited
  file exists).
- `tests/unit/packaging-dry-run-contract.test.mjs` executes
  `npm pack --dry-run --json` live and inspects the would-be tarball:
  - the dry-run **leaves no `.tgz` behind** — it is non-publishing by construction;
  - the `bin` target (`scripts/agentctx/cli.mjs`) is in the listed files, so the
    `mind-ontology` command resolves in an installed package;
  - `LICENSE`, `NOTICE`, and `README.md` are included;
  - the tarball is **narrow**: no `tests/**`, no `docs/examples/**`, no internal
    docs — the applied `files` allowlist holds;
  - the package is still `"private": true`, so `npm publish` refuses;
  - the proposed filename is `mind-ontology-0.1.0.tgz` — the prepared first
    release, unpublished.

The publish gate is therefore **not** something a passing test can open.
Removing `"private"` is a **separate, deliberate operator decision** recorded in
[`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md) — the test suite only proves
the package stays fail-closed until that decision is made.

## Pre-publish checklist

1. ~~License chosen and `LICENSE` committed~~ — **done: Apache-2.0**, `"license"`
   SPDX set (see [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md)).
2. `"private": true` removed (**the remaining publish gate** — a deliberate
   operator decision).
3. ~~`"files"` allowlist added; `npm pack --dry-run` shows only the intended
   files~~ — **done** (47-file product tarball, regressed by test).
4. Full suite green; `agentctx:smoke` `SMOKE PASS` (re-run before tagging).
5. ~~Version bumped per semver~~ — **done: `0.1.0`** (first public release).

Until `"private"` is removed (step 2), packaging is a dry-run exercise only.
Support and bug reports for the published package: **GitHub Issues only** (the
repository URL lands in `package.json` when the public repo is created).
