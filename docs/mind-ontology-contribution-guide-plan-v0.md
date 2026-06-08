# Mind Ontology — Contribution Guide Plan v0

**Status:** Phase 5 / P5-PR06 (launch readiness) — **plan / guidelines**

How Mind Ontology is built, so contributions stay small, safe, and reviewable.
This is the working method the project already follows; it is written down here
as the contributor contract.

---

## Principles

1. **Structure before code.** Decide the right shape first (schema/contract),
   then implement. Source-file changes start from a schema, not an edit.
2. **One bounded PR per lane.** Each PR does one declared thing, on its own
   branch, stacked on the previous. Don't expand scope mid-PR.
3. **Every change ships a test.** Behavior changes get behavior tests; docs and
   schemas get guard/conformance tests so they can't rot or drift.
4. **Local-first and credential-free.** No secrets, tokens, or real endpoints in
   the repo. Run `npm run agentctx:validate` on any ontology you touch.

---

## Contribution workflow

1. Pick or define a bounded lane (one PR's worth of work).
2. Branch from the current tip; keep the working tree to the declared files.
3. Implement, with a test for the change.
4. Run the gate locally:
   ```sh
   npx vitest run tests/unit/agentctx-*.test.mjs
   npm run agentctx:smoke
   npm run agentctx:validate
   ```
5. Open a PR with a clear scope/safety section (what changed, what was NOT
   touched). Stack it on the lane it depends on.

---

## Change-type guidance

| You're changing… | Do this |
|---|---|
| A `.agentctx/` source schema | add/update the `*-schema-v0.md` doc **and** a conformance test pinning the template |
| The compiler | keep backward-compat (minimal/safe-task behavior unchanged); run the full suite |
| A client/connector | add a setup proof or manifest test; placeholders only, no secrets |
| A hosted adapter | keep it fail-closed and default-off; never add an execute path to the OSS layer |
| Docs | add a guard test asserting the doc's key claims and that cited commands/files exist |

---

## Review gates (what a reviewer checks)

- Scope matches the declared lane; no unrelated `src/` or config churn.
- Tests added and green; backward-compat preserved.
- No secrets, real endpoints, deploy, or migration in an OSS-layer PR.
- Hosted features stay opt-in / fail-closed.
- Docs index updated when a command/schema/flag is added.

---

## What NOT to do

- Don't add credentials, real URLs, or deploy/wrangler config to the OSS layer.
- Don't widen a tool's surface beyond `get_context` / `list_constraints` without
  an explicit contract change (and a major version).
- Don't make a hosted feature load-bearing for the local path.
