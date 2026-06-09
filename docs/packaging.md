# Packaging (dry-run plan)

How Mind Ontology *would* be packaged for distribution. This is a **plan and a
dry-run only** — nothing here publishes anything.

> **Publishing stays fail-closed even though the license is chosen.** The OSS
> license is settled — **Apache-2.0** (see [`../LICENSE`](../LICENSE) and
> [`../LICENSE-DECISION.md`](../LICENSE-DECISION.md)) — but `package.json` keeps
> `"private": true`, so `npm publish` refuses outright. Removing `private` (and
> bumping the version + adding the `files` allowlist) is a separate, deliberate
> step. Do not run `npm publish`.

---

## Current dry-run

```sh
npm pack --dry-run    # lists would-be contents; writes no tarball, publishes nothing
```

Today this bundles **everything not gitignored** (~161 files): the whole test
suite, the worked examples, and internal phase-closeout docs. That is fine for a
private pre-release, but far more than an OSS consumer needs.

## Proposed `files` allowlist

When the package is readied for distribution, add an explicit allowlist so the
tarball ships only the product, not the workshop:

```jsonc
// package.json (proposed — not yet applied)
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
  `mind-ontology-extraction-map.md`, hosted-boundary contract drafts).
- `package-lock.json`, `vitest.config.mjs`, CI/dev config.

`npm` always includes `package.json`, `README`, and `LICENSE` regardless of the
allowlist; it always excludes `node_modules`, `.git`, and gitignored paths.

### `bin` entry

`package.json` declares one binary, `mind-ontology` →
`scripts/agentctx/cli.mjs` (the thin CLI wrapper; see
[the CLI guide](mind-ontology-cli-v0.md)). The target lives under
`scripts/agentctx/**`, so the proposed allowlist above already ships it — no
allowlist change is needed for the `bin` to resolve in an installed package.
Declaring a `bin` does **not** publish anything: `"private": true` still makes
`npm publish` refuse, and no `files`/`publishConfig` keys are added.

## Tested contract (dry-run pack inspection)

The dry-run posture is not just documented — it is regressed. Two test files
hold it against drift:

- `tests/unit/packaging-plan.test.mjs` and `tests/unit/package-metadata.test.mjs`
  assert the *static* posture from `package.json` and this doc (private, no
  `files`, no `publishConfig`, Apache-2.0 SPDX, every script-cited file exists).
- `tests/unit/packaging-dry-run-contract.test.mjs` executes
  `npm pack --dry-run --json` live and inspects the would-be tarball:
  - the dry-run **leaves no `.tgz` behind** — it is non-publishing by construction;
  - the `bin` target (`scripts/agentctx/cli.mjs`) is in the listed files, so the
    `mind-ontology` command resolves in an installed package;
  - `LICENSE`, `NOTICE`, and `README.md` are included;
  - the tarball is still **broad** (test files are present), proving the
    proposed `files` allowlist above has not yet been applied;
  - the package is still `"private": true`, so `npm publish` refuses;
  - the proposed filename is `mind-ontology-0.0.0.tgz` — version unchanged, no bump.

The release/publish gate is therefore **not** something a passing test can open.
Removing `"private"`, adding the `files` allowlist, and bumping the version is a
**separate, deliberate operator decision** recorded in
[`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md) — the test suite only proves
the package stays fail-closed until that decision is made.

## Pre-publish checklist

1. ~~License chosen and `LICENSE` committed~~ — **done: Apache-2.0**, `"license"`
   SPDX set (see [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md)).
2. `"private": true` removed (the remaining publish gate — a deliberate decision).
3. `"files"` allowlist added; `npm pack --dry-run` shows only the intended files.
4. Full suite green; `agentctx:smoke` `SMOKE PASS`.
5. Version bumped per semver.

The license is settled; until `"private"` is removed (step 2), packaging is a
dry-run exercise only.
