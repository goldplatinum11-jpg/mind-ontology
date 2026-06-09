# Contributing to Mind Ontology

Thanks for your interest. Mind Ontology is built in small, reviewable slices.
This file is the actionable contributor entry point; the reasoning behind it
lives in [`docs/mind-ontology-contribution-guide-plan-v0.md`](docs/mind-ontology-contribution-guide-plan-v0.md).

> **License:** Mind Ontology is licensed under **Apache-2.0** (see
> [`LICENSE`](LICENSE) and [`LICENSE-DECISION.md`](LICENSE-DECISION.md)). By
> contributing you agree your contribution is released under the Apache-2.0
> license. The package is still `private`/pre-release, so it is not published yet
> — but the source license is settled.

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
- Don't remove `"private": true` or publish without the explicit release decision.

Release readiness is tracked in [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md).
