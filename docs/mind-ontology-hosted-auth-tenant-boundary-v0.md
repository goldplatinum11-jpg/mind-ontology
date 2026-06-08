# Mind Ontology — Hosted Auth & Tenant Boundary v0

**Status:** Phase 4 / P4-PR04 (hosted SIRT on-ramp) — **design doc only**

Defines how an optional hosted SIRT deployment authenticates operators and keeps
tenants isolated, and exactly where the OSS / hosted boundary sits. This is
design only: **no auth code, no secret, no tenant store, no endpoint** is added.

The governing rule from earlier Phase 4 lanes still holds: the OSS layer is
local-first and fail-closed. Auth and tenancy live entirely on the hosted side;
the OSS layer holds no credentials and works without any of this.

---

## Where the boundary sits

```text
┌────────────────────────── OSS (this repo) ──────────────────────────┐
│ .agentctx/ files · compiler · local stdio MCP · adapter CONTRACTS    │
│ no auth, no tenant, no secret, fail-closed null adapters             │
└──────────────────────────────────────────────────────────────────────┘
                      │  optional, operator-configured
                      ▼
┌──────────────────────── Hosted SIRT (separate) ─────────────────────┐
│ auth · tenant isolation · memory retrieval · writeback execution     │
│ operator-owned credentials, never in the OSS repo                    │
└──────────────────────────────────────────────────────────────────────┘
```

Everything above the line ships in this repo and needs no account. Everything
below the line is the operator's own hosted deployment.

---

## Authentication (hosted side)

- The hosted adapter is reached over the thin HTTP surface (Phase 3) with an
  **operator-supplied bearer or OAuth**. The value is set in the operator's
  environment / secret store and entered in the client connector UI — **never
  committed**.
- The OSS layer passes whatever token the operator configured straight through
  the transport; it neither generates, stores, nor logs it.
- No-auth is valid only for a local/private dev endpoint.

---

## Tenant isolation (hosted side)

- **One workspace per credential.** A token resolves to exactly one tenant /
  `.agentctx` workspace. Cross-tenant reads or writes are impossible by
  construction on the hosted side.
- Retrieval and writeback-proposal calls are scoped to the caller's tenant; a
  result or proposal can never reference another tenant's nodes.
- The hosted store is responsible for row-level / namespace isolation; the OSS
  contracts carry no tenant id because the OSS layer is single-workspace.

---

## What the OSS layer guarantees regardless

- Holds **no** credentials, tenant ids, or hosted URLs (placeholders only).
- Degrades to pure-local behavior if auth fails or is absent (fail-closed,
  per the adapter contracts).
- Never logs or persists a token.

---

## Non-goals (Phase 4)

- No identity provider, session store, or token issuance is implemented here.
- No multi-tenant database schema is added to this repo.
- These are the operator's hosted-deployment responsibilities, documented so the
  boundary is explicit — not built in the OSS layer.

---

## Handoff

- **P4-PR05** — OSS-to-hosted upgrade flow (how an operator turns the on-ramp on).
- **P4-PR06** — adapter feature flags with local fail-closed defaults.
- **P4-PR08** — hosted boundary no-leakage audit (verifies the OSS layer emits no
  credential/tenant data).
