# Mind Ontology — Autopilot Pack Maturity Self-Audit v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A self-assessment of the **structural guarantees** the pack now enforces — the
machine-checked invariants that keep it consistent as it grows. Each row is a real
guard test; together they mean a contributor cannot land an artifact that is
orphaned, undocumented, unguarded, or unsafe.

Local-only: every guarantee is a local test, no hosted SIRT.

---

## The enforced structural guarantees

| # | Guarantee | Guard test |
|---|---|---|
| 1 | Every autopilot doc is indexed and links the frame | `tests/unit/autopilot-pack-completeness.test.mjs` |
| 2 | Every doc and kit file is listed in the manifest | `tests/unit/autopilot-manifest.test.mjs` |
| 3 | Fixtures compile; tests ≥ docs; every doc manifested | `tests/unit/autopilot-pack-acceptance.test.mjs` |
| 4 | Every kit file is documented in the kit README | `tests/unit/autopilot-kit-readme.test.mjs` |
| 5 | Every doc is reachable from the README in ≤2 hops | `tests/unit/autopilot-discoverability.test.mjs` |
| 6 | Every glossary term links a real doc | `tests/unit/autopilot-glossary-completeness.test.mjs` |
| 7 | Every autopilot doc filename ends in `-v1.md` | `tests/unit/autopilot-versioning.test.mjs` |
| 8 | Every fixture always includes the constraints floor | `tests/unit/autopilot-safety-floor-proof.test.mjs` |
| 9 | The docs index lists the autopilot docs in reading order | `tests/unit/autopilot-index-ordering.test.mjs` |
| 10 | The manifest references exactly the autopilot docs on disk | `tests/unit/autopilot-manifest-freshness.test.mjs` |

Ten structural guarantees, each a green test. Add a doc, a kit file, or a fixture
that breaks any of them and the suite fails — the structure self-corrects.

## What "mature" means here

Maturity is not feature count; it is **the inability to drift**. The pack is mature
because its own consistency is mechanically enforced: the docs cannot disagree with
the index, the manifest, the kit, or the guards. A reviewer trusts a green suite,
not a promise.

## What is still additive

New docs, fixtures, and kit files extend coverage; tightening a guard raises the
bar — both stay within v1 because they do not change the contract (two read-only
tools, local-first, the stop policy). See
[pack versioning](mind-ontology-autopilot-versioning-v1.md) and
[extending the pack](mind-ontology-autopilot-extending-v1.md).

---

The pack audits itself: ten invariants, ten guards, one green suite. See
[pack at a glance](mind-ontology-autopilot-manifest-v1.md) for the full surface.
