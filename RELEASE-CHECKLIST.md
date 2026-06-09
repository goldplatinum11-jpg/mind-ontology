# Release Checklist

The canonical versioning policy (what's breaking vs additive, deprecation rules)
lives in
[`docs/mind-ontology-versioning-release-checklist-v0.md`](docs/mind-ontology-versioning-release-checklist-v0.md).
This file is the quick pre-tag checklist.

> **Distribution is fail-closed.** No release may be cut while the OSS license is
> undecided and no `LICENSE` file exists — see [`LICENSE-DECISION.md`](LICENSE-DECISION.md).
> Choosing the license is itself a release-blocking item below.

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

- [ ] OSS license **explicitly selected** by the operator (Apache-2.0 or MIT).
- [ ] `LICENSE` file committed with the full chosen text.
- [ ] `package.json` `"license"` set to the matching SPDX id.
- [ ] `LICENSE-DECISION.md` retired / updated to reflect the decision.

## Versioning

- [ ] `package.json` version bumped per semver (major **only** for a contract
      break: removing/renaming a tool, removing/retyping a pack field, removing a
      `SOURCE_FILES` entry, or changing `--risk`/flag semantics).
- [ ] Phase closeout doc updated if a phase completed.

No `npm publish`, deploy, or push is part of this checklist while the license
gate is open.
