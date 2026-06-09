# agentctx Phase A Runbook — Historical / Excluded Control-Plane

> **Status: HISTORICAL. Not a product feature.**
>
> Phase A described a **SIRT control-plane** dispatch flow (operator queue →
> staging Claude Code runner → draft PR) that lived in `sirt-app-v2`. That
> machinery — including the `scripts/operator/agentctx-phase-a-packet.mjs`
> script and the `agentctx:phase-a-packet` package script it backed — was
> **deliberately excluded** from the standalone Mind Ontology extraction.
>
> This page is kept only as provenance. **Do not run the commands described in
> the historical section below; they do not exist in this package.** See
> [`EXTRACTION-INVENTORY.md`](../EXTRACTION-INVENTORY.md) for the exclusion
> record.

---

## What replaces Phase A for product users

Mind Ontology is a **local-first** context compiler. There is no operator queue,
no dispatch API, and no staging runner in this package. To prove the local
product works, use the validation gates that *do* ship:

```sh
npm run agentctx:proof       # smallest viable gate (fast, local)
npm run agentctx:validate    # validate .agentctx/ against the schema
npm run agentctx:smoke       # one-command end-to-end acceptance check
npm test                     # full unit suite
```

To compile and inspect a task-scoped context pack locally:

```sh
npm run agentctx:compile -- --task "Add Claude Code setup docs" --scope "mind-ontology,mcp"
npm run agentctx:metrics  -- --task "Add Claude Code setup docs"
```

None of these require SIRT, an account, a network, or credentials.

---

## Historical record (excluded — for provenance only)

The original Phase A runbook proved that a SIRT dispatch queue could hand work to
Claude Code with the same scoped context contract Codex saw. It relied on:

- an operator packet generator (`scripts/operator/agentctx-phase-a-packet.mjs`)
  invoked through an `agentctx:phase-a-packet` package script;
- a staging dispatch API (`POST {SIRT_BASE_URL}/v2/agent_tasks`) authenticated
  with an operator key;
- a restricted safety profile and draft-PR-only output.

All of that is **SIRT control-plane infrastructure**, not Mind Ontology product
code. It was excluded from this package on purpose so that the OSS surface stays
thin, local, and free of operator/runner/queue dependencies. The dependency
direction is one-way: hosted SIRT may use Mind Ontology; Mind Ontology never
imports SIRT control-plane internals.

If you are looking for the autonomous dispatch line, it remains in the hosted
SIRT system and is out of scope for this repository.

---

## Why this matters for trust

A product user must never be told to run an operator/control-plane script as if
it were a local feature. Presenting excluded dispatch machinery as a quickstart
step would (a) break, because the script is not shipped, and (b) blur the
open-core boundary this package is built to keep clean. The current product gates
above are the only supported way to prove the local context contract.
