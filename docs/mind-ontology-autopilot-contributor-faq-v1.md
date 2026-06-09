# Mind Ontology — Autopilot Contributor FAQ v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Quick answers for someone adding to the pack — the questions that come up before
the first PR. The full procedure is in
[extending the pack](mind-ontology-autopilot-extending-v1.md); this is the FAQ
form. Local-only, no hosted SIRT.

---

## Where do I put a new doc?

In `docs/`, named `mind-ontology-autopilot-<topic>-v1.md`. Then do the four steps:
index it (before the manifest line), link the frame, list it in the manifest, and
add a guard test. See [extending the pack](mind-ontology-autopilot-extending-v1.md).

## Why did my new doc fail the suite?

Almost always one of the structural guards: it is not indexed, does not link the
frame, is not in the manifest, has no guard test, or its filename does not end in
`-v1.md`. The failing test names which. See the
[guard glossary](mind-ontology-autopilot-guard-glossary-v1.md).

## How do I write a guard test that does not flake?

Use `\s+` between words in any multi-word regex (markdown soft-wraps), tolerate
backticks and italics, match the actual heading text, and prefer a short
distinctive substring over a long literal phrase. Put secret/leakage regexes on
config/data files, not on prose that describes the prohibition.

## Can I add a tool, a write path, or hosted memory?

No — those are [non-goals](mind-ontology-autopilot-non-goals-v1.md). The surface
stays two read-only tools; durable memory and writeback are the optional hosted
layer, out of scope for the pack.

## How do I add a fixture?

Put it under `tests/fixtures/autopilot-<name>/.agentctx/` with a `constraints.md`
(the safety-floor proof requires it), keep its vocabulary distinct from the
wrong-axis corpus words, and add a compiler-backed retrieval guard.

## What counts as a v2?

A change to the contract — a new tool, changed tool outputs, changed Result Pack
keys, or a changed stop policy. Everything else is a v1 edit. See
[pack versioning](mind-ontology-autopilot-versioning-v1.md).

---

If `npm test` and `npm run agentctx:validate` are green, your addition is in scope
and consistent — the structure does the rest. See
[extending the pack](mind-ontology-autopilot-extending-v1.md).
