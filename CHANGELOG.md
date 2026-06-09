# Changelog

All notable changes to Mind Ontology are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once a release
is cut.

What counts as **breaking** vs **additive** is defined in
[`docs/mind-ontology-versioning-release-checklist-v0.md`](docs/mind-ontology-versioning-release-checklist-v0.md):
the stability boundary is the contract (`get_context`, `list_constraints`) and
the pack JSON shape; everything else can evolve additively.

> **Pre-release.** No version has been published. The package is `private` and
> not yet OSS-licensed (see [`LICENSE-DECISION.md`](LICENSE-DECISION.md)), so the
> first real entry below will be the first tagged release after the license is
> chosen.

## [Unreleased]

### Added
- Standalone product surface: top-level `README.md`, docs index, quickstart,
  CLI error reference, schema authoring guide, scoring explainer, testing guide,
  packaging (dry-run) plan, and a richer worked example (`docs/examples/`).
- Contributor entry points: `CONTRIBUTING.md`, `RELEASE-CHECKLIST.md`,
  `NEXT-LANES.md`, `docs/product-status.md`.
- Hardening test suites: license fail-closed guard, MCP stdio smoke, thin
  connector/setup-fixture audits, hosted-boundary no-write / no-leakage
  expansion, CLI error-UX, doc link/anchor/script audits, control-plane import
  audit, CQ regression, and block-scoring guards.

### Changed
- Phase-A runbook rewritten as historical/excluded control-plane material.
- Extraction inventory ↔ map cross-linked as a read-only provenance chain.

### Security
- Documented and tested the fail-closed hosted boundary: adapter flags default
  off, writeback is proposal-only (no execute path), no credentials or real
  endpoints in the repo.

[Unreleased]: https://keepachangelog.com/en/1.1.0/
