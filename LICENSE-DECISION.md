# License Decision — Fail-Closed Until Chosen

**Status:** OPEN. No OSS license has been selected for Mind Ontology.

**Effect:** Distribution is **fail-closed**. Until a `LICENSE` file exists in the
repository root, this package is **source-available for review only** and is
**not** released under any open-source license.

---

## Current state

| Item | Value |
|---|---|
| `LICENSE` file present | **No** |
| `package.json` `license` field | `SEE docs/mind-ontology-license-boundary.md` |
| Recommendation of record | Apache-2.0 (default), MIT (acceptable fallback) |
| Not recommended for v0 | AGPL/GPL |
| Decision owner | Operator (SirtuinX) |

The license *recommendation* lives in
[`docs/mind-ontology-license-boundary.md`](docs/mind-ontology-license-boundary.md).
A recommendation is **not** a grant. No SPDX identifier has been committed to
`package.json` precisely so that no accidental OSS grant is implied before the
decision is made.

---

## Why fail-closed

Mind Ontology injects context into the middle of AI-agent workflows and
commercial codebases. A premature or accidental license declaration (e.g. an
auto-generated `LICENSE` or a stray `"license": "MIT"`) would imply rights the
project owner has not yet granted. Failing closed protects:

- the operator's freedom to choose the final terms;
- downstream users from relying on a grant that may change;
- the open-core boundary between this free layer and hosted SIRT.

---

## What must happen before distribution

This file should be replaced by a real `LICENSE` only when **all** are true:

1. The operator explicitly selects the final license (Apache-2.0 or MIT per the
   boundary doc, or an explicit alternative).
2. A `LICENSE` file containing the full chosen license text is committed to the
   repository root.
3. `package.json` `"license"` is set to the matching SPDX identifier
   (e.g. `Apache-2.0` or `MIT`).
4. The trademark note (Mind Ontology = product name; SIRT = hosted layer) from
   the boundary doc is reflected in the release notes.

Until then, **do not**:

- add a `LICENSE` file with invented terms;
- set a concrete SPDX identifier in `package.json`;
- publish, push to a public remote, or otherwise distribute the package as OSS.

---

## Cross-references

- License recommendation & open-core boundary:
  [`docs/mind-ontology-license-boundary.md`](docs/mind-ontology-license-boundary.md)
- Product surface & distribution note: [`README.md`](README.md)
- Standalone provenance: [`EXTRACTION-INVENTORY.md`](EXTRACTION-INVENTORY.md)
