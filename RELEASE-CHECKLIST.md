# Release Checklist

The canonical versioning policy (what's breaking vs additive, deprecation rules)
lives in
[`docs/mind-ontology-versioning-release-checklist-v0.md`](docs/mind-ontology-versioning-release-checklist-v0.md).
This file is the quick pre-tag checklist.

> **Distribution stays fail-closed: publishing is an explicit operator decision
> even though the license is settled.** The OSS license is **Apache-2.0**
> (`LICENSE` shipped; see
> [`LICENSE-DECISION.md`](LICENSE-DECISION.md)). The `"private"` gate has been
> removed — the package is publish-ready — but `npm publish` runs only on the
> deliberate operator publish decision, after the public GitHub repository
> exists and its URL is added to `package.json`.

---

## Pre-tag gate

Run before tagging any release:

- [ ] `npm test` — full suite green.
- [ ] `npm run agentctx:proof` — smallest gate green.
- [ ] `npm run agentctx:smoke` — `SMOKE PASS`.
- [ ] `npm run agentctx:validate` — `0 errors` on the shipped template.
- [ ] No-leakage audit passes (`tests/unit/agentctx-no-leakage-audit.test.mjs`
      and `tests/unit/no-leakage-expansion.test.mjs`).
- [ ] No secrets / real endpoints introduced (connector configs are placeholders).
- [ ] Docs index ([`docs/mind-ontology.md`](docs/mind-ontology.md)) reflects any
      new schema / command / flag.
- [ ] Changelog entry describing additive vs breaking changes.

## Distribution gate (one-time, blocks first OSS release)

- [x] OSS license **explicitly selected** by the operator — **Apache-2.0** (2026-06-09).
- [x] `LICENSE` file committed with the full Apache-2.0 text (+ `NOTICE`).
- [x] `package.json` `"license"` set to `Apache-2.0` (SPDX id).
- [x] `LICENSE-DECISION.md` updated to record the decision.
- [x] Version set to **`0.1.0`** for the first public release (2026-06-11).
- [x] `files` allowlist applied — `npm pack --dry-run` ships only the product
      surface (engine, templates, user-facing docs); regressed by
      `tests/unit/packaging-dry-run-contract.test.mjs`.
- [x] Support/contact channel decided: **GitHub Issues only**.
- [x] `"private": true` removed (2026-06-11) — the package is publish-ready.
- [ ] **Remaining gate:** the deliberate operator publish decision (`npm publish`
      runs only on explicit operator approval).
- [ ] **At publish time:** create the public GitHub repository and add its URL
      as `repository`/`bugs` in `package.json` (Issues is the support channel).

## Versioning

- [x] `package.json` version bumped per semver — `0.1.0` prepared for the first
      release (major **only** for a contract break: removing/renaming a tool,
      removing/retyping a pack field, removing a `SOURCE_FILES` entry, or
      changing `--risk`/flag semantics).
- [ ] Phase closeout doc updated if a phase completed.

No `npm publish`, deploy, or push is part of this checklist. Publishing happens
only on the explicit operator publish decision.
