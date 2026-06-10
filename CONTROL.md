# Mind Ontology Workspace

Purpose: independent product workspace for Mind Ontology / agentctx / ontology MCP work.

> **Migration status: COMPLETE.** The extraction from the original development
> workspace finished; this repository is the standalone source of truth for
> Mind Ontology. The notes below are kept as the historical control record —
> nothing here describes an active migration.

Historical migration record (closed):
- Source runway: `mind-ontology-seven-hour-runway` (worker session
  `fa70c538-d2da-409d-9e10-c7968803feef`), Phase 5 launch readiness.
- The runway reached its Result Pack; only Mind Ontology files and PR lineage
  were extracted. Provenance: `EXTRACTION-INVENTORY.md` and
  `docs/mind-ontology-extraction-map.md`.

Boundary (still enforced):
- No control-plane/dashboard implementation from the parent workspace.
- No biohack/unrelated tooling.
- No generic runner infrastructure unless explicitly required as an adapter
  boundary (regressed by the control-plane import audit test).

This file is internal: it is excluded from the npm tarball by the `files`
allowlist (regressed by `tests/unit/packaging-dry-run-contract.test.mjs`).
