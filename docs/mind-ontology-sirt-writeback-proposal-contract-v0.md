# Mind Ontology — SIRT Writeback Proposal Contract v0

**Status:** Phase 4 / P4-PR02 (hosted SIRT on-ramp) — **proposal-only contract + fail-closed default**
**Module:** `scripts/agentctx/adapters/writeback-adapter.mjs`

When an agent makes a durable decision, the operator may want it written back to
hosted SIRT memory. This document defines the **writeback proposal contract**.
It deliberately stops at *proposal*: this layer constructs inert candidates and
**never executes a write**. No hosted endpoint, auth, secret, or live call.

---

## The contract

```ts
interface WritebackProposalAdapter {
  name: string;
  // Returns inert PROPOSALS. Never writes.
  proposeWriteback(input: {
    decision: string;
    context?: object;
  }): Promise<{ proposals: WritebackProposal[] }>;
}

interface WritebackProposal {
  kind: "node" | "edge";
  summary: string;     // human-readable description of the candidate write
  payload: object;     // the data a downstream executor *would* write
  status: "proposed";
}
```

**There is intentionally no `execute()` / `write()` on this contract.** Execution
is out of scope for the OSS layer and must be a separately-reviewed, explicitly
human-gated step (consistent with the project's live-write discipline).

---

## Fail-closed collection

`collectWritebackProposals(adapter, input)`:

| Situation | Result |
|---|---|
| No / non-conforming adapter | `{ proposals: [], degraded: true, reason: "no-adapter" }` |
| Adapter throws | `{ proposals: [], degraded: true, reason: "adapter-error: …" }` |
| Malformed proposals | dropped (`isWritebackProposal`); valid ones kept |
| Valid proposals | `{ proposals, degraded: false }` |

It only ever *gathers candidates* — it cannot write, even on the happy path.

---

## Building a proposal

`buildWritebackProposal({ kind, summary, payload })` constructs an inert proposal
object with `status: "proposed"`. It validates the kind and requires a summary;
it performs no I/O.

---

## Boundary & safety

- **Proposal-only.** No write executes here. The gap between "proposed" and
  "written" is closed by an explicit, separately-reviewed confirmation step
  outside the OSS layer.
- **No secrets.** A real adapter (hosted SIRT) is operator-configured via
  environment; the OSS layer ships only this contract and the null default.
- **Local-first.** With no adapter, `proposeWriteback` yields nothing and the
  system is unchanged.

---

## Handoff

- **P4-PR03** — typed edge model (shapes the `edge` proposal payload).
- **P4-PR06** — adapter feature flags with local fail-closed defaults gate
  whether proposals are even collected.
