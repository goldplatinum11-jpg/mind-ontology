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
