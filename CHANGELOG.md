# Changelog

All notable changes to Mind Ontology are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once a release
is cut.

What counts as **breaking** vs **additive** is defined in
[`docs/mind-ontology-versioning-release-checklist-v0.md`](docs/mind-ontology-versioning-release-checklist-v0.md):
the stability boundary is the contract (`get_context`, `list_constraints`) and
the pack JSON shape; everything else can evolve additively.

> **Pre-release.** No version has been published. The OSS license is settled —
> **Apache-2.0** (see [`LICENSE`](LICENSE) / [`LICENSE-DECISION.md`](LICENSE-DECISION.md))
> — and the first release is **prepared as `0.1.0`** (version bumped, `files`
> allowlist applied, `private` gate removed: the package is publish-ready but
> unpublished). The first real entry below will be the first tagged release
> after the explicit operator publish decision.

## [Unreleased]

The contents of this section ship as **`0.1.0`**, the first public release.

### Added
- **Release preparation for `0.1.0`** (additive, no contract change): version
  bumped from `0.0.0`; `files` allowlist applied so the npm tarball ships only
  the product surface (engine, templates, user-facing docs — no tests, examples,
  or internal provenance docs); npm `keywords` added; package description
  rewritten to the public product framing; the `private` flag removed so the
  package is publish-ready (publishing itself remains an explicit operator
  decision). Support/contact: **GitHub Issues only**.
- **Emit wedge** (`mind-ontology emit`): deterministic `AGENTS.md` / `CLAUDE.md`
  compile targets with fingerprint headers and the `emit --check` three-value
  CI drift gate, plus the inspection track (`explain`, `preview`, `status`,
  `review`, CQ gate).
- **Apache-2.0 license** chosen and landed: `LICENSE` (canonical text) + `NOTICE`;
  `package.json` `license` set to the `Apache-2.0` SPDX id. Publishing remains an
  explicit operator decision.
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
