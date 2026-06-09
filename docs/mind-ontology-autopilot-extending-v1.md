# Mind Ontology — Extending the Autopilot Pack v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How to add to the pack without breaking its self-enforcing structure. The pack is
held together by guard tests that fail if a new artifact is unindexed, unlinked,
unmanifested, or unguarded — so contributing is a short checklist, not guesswork.

Everything here is docs/tests/fixtures/templates only, local-first, no hosted
SIRT.

---

## Adding a doc (`docs/mind-ontology-autopilot-*-v1.md`)

Four steps, each enforced by a guard:

1. **Name it `-v1.md`.** The versioning guard rejects any other suffix.
2. **Index it** in `docs/mind-ontology.md` under the Autopilot integration section.
   The completeness guard fails otherwise.
3. **Link the frame** (`mind-ontology-autopilot-pack-v1.md`) inside the doc. The
   completeness guard fails otherwise.
4. **List it in the manifest** (`docs/mind-ontology-autopilot-manifest-v1.md`) and
   **add a guard test** `tests/unit/autopilot-*.test.mjs`. The acceptance guard
   fails if a doc is unmanifested or if there are fewer tests than docs.

## Adding a kit template (`templates/mind-ontology/autopilot/*`)

1. **Document it** in `templates/mind-ontology/autopilot/README.md` (kit-completeness
   guard).
2. **List it** in the manifest Templates section.
3. **Add a guard** asserting its key claims and that it carries no secret/host.

## Adding a fixture (`tests/fixtures/autopilot-*/`)

1. **Keep vocabulary disjoint** from the wrong-axis corpus words
   (memory/history/recall/etc.) so the no-dump invariants hold.
2. **Add a compiler-backed guard** (`compileFromCwd`) asserting a task surfaces the
   intended block, with a negative control proving matches are earned.

## Writing guard tests that don't flake

- Use `\s+` between words in any multi-word regex — markdown soft-wrap inserts
  newlines that break a literal space.
- Match the actual heading text (e.g. `### 1. Open`), and window before *and*
  after a marker when checking nearby text.
- Put secret/host leakage regexes on config/data files, not on prose docs that
  legitimately describe the prohibition.

---

If all the guards pass (`npm test`) and `npm run agentctx:validate` is clean, the
addition is in scope and consistent. The structure does the bookkeeping so a
contributor can focus on the content. See the
[manifest](mind-ontology-autopilot-manifest-v1.md) and
[non-goals](mind-ontology-autopilot-non-goals-v1.md) for what belongs and what does
not.
