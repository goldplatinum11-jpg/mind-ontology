# Contributing to Mind Ontology

Thanks for your interest. Mind Ontology is built in small, reviewable slices.
This file is the actionable contributor entry point; the reasoning behind it
lives in [`docs/mind-ontology-contribution-guide-plan-v0.md`](docs/mind-ontology-contribution-guide-plan-v0.md).

> **License status:** this project is **not yet licensed for distribution.** The
> OSS license is undecided and the repo ships **no `LICENSE` file** — see
> [`LICENSE-DECISION.md`](LICENSE-DECISION.md). By contributing you agree your
> contribution may be released under whichever OSS license the project later
> selects (Apache-2.0 or MIT are the documented candidates). Do not add a
> `LICENSE` file or declare a concrete license in a PR.

---

## Principles

1. **Structure before code.** Decide the right shape (schema/contract) first,
   then implement. Source-file changes start from a schema, not an edit.
2. **One bounded PR per lane.** Each PR does one declared thing on its own branch.
3. **Every change ships a test.** Behavior changes get behavior tests; docs and
   schemas get guard/conformance tests so they can't drift.
4. **Local-first and credential-free.** No secrets, tokens, or real endpoints.

---

## Before you open a PR

Run the local gates (fast → full):

```sh
npm install
npm run agentctx:proof       # smallest viable gate
npm run agentctx:validate    # 0 errors on the shipped template
npm run agentctx:smoke       # SMOKE PASS
npm test                     # full unit suite
```

Then open a PR with a short **scope / safety** section: what changed, and what
was deliberately *not* touched.

---

## Change-type guidance

| You're changing… | Do this |
|---|---|
| A `.agentctx/` source schema | update the `*-schema-v0.md` doc **and** a conformance test pinning the template |
| The compiler | keep backward-compat (minimal/safe-task behavior unchanged); run the full suite |
| A client/connector | add a setup proof or manifest test; placeholders only, no secrets |
| A hosted adapter | keep it fail-closed and default-off; never add an execute path to the OSS layer |
| Docs | add a guard test asserting the doc's key claims and that cited commands/files exist |

---

## What NOT to do

- Don't add credentials, real URLs, or deploy/wrangler config to the OSS layer.
- Don't widen the tool surface beyond `get_context` / `list_constraints` without
  an explicit contract change (and a major version).
- Don't make a hosted feature load-bearing for the local path.
- Don't declare or ship an OSS license until the project decides one.

Release readiness is tracked in [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md).
