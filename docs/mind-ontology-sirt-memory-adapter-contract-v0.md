# Mind Ontology — SIRT Memory Retrieval Adapter Contract v0

**Status:** Phase 4 / P4-PR01 (hosted SIRT on-ramp) — **contract + local fail-closed default only**
**Module:** `scripts/agentctx/adapters/memory-adapter.mjs`

Phase 4 lets an operator *optionally* enrich the local ontology with hosted SIRT
memory. This document defines the **retrieval adapter contract** and ships the
**local fail-closed default**. It adds no hosted endpoint, auth, or secret, and
no live network call.

The rule that makes the on-ramp safe: **the local ontology never depends on the
hosted layer.** If no adapter is configured — or it errors, or returns garbage —
compilation behaves exactly as the pure OSS layer.

---

## The contract

```ts
interface MemoryRetrievalAdapter {
  name: string;
  // READ-ONLY. Returns memory results relevant to the task.
  retrieve(query: {
    task: string;
    scopes?: string[];
    limit?: number;
  }): Promise<{ results: MemoryResult[] }>;
}

interface MemoryResult {
  id: string;        // required, stable identifier
  text: string;      // required, the retrieved content
  score?: number;    // optional relevance score
  source?: string;   // optional provenance label
}
```

- **Read-only.** A retrieval adapter MUST NOT write. Writeback is a separate
  contract (P4-PR02).
- **Optional.** The default is `NULL_MEMORY_ADAPTER`, which returns `{ results: [] }`.

---

## Fail-closed retrieval

`retrieveMemory(adapter, query)` is the safe entry point:

| Situation | Result |
|---|---|
| No / non-conforming adapter | `{ results: [], degraded: true, reason: "no-adapter" }` |
| Adapter throws | `{ results: [], degraded: true, reason: "adapter-error: …" }` |
| Adapter returns non-array / malformed | malformed results dropped; conforming kept |
| Adapter returns valid results | `{ results, degraded: false }` |

Malformed individual results are filtered out (`isMemoryResult`), so a partial
or buggy adapter can never inject ill-formed data into a pack.

---

## Where it plugs in (later lanes)

This PR defines the contract and the null default only. Wiring an adapter into
compilation is gated behind a feature flag that **defaults off / local**
(P4-PR06), and enrichment is rendered as a clearly-separated, labeled section so
local source blocks and hosted memory are never confused.

---

## Boundary & safety

- **No secrets in the repo.** A real adapter (hosted SIRT) is configured by the
  operator via environment/secret store; the OSS layer ships only this contract
  and the null default.
- **Read-only.** No mutation path here.
- **Local-first.** Removing or disabling the adapter returns the system to the
  exact OSS behavior — the on-ramp is additive, never load-bearing.

---

## Handoff

- **P4-PR02** — SIRT writeback proposal contract (the write direction, proposal
  only, gated).
- **P4-PR03** — typed edge model.
- **P4-PR06** — adapter feature flags with local fail-closed defaults.
