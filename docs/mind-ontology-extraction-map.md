# Mind Ontology Standalone Extraction Map

**Status:** Plan of record — **executed**. The standalone extraction this map
describes has since been carried out; the executed inventory is
[`../EXTRACTION-INVENTORY.md`](../EXTRACTION-INVENTORY.md).  
**Scope:** OSS MCP foundation  
**Base repo:** `sirt-app-v2` (read-only provenance — not a live source)

> **Provenance chain:** this is the *plan* (target shape, boundary rules,
> extraction sequence). For what was actually copied, reviewed, excluded, and
> tested, see [`../EXTRACTION-INVENTORY.md`](../EXTRACTION-INVENTORY.md). All
> `sirt-app-v2` paths below are historical references, not editable sources.

This document defines how the repo-local Mind Ontology / agentctx prototype
became a standalone OSS MCP package without leaking hosted SIRT backend value.

The extraction goal is not to move files immediately. The goal is to make the
future package boundary explicit enough that the next PRs can build toward it
without accidental coupling.

---

## Target package shape

The standalone project should expose Mind Ontology as the product and keep
`agentctx` as the implementation/compiler label.

```text
mind-ontology/
  package.json
  README.md
  LICENSE
  src/
    compile/
    mcp/
    schema/
    cli/
  templates/
    .agentctx/
  docs/
    quickstart.md
    mcp-clients.md
    open-core-boundary.md
  tests/
```

The first extracted package should be Node/TypeScript-friendly, but the v0
source format remains Markdown and does not require a database.

---

## Current repo artifacts

| Current artifact | Future package role | Extract? | Notes |
|---|---|---:|---|
| `scripts/agentctx/compile.mjs` | context pack compiler | yes | Move into `src/compile/` and keep CLI wrapper thin. |
| `scripts/agentctx/mcp-server.mjs` | local stdio MCP server | yes | Move into `src/mcp/`; expose only thin tools in v0. |
| `.agentctx/constraints.md` | sample / dogfood source | template subset | Do not ship SIRT-private constraints as default user content. |
| `.agentctx/direction.md` | sample / dogfood source | template subset | Convert to neutral examples. |
| `.agentctx/decisions.md` | sample / dogfood source | template subset | Convert to product-neutral example decisions. |
| `.agentctx/architecture.md` | sample / dogfood source | template subset | Keep only generic examples. |
| `templates/mind-ontology/.agentctx/**` | neutral starter templates | yes | Ship as the package init source. |
| `docs/agentctx.md` | implementation docs | yes, rewrite | Rename around Mind Ontology product language. |
| `docs/mind-ontology.md` | product overview | yes | Becomes public product architecture page. |
| `docs/mind-ontology-mcp-readme.md` | public README draft | yes | Becomes package `README.md`. |
| `docs/operator/**` | SIRT operator runway | no | Internal controller/runway machinery stays in SIRT. |
| `scripts/operator/**` | SIRT automation | no | Do not extract into OSS package. |
| hosted SIRT memory/graph/writeback | paid backend | no | Optional adapter contract only. |

---

## Public API boundary

The OSS package should stabilize these surfaces first:

```text
CLI:
  mind-ontology compile --task "..." [--scope "..."] [--format markdown|json]
  mind-ontology init [--template mind-ontology]

MCP tools:
  get_context(task: string, scope?: string)
  list_constraints()

Source layout:
  .agentctx/constraints.md
  .agentctx/direction.md
  .agentctx/decisions.md
  .agentctx/architecture.md
```

Future schema files can be added without breaking v0 clients:

```text
.agentctx/identity.md
.agentctx/projects.md
.agentctx/glossary.md
.agentctx/agent-roles.md
.agentctx/cq.md
```

The v0 API should not expose SIRT internals, memory node IDs, graph schemas,
tenant IDs, hosted auth, or writeback implementation details.

---

## Package boundary rules

The standalone package may contain:

- Markdown source parsing;
- deterministic block scoring;
- context-pack rendering;
- local stdio MCP server;
- template `.agentctx/` files;
- local schema validation;
- client setup examples;
- optional adapter interfaces.

The standalone package must not contain:

- hosted SIRT graph engine;
- hosted memory writeback implementation;
- tenant data model;
- Cloudflare production bindings from SIRT;
- SIRT autonomous runner internals;
- operator queue or merge/deploy automation;
- secrets, production config, or environment-specific defaults.

This is the open-core split. The free layer gives agents a portable meaning
source. Hosted SIRT keeps the durable memory graph and automation backend.

---

## Import direction

Dependency direction should remain one-way:

```text
SIRT app may import/use Mind Ontology package.
Mind Ontology package must not import/use SIRT app internals.
```

Allowed future relationship:

```text
mind-ontology core
  <- optional adapter interface
hosted SIRT adapter
  <- implemented in SIRT-hosted code, not OSS core
```

This keeps the OSS layer installable by users who do not have SIRT.

---

## Extraction sequence

1. Keep dogfooding in `sirt-app-v2` until Phase 1 proves the free layer.
2. Add template `.agentctx/` examples that contain no SIRT-private policy.
3. Add `agentctx:init` as the repo-local scaffold command, then rename or wrap
   it as `mind-ontology init` during standalone extraction.
4. Add validation for required source files and friendly errors.
5. Move compiler and MCP code into package-shaped directories in place.
6. Create the standalone repo/package when docs, templates, CLI, and MCP smoke
   are coherent.

Each step should remain testable inside this repo before any actual extraction.

---

## Acceptance criteria

The package boundary is ready for extraction when all of these are true:

- a new user can create `.agentctx/` from templates without reading SIRT docs;
- `get_context(task)` works from only local files;
- `list_constraints()` works without SIRT;
- docs explain the OSS layer and hosted SIRT boundary in product language;
- no SIRT operator scripts are required for normal package use;
- tests prove compiler/MCP behavior without network, database, or hosted state.

The result should feel like a standalone product, not a folder borrowed from a
larger private system.
