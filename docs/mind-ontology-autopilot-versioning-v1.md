# Mind Ontology — Autopilot Pack Versioning v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How the pack's artifacts are versioned, so a reader knows what `v1` means and what
a future `v2` would and would not change. Versioning is a docs convention here; it
touches no engine code and needs no hosted SIRT.

---

## The `-v1` suffix convention

Every pack artifact carries an explicit version in its filename
(`mind-ontology-autopilot-*-v1.md`) and a **Status** line at the top. The suffix
is the contract marker: a doc named `-v1` describes the v1 shape of that concept
and is held to it by its guard test.

Fixtures and kit templates follow the same spirit — they are the v1 examples, and
a change that would alter their meaning is a new version, not an edit in place.

## What a v2 would change

A `v2` is warranted when the **contract** changes, not when prose is polished:

- a new tool added to the surface (today: exactly two, read-only),
- a change to what `get_context` / `list_constraints` return,
- a change to the Result Pack required keys,
- a change to the stop-policy valid/invalid sets.

Each of those is a behavioral shift a consuming line must adapt to, so it earns a
new version and a new guard, side by side with v1.

## What stays a v1 edit

- Clarifying prose, fixing a link, adding an example.
- Adding a *new* doc/fixture/template (a new artifact, still v1).
- Tightening a guard test without changing the asserted contract.

These do not change what a line depends on, so they stay in v1.

## Why version at all

A consuming line pins to a contract. Explicit versions let the line know when it
must re-check its assumptions (a v2 lands) versus when it can pull updates freely
(v1 edits). This mirrors the product's own
[versioning & release checklist](mind-ontology-versioning-release-checklist-v0.md);
the pack inherits that discipline.

---

The rule of thumb: **change the meaning, change the version.** Everything in this
lane is v1 because the contract — two read-only tools, local-first, the stop
policy — has not changed. See [pack at a glance](mind-ontology-autopilot-manifest-v1.md).
