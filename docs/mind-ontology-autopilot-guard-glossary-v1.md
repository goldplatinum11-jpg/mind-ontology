# Mind Ontology — Autopilot Guard Glossary v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A one-line-each reference to the **structural guards** that keep the pack
consistent, for a contributor who wants to know what each one checks. It is the
prose companion to the [maturity self-audit](mind-ontology-autopilot-maturity-audit-v1.md)
table; the audit is the machine-checked list, this is the explanation.

Local-only: every guard is a local test, no hosted SIRT.

---

## The structural guards

- **Pack-completeness** — every autopilot doc is indexed in the docs index and
  links the frame, so no doc is orphaned.
- **Manifest** — every doc and every kit file is listed in the manifest, so the
  one-page view stays complete.
- **Pack-acceptance** — the fixtures compile, there are at least as many guard
  tests as docs, and every doc appears in the manifest.
- **Kit-completeness** — every file in the kit directory is documented in the kit
  README, so the drop-in kit has no undocumented files.
- **Discoverability** — every doc is reachable from the README in at most two hops
  (README → frame → index), so nothing is hidden.
- **Glossary-completeness** — every term in the glossary tie-in links a real doc,
  so the vocabulary has no dangling references.
- **Versioning** — every autopilot doc filename ends in `-v1.md`, so the version
  contract is explicit.
- **Safety-floor proof** — every fixture, on any task, always includes
  `constraints.md` with `reason: "always"`, so the floor can never be dropped.
- **Index-ordering** — the docs index lists the autopilot section in reading order
  (frame first, behavior before the manifest, manifest last), so the entry path
  stays coherent.
- **Manifest-freshness** — the manifest references exactly the autopilot docs on
  disk, neither missing nor stale, so the one-page view never drifts from reality.

Ten guards, each a green test. They are why a contributor cannot land an artifact
that is orphaned, undocumented, unguarded, or unsafe.

---

## Why a glossary of guards

The guards are the pack's immune system. Naming each in one line lets a new
contributor predict *why* a change failed the suite and fix it without spelunking
the test code — which is exactly the on-ramp the
[extending-the-pack](mind-ontology-autopilot-extending-v1.md) doc provides as a
checklist. See the [maturity audit](mind-ontology-autopilot-maturity-audit-v1.md)
for the table form.
