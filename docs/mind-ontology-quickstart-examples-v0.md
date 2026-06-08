# Mind Ontology — Quickstart Examples v0

**Status:** Phase 5 / P5-PR02 (launch readiness)

Worked examples for the free layer. Every example here is backed by
`tests/unit/agentctx-quickstart-examples.test.mjs`, which runs the same tooling
against a freshly scaffolded `.agentctx/` and asserts the documented outcomes —
so these examples cannot drift from the code.

Scaffold first:

```sh
npm run agentctx:init -- --cwd ./demo
```

---

## Example 1 — A focused task

```sh
npm run agentctx:compile -- --cwd ./demo \
  --task "Decide which agent role handles code review" --scope review --format json
```

Outcome:
- `constraints.md` blocks are **always** included (`score: "always"`).
- at least one block is selected by relevance (`reason: "matched"` — here the
  `#review` role from `agent-roles.md`).
- unrelated blocks are omitted, not dumped.

## Example 2 — How focused is the pack?

```sh
npm run agentctx:metrics -- --cwd ./demo \
  --task "Decide which agent role handles code review" --scope review
```

Outcome: a **selection ratio** and **body ratio** below 100% — the agent
receives a fraction of the whole ontology, with `taskMatched: true` and the
requested scope covered.

## Example 3 — A risky task forces safety context

```sh
npm run agentctx:compile -- --cwd ./demo \
  --task "Delete the production database and drop the schema" --format json
```

Outcome: `risk.level: "risky"` with signals, and any safety-tagged block is
forced into the pack (`reason: "risk-forced"`) on top of the always-included
constraints.

## Example 4 — A task that matches nothing still gets constraints

```sh
npm run agentctx:metrics -- --cwd ./demo --task "zzzz unrelated gibberish"
```

Outcome: `taskMatched: false`, `matchedBlocks: 0`, but `alwaysBlocks ≥ 1` — the
non-negotiable constraints are never dropped.

## Example 5 — Validate the ontology

```sh
npm run agentctx:validate -- --cwd ./demo
```

Outcome: `VALID — 0 error(s)` on the shipped template; a malformed source (e.g.
a `projects.md` active block missing `Status:`) fails with a clear message.

---

## One-command check

```sh
npm run agentctx:smoke
```

Runs the whole init → compile journey in a temp dir and prints `SMOKE PASS`.
