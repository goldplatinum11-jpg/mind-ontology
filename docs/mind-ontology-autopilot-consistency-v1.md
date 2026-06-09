# Mind Ontology — Cross-Pack Consistency v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How the ten structural guards compose into one **self-correcting whole**. Each
guard checks a single property; together they make the pack unable to drift away
from its own claims. This doc explains the composition, not each guard — for the
per-guard one-liners see the [guard glossary](mind-ontology-autopilot-guard-glossary-v1.md).

Local-only: every guard is a local test, no hosted SIRT.

---

## The closed loop

The guards cover the lifecycle of an artifact end to end, so there is no gap to
slip through:

- **Exists and discoverable** — completeness (indexed + frame-linked),
  discoverability (≤2 hops from the README), index-ordering (right place in the
  index).
- **Recorded everywhere it must be** — manifest (listed) and manifest-freshness
  (the manifest equals the docs on disk, exactly).
- **Guarded and counted** — pack-acceptance (a guard per doc; tests ≥ docs).
- **Named consistently** — versioning (every doc is `-v1.md`).
- **Behaviourally sound** — safety-floor proof (every fixture keeps the floor),
  glossary-completeness (every term resolves), kit-completeness (every kit file
  documented).

Add a doc without indexing it → completeness fails. Index it but forget the
manifest → manifest-freshness fails. Manifest it but skip the guard →
pack-acceptance fails. Every omission trips a different guard, so the only way to
land an artifact is to land it complete.

## Why composition matters

A single guard catches one mistake; ten composed guards catch *the set* of
mistakes that would let the pack disagree with itself. That is what
[maturity](mind-ontology-autopilot-maturity-audit-v1.md) means here — not feature
count, but the closure of the consistency checks. The
[principles](mind-ontology-autopilot-principles-v1.md) are the human-readable
spine; the composed guards are the machine that holds the spine straight.

## The one green suite

Because the guards compose, a single green `npm test` is a strong statement: every
autopilot doc is indexed, manifested, frame-linked, version-named, guarded, and
discoverable, every fixture keeps the floor, and every term and kit file resolves.
One command, the whole consistency contract.

---

Ten guards, one closed loop, one green suite: the pack cannot quietly drift. See
the [maturity self-audit](mind-ontology-autopilot-maturity-audit-v1.md) for the
table and [extending the pack](mind-ontology-autopilot-extending-v1.md) for how to
add to it without breaking the loop.
