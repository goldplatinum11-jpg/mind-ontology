# Mind Ontology — OSS-to-Hosted Upgrade Flow v0

**Status:** Phase 4 / P4-PR05 (hosted SIRT on-ramp) — **doc only**

How an operator moves from the pure local OSS layer to a hosted-enriched setup —
and back — without ever breaking the local path. The on-ramp is **additive and
reversible**: every step defaults to the local behavior and rolls back instantly.

---

## Stage 0 — Local (default)

Nothing to do. The OSS layer runs with the fail-closed null adapters
(P4-PR01/PR02): no retrieval, no writeback, no account, no secret. This is the
fully-supported baseline.

```text
get_context(task) -> local .agentctx pack only
```

## Stage 1 — Stand up hosted SIRT + connector

Deploy your own hosted SIRT and the thin connector (Phase 3 deployment plan).
Still no change to local behavior — the connector exists but nothing consumes it
yet.

## Stage 2 — Configure the adapter (operator env)

Put the adapter endpoint + credential in your environment / secret store (never
in the repo). The contracts (P4-PR01/PR02) describe the shapes; auth and tenancy
are hosted-side (P4-PR04).

## Stage 3 — Enable the feature flag

Turn the adapter on via the feature flag (P4-PR06), which **defaults off**. Only
now does compilation consult the hosted layer:

```text
get_context(task) -> local pack  +  hosted memory enrichment (labeled section)
```

Enrichment is rendered as a clearly-separated, labeled block so local source
content and hosted memory are never confused.

## Stage 4 — Verify

- Enrichment appears only when the flag is on and the adapter is reachable.
- With the flag off, or the adapter unreachable, output is byte-for-byte the
  local pack (fail-closed).
- Run `npm run agentctx:validate` to confirm the workspace still has no secrets.

## Rollback — instant

Flip the feature flag off (or unset the adapter). The system returns to Stage 0
local behavior immediately. There is no migration to undo, because the local
sources were never modified by the on-ramp.

---

## Invariants across every stage

| Invariant | Holds because |
|---|---|
| Local always works | null adapters + fail-closed entry points (P4-PR01/02) |
| No secret in repo | credentials live in operator env (P4-PR04) |
| Reversible | flag defaults off; sources never mutated (P4-PR06) |
| Read clearly separated from hosted | enrichment is a labeled section |
| Writeback never auto-executes | proposals only, human-gated (P4-PR02) |

---

## Handoff

- **P4-PR06** — the feature flags (local fail-closed defaults) referenced above.
- **P4-PR07** — enriched-context fixtures showing the labeled enrichment section.
- **P4-PR08** — no-leakage audit verifying the OSS layer emits no hosted secret.
