# Mind Ontology — Trust & Security Model v0

**Status:** Phase 5 / P5-PR04 (launch readiness)

Why Mind Ontology is safe to adopt, stated plainly. The model is **local-first,
read-only, fail-closed, and credential-free in the repo** — each property is
enforced by code and tests shipped in earlier phases, not just asserted here.

---

## 1. Local-first — the default needs nothing

The free layer is a folder of Markdown plus a Node script. No account, no
database, no network. `get_context` / `list_constraints` run as a local stdio
process in your environment. If you never configure anything hosted, nothing
hosted ever runs.

## 2. Reviewable — it's just files

The ontology is plain `.agentctx/` Markdown; the compiler and MCP server are
small, dependency-free Node modules. Every change is a normal diff you can read
and approve in a PR. There is no opaque index or remote brain to trust.

## 3. Read-only surfaces

Every client surface — local stdio and the thin HTTP connector — exposes exactly
two **read** operations (`get_context`, `list_constraints`). There is no write,
graph-mutation, or delete operation on any surface. Unknown calls fail closed.

## 4. No credentials in the repo

The OSS layer holds **no** secrets, tokens, tenant ids, or hosted URLs —
connector configs ship placeholders only. Real values are operator-supplied via
the client UI or environment. This is both a written constraint
(`constraints.md` → "No secrets in ontology files") and an **audited** one
(`agentctx-no-leakage-audit.test.mjs`, `agentctx-validate`).

## 5. Hosted is opt-in, fail-closed, reversible

The hosted SIRT on-ramp is gated behind feature flags that **default off**. With
the flag off — or the adapter missing or erroring — retrieval and
writeback-proposal collection return empty and the system behaves exactly as the
pure local layer. Unset the flag and you are instantly back to local.

## 6. Writeback never auto-executes

The writeback contract is **proposal-only**. There is intentionally no `execute`
path in the OSS layer; a proposal is inert until a human (or a separately
reviewed, gated executor) confirms it.

## 7. Risk-aware by default

On a destructive/structural task, the compiler **forces** the relevant safety
blocks into the context pack, so an agent about to do something dangerous always
sees the constraints — even if the task wording didn't match them.

---

## Enforcement map

| Property | Enforced by |
|---|---|
| No secrets in repo | `constraints.md` + `agentctx:validate` + no-leakage audit |
| Read-only surfaces | MCP server tool list + OpenAPI (two ops) + setup proofs |
| Fail-closed hosted | null adapters + feature flags (default off) + tests |
| Writeback proposal-only | writeback contract (no execute) + test |
| Risk-aware | task-risk modes + tests |
| Reviewable | files + diffs; no opaque store |

---

## Threats explicitly out of scope (operator-owned)

- Hosting, TLS, rate-limiting, and auth of a self-hosted connector are the
  operator's deployment responsibility (documented, not implemented here).
- Multi-tenant isolation lives on the hosted side (P4-PR04).

The boundary is deliberate: the OSS layer is small enough to fully trust, and
everything that would require trusting a remote service is opt-in and yours.
