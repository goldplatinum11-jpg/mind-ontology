# Mind Ontology — Adapter Feature Flags v0

**Status:** Phase 4 / P4-PR06 (hosted SIRT on-ramp)
**Module:** `scripts/agentctx/adapters/flags.mjs`

Gates the optional hosted adapters (memory retrieval, writeback proposals) behind
feature flags that **default off**. This is the switch the upgrade flow (P4-PR05)
flips — and the guarantee that nothing hosted happens until an operator
explicitly turns it on.

---

## Flags

| Flag (env var) | Enables | Default |
|---|---|---|
| `AGENTCTX_ENABLE_MEMORY` | hosted memory retrieval enrichment | **off** |
| `AGENTCTX_ENABLE_WRITEBACK` | hosted writeback proposals | **off** |

Only the exact values `1`, `true`, `on`, `yes` (case-insensitive) enable a flag.
Anything else — unset, `0`, `false`, `off`, or a typo — is **off**. So a
misconfiguration degrades to local rather than silently enabling the hosted path.

---

## Selecting an adapter (double gate)

```js
import { resolveAdapterFlags, selectMemoryAdapter } from "./flags.mjs";

const flags = resolveAdapterFlags(process.env);
const adapter = selectMemoryAdapter(flags, maybeHostedAdapter);
// adapter === the hosted one ONLY IF the flag is on AND it conforms;
// otherwise NULL_MEMORY_ADAPTER (fail-closed).
```

`selectMemoryAdapter` / `selectWritebackAdapter` return the configured adapter
**only when** (a) the flag is on **and** (b) the adapter object conforms to its
contract. Either condition failing yields the null adapter.

---

## Why this is safe

- **Default off:** no hosted call without an explicit env opt-in.
- **Fail-closed selection:** flag on + broken adapter still resolves to null.
- **Reversible:** unset the flag → instant return to local behavior (P4-PR05).
- **No secret here:** the flag only toggles; the adapter and its credentials are
  operator-supplied elsewhere.

---

## Handoff

- **P4-PR07** — fixtures showing the enrichment a flag-on memory adapter would add.
- **P4-PR08** — no-leakage audit (the OSS layer, flags on or off, emits no
  hosted credential).
