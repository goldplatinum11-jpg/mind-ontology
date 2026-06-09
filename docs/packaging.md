# Packaging (dry-run plan)

How Mind Ontology *would* be packaged for distribution. This is a **plan and a
dry-run only** — nothing here publishes anything.

> **Publishing is fail-closed twice over:**
> 1. `package.json` has `"private": true`, so `npm publish` refuses outright.
> 2. There is no OSS `LICENSE` yet — see [`../LICENSE-DECISION.md`](../LICENSE-DECISION.md).
>
> Both must change deliberately (license chosen, `private` removed) before any
> publish. Do not run `npm publish`.

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
  "LICENSE",                    // once it exists
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

## Pre-publish checklist (when the license gate opens)

1. License chosen and `LICENSE` committed (see [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md)).
2. `"private": true` removed and `"license"` set to the SPDX id.
3. `"files"` allowlist added; `npm pack --dry-run` shows only the intended files.
4. Full suite green; `agentctx:smoke` `SMOKE PASS`.
5. Version bumped per semver.

Until step 1 is done, packaging is a dry-run exercise only.
