# Release Checklist

The canonical versioning policy (what's breaking vs additive, deprecation rules)
lives in
[`docs/mind-ontology-versioning-release-checklist-v0.md`](docs/mind-ontology-versioning-release-checklist-v0.md).
This file is the quick pre-tag checklist.

> **Distribution stays fail-closed even though the license is settled.** The OSS
> license is **Apache-2.0** (`LICENSE` shipped; see
> [`LICENSE-DECISION.md`](LICENSE-DECISION.md)). The remaining release gate is
> `"private": true` in `package.json` — `npm publish` refuses until it is
> deliberately removed.

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
- [ ] **Remaining gate:** remove `"private": true` (deliberate publish decision).

## Versioning

- [ ] `package.json` version bumped per semver (major **only** for a contract
      break: removing/renaming a tool, removing/retyping a pack field, removing a
      `SOURCE_FILES` entry, or changing `--risk`/flag semantics).
- [ ] Phase closeout doc updated if a phase completed.

No `npm publish`, deploy, or push is part of this checklist while the license
gate is open.
