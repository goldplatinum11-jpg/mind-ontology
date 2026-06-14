# Examples

Worked, runnable `.agentctx/` ontologies you can compile against directly.

## `team-ontology/`

A richer, multi-project example: a fictional **Helios** B2B scheduling team with
three projects, real decisions (caching, API versioning, flagged rollout),
constraints, glossary, agent roles, and competency questions. Use it to see
task-scoped compilation on a non-trivial ontology.

```sh
# Validate it
node scripts/agentctx/schema.mjs --cwd docs/examples/team-ontology

# Compile a focused pack (booking-latency work)
node scripts/agentctx/compile.mjs compile --cwd docs/examples/team-ontology \
  --task "speed up the booking confirmation path" --scope performance

# A risky task forces the safety blocks in
node scripts/agentctx/compile.mjs compile --cwd docs/examples/team-ontology \
  --task "drop the production bookings table" --format json
```

This example is exercised by `tests/unit/example-team-ontology.test.mjs`, so it
stays valid and in sync with the compiler.

## `solo-founder-ai-os/`

A second worked example for a non-engineering operator: a **solo founder running
an open-core business**, Lumen, across several active projects. It shows the
product's value when one person juggles multiple lines at once:

- multiple active projects (`lumen-cloud`, `lumen-core`, `lumen-docs`) plus an
  archived one;
- a hard **open-core boundary** — free/OSS **Lumen Core** (Apache-2.0) vs paid,
  hosted **Lumen Cloud** — that the AI must not blur;
- vocabulary that prevents confusion (our **Lumen** vs the competitor
  **Luminary**; **Workspace** = a billed tenant, not a folder);
- constraints that make the AI **fail closed** around deploy, publish, release,
  and secrets;
- agent roles for a **Codex/Claude/ChatGPT-style** Planner → Builder → Reviewer
  collaboration;
- competency questions that point at the source files that answer them.

```sh
# Validate it
node scripts/agentctx/schema.mjs --cwd docs/examples/solo-founder-ai-os

# Hosted vs open-core scoping surfaces different slices
node scripts/agentctx/compile.mjs compile --cwd docs/examples/solo-founder-ai-os \
  --task "grow the paid managed product" --scope hosted
node scripts/agentctx/compile.mjs compile --cwd docs/examples/solo-founder-ai-os \
  --task "keep the free engine useful standalone" --scope oss

# A deploy/publish task fails closed: safety context is forced in
node scripts/agentctx/compile.mjs compile --cwd docs/examples/solo-founder-ai-os \
  --task "deploy lumen cloud to production and publish the release" --format json
```

This example is exercised by `tests/unit/example-solo-founder-ontology.test.mjs`,
so it stays valid and in sync with the compiler.

## `studio-multi-client/`

A third worked example for the **multi-client** case: a small AI product studio,
**Northstar**, running several concurrent client engagements. Where the others
show one operator's projects, this one stresses **isolation** — the AI must scope
to one client and never leak another's context:

- multiple active client engagements (`client-acme`, `client-northwind`,
  `client-globex`) plus a shared `studio-platform` and an archived pilot;
- a hard **per-client isolation boundary** — scoping to one client surfaces that
  client's project and direction and *not* another client's;
- decisions and constraints that make cross-client data mixing the studio's
  number-one forbidden action;
- competency questions that include "which client and project does this task
  belong to?", pointing at the files that answer it.

```sh
# Validate it
node scripts/agentctx/schema.mjs --cwd docs/examples/studio-multi-client

# Scoping to one client surfaces only that client's slice
node scripts/agentctx/compile.mjs compile --cwd docs/examples/studio-multi-client \
  --task "work on the storefront product search" --scope client-acme
node scripts/agentctx/compile.mjs compile --cwd docs/examples/studio-multi-client \
  --task "work on the patient scheduling flow" --scope client-northwind

# A cross-client destructive task fails closed: safety context is forced in
node scripts/agentctx/compile.mjs compile --cwd docs/examples/studio-multi-client \
  --task "delete one client's records and copy them into another client's workspace" --format json
```

This example is exercised by `tests/unit/example-studio-multi-client.test.mjs`,
so it stays valid and in sync with the compiler.

## Routing across the library

These three boxes together form a small library. Each carries an
`.agentctx/manifest.json` declaring the trigger terms that route to it, so you can
ask "which box does this task belong to?" and then compile it — without naming the
box yourself.

```sh
# Which box is this task about? (deterministic, with a why)
node scripts/agentctx/router.mjs route --library docs/examples \
  --task "booking latency on the partner API"          # -> team-ontology
node scripts/agentctx/router.mjs route --library docs/examples \
  --task "Lumen Cloud hosted billing"                  # -> solo-founder-ai-os

# Route AND compile in one step — pick the box, then its task-scoped pack
node scripts/agentctx/compile.mjs compile --library docs/examples \
  --task "Acme client engagement isolation" --format json   # routes -> studio-multi-client
```

Routing is exercised by `tests/unit/router.test.mjs`. It is deterministic (verbatim
trigger matching, so it handles non-English terms) and never blends boxes — on a
close call it picks one and reports the ranked candidates with reasons.
