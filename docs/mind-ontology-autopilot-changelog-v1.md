# Mind Ontology — Autopilot Pack Changelog v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

An append-only summary of what landed in the pack, grouped by theme. It is a
reading aid, not a contract — the contract is the guard tests. A future v2 starts
a new changelog; this one stays frozen at the v1 contract (two read-only tools,
local-first, the stop policy). See [pack versioning](mind-ontology-autopilot-versioning-v1.md).

---

## v1 — what landed

### Frame & behavior

- The pack frame, the agent reading protocol, and the stop policy (valid vs
  invalid terminal stops), with risk-aware safety forcing and a safe-continuation
  posture.

### Adoption & surface

- An adoption walkthrough, a worked quickstart run, a portability statement, the
  two-tool contract, and the two-tool-vs-many rationale.

### Handoff & discipline

- The Result Pack shape and walkthrough, the controller review checklist, the
  worker self-check, scope discipline, the checkpoint cadence, and the lane
  lifecycle.

### Reference & rationale

- Concepts, glossary tie-in, failure modes, minimal-vs-full, trust tie-in,
  why-local-first, autopilot-vs-single-shot, why-two-roles, common mistakes,
  non-goals, extending the pack, and this changelog.

### Fixtures, kit, and guards

- Four example ontologies (`autopilot-line` nine-file, `autopilot-roles`,
  `autopilot-minimal`, `autopilot-team` multi-project), a drop-in kit (blocks, MCP
  configs, an example agent prompt, a cheat sheet), and one guard test per
  artifact plus cross-cutting guards: consistency sweep, leakage sweep,
  pack-completeness, manifest, acceptance, kit-completeness, discoverability, and
  glossary-completeness.

---

## What did NOT change in v1

The v1 contract held throughout: exactly two read-only tools, no write path, no
hosted dependency in the free path, and the same stop policy. Anything that would
change those is a v2, per the [versioning doc](mind-ontology-autopilot-versioning-v1.md).
See [pack at a glance](mind-ontology-autopilot-manifest-v1.md) for the full set.
