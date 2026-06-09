# Mind Ontology — Autopilot Trust Tie-In v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

How the autopilot pack inherits the product's trust posture. An autonomous line
acts on the context it reads, so the layer it depends on must be small,
file-based, and auditable. This doc ties the pack's two-tool surface to the
product [trust & security model](mind-ontology-trust-security-model-v0.md).

Everything here is local: trust comes from being able to read every file in a PR,
with no hosted SIRT in the load-bearing path.

---

## Trust comes from a small, readable surface

The product trust model rests on three properties; the autopilot pack preserves
each:

| Trust property | How the pack keeps it |
|---|---|
| **Auditable** | the pack is docs, tests, fixtures, and templates — readable in a PR |
| **No hidden data flow** | the two tools read local files and make no network call |
| **Fail-closed hosted boundary** | hosted features stay opt-in, off by default, proposal-only |

An autopilot line that follows the pack never widens this surface: it adds *when*
to read, not *what* the agent can do.

## Why a line must trust its context layer

The line acts on `get_context` output and stops on `list_constraints`. If that
layer were a large, opaque service, the operator could not reason about what the
agent would do. By keeping it two read-only calls over local Markdown, the trust
question stays answerable: *the agent can read your constitution and nothing
else.*

## Where trust would break — and the pack's guard

- **A write tool in the surface** → the agent could act outside the boundary. The
  [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md) forbids it.
- **A hidden network call** → data could leave silently. The leakage sweep and
  no-network design forbid it.
- **A credential in the repo** → the trust surface leaks. The leakage sweep and
  placeholder-only connector forbid it.

Each break is closed by a guard test, so the trust posture is enforced, not just
asserted. See the [trust & security model](mind-ontology-trust-security-model-v0.md)
and the [two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md)
rationale.
