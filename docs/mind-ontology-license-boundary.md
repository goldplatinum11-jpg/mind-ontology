# Mind Ontology OSS License and Hosted Boundary

**Status:** Draft for Phase 1 / P1-PR03  
**Scope:** Recommendation only; no license file change in this PR  
**Product:** Mind Ontology MCP

This document recommends the OSS license posture for Mind Ontology MCP and
draws the commercial boundary between the free self-hosted layer and hosted
SIRT.

---

## Recommendation

Use a permissive OSS license for the Mind Ontology MCP package:

```text
Recommended default: Apache-2.0
Acceptable fallback: MIT
Not recommended for v0: AGPL/GPL
```

Apache-2.0 is the preferred default because it is developer-friendly while also
including an explicit patent grant. That matters for an MCP tool meant to be
embedded into many AI-agent workflows and commercial codebases.

MIT is acceptable if the project wants the simplest possible adoption story.
AGPL/GPL is not recommended for v0 because the trust/adoption goal is more
important than copyleft leverage.

Final license selection should happen only when the standalone package or repo
is created.

---

## Why permissive licensing fits this layer

The OSS layer injects context into AI agents. Developers will be cautious about
closed or legally heavy components that sit in the middle of their agent
workflows.

A permissive license helps because it:

- makes self-hosting and inspection easy;
- lets companies test the MCP server without procurement friction;
- lets agent-tool builders integrate examples and client adapters;
- keeps the free layer credible as infrastructure;
- avoids forcing hosted SIRT adoption before the user trusts the context layer.

This is adoption infrastructure, not the full value-capture backend.

---

## What the OSS license should cover

The permissive license should cover:

- Mind Ontology MCP server;
- local context compiler;
- source schema and Markdown layout;
- CLI wrapper;
- template `.agentctx/` files;
- public docs and examples;
- local validation and smoke tests;
- client setup examples.

The licensed OSS package should be complete enough that a user can run:

```text
mind-ontology init
mind-ontology compile --task "..."
mind-ontology mcp
```

without a hosted SIRT account.

---

## What remains outside the OSS grant

Hosted SIRT backend value should remain outside the Mind Ontology MCP OSS core:

- memory graph storage;
- vector retrieval infrastructure;
- typed edge inference;
- writeback submission and review backend;
- tenant storage and hosted auth;
- autonomous controller/runner internals;
- council routing and multi-agent orchestration;
- production Cloudflare bindings and deployment configuration;
- commercial analytics, billing, and admin surfaces.

The OSS package can define adapter interfaces for these capabilities. It should
not ship the hosted implementation.

---

## Open-core boundary

The commercial boundary should be simple enough to explain in one sentence:

```text
Mind Ontology MCP is free and self-hosted; hosted SIRT adds durable memory,
retrieval, graph, writeback, and cross-agent learning.
```

| Capability | OSS Mind Ontology MCP | Hosted SIRT |
|---|---:|---:|
| Local `.agentctx/` files | yes | yes |
| `get_context(task)` | yes | yes |
| `list_constraints()` | yes | yes |
| Self-hosted local stdio MCP | yes | optional |
| Template/source validation | yes | yes |
| Persistent memory across sessions | no | yes |
| Similar prior decision retrieval | no | yes |
| Typed graph relationships | no | yes |
| Agent writeback workflow | proposal interface only | yes |
| Multi-tenant hosted storage | no | yes |
| Cross-agent memory growth | no | yes |
| Autonomous control-plane history | no | yes |

The free layer should not be crippled. It should be useful enough that users
trust it. The paid layer should become valuable when the user wants memory that
grows beyond flat files.

---

## Naming and trademark posture

Use "Mind Ontology" as the product name and reserve "SIRT" for the hosted
memory/control-plane layer.

Public docs should avoid implying that the OSS license grants rights to:

- the SIRT hosted service;
- private SIRT brand assets;
- production infrastructure;
- operator-specific templates or private ontology content.

If a standalone repo is created, include a short trademark note that the license
covers code and docs, not hosted service marks or private deployments.

---

## Contributor posture

For v0, keep contribution rules lightweight:

- require no secrets or private ontology content in issues/PRs;
- require tests for compiler/MCP behavior changes;
- require templates to be generic and non-SIRT-private;
- route hosted SIRT backend requests to adapter contracts, not core code.

A full CLA/assignment process is not necessary for the initial OSS spike unless
external contribution volume appears.

---

## Acceptance criteria

P1 license/boundary work is sufficient when:

- README/product docs explain that OSS users self-host and pay their own
  runtime costs;
- docs recommend Apache-2.0 as the default package license;
- hosted SIRT value is clearly outside the OSS core;
- adapter contracts are allowed without shipping hosted implementation;
- no SIRT backend, secrets, production config, or tenant model is exposed as
  part of the Mind Ontology MCP free layer.

This keeps the adoption layer open and trustable while preserving the paid
memory graph as the commercial engine.
