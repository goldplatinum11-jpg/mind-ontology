# Mind Ontology — Schema Validation v0

**Status:** Phase 2 / P2-PR07
**Command:** `npm run agentctx:validate` (alias for `node scripts/agentctx/schema.mjs`)
**Module:** `scripts/agentctx/schema.mjs` — `validateOntology(cwd)`

Schema validation turns the per-source schemas defined in P2-PR01–05 into an
executable check. It answers: **does this project's `.agentctx/` actually match
the Mind Ontology contract?** — without an agent having to eyeball each file.

It is data-driven: `ONTOLOGY_SCHEMA` encodes the rules; `validateOntology` walks
the source files in compiler order and applies the rules that exist for each.

---

## Usage

```sh
# Validate the current project's .agentctx/
npm run agentctx:validate

# Validate another project
npm run agentctx:validate -- --cwd "C:/path/to/project"
```

Exit code is `0` when there are no errors, `1` otherwise — safe to wire into CI
next to `agentctx:smoke`. Each issue renders as a `LEVEL [rule] message` line
followed by an aligned `fix:` continuation line with the concrete next action,
and a failing report ends with a pointer to the authoring guide, e.g.:

```text
Mind Ontology schema validation

  ERROR  [required-tag] identity.md is missing a block tagged #style
         fix: Add a block headed "## <title> #style" to identity.md.
  WARNING  [recommended-tag] identity.md has no block tagged #operator (recommended)
           fix: Add a block headed "## <title> #operator" to identity.md (optional; clears this warning).

INVALID — 1 error(s), 1 warning(s)
See docs/schema-authoring.md for the block format and per-file rules.
```

A clean run stays clean — no `fix:` lines and no doc pointer:

```text
Mind Ontology schema validation

  OK — every source conforms to its schema.

VALID — 0 error(s), 0 warning(s)
```

---

## What it checks

Only files that are present are validated. A minimal project shipping only
`constraints.md` validates clean; `constraints.md` itself is required.

| Source | Rules |
|---|---|
| `constraints.md` | Must exist and be non-empty. |
| `identity.md` | Required `#identity` and `#style` blocks; every block tagged; `#operator` / `#collaboration` recommended. |
| `projects.md` | Required `#active` block with `Name:` and `Status:` fields; any `Status:` must be one of `active`, `exploratory`, `paused`, `archived`. |
| `glossary.md` | At least one `#term` block; each term has a topic tag, a non-empty body, and a unique title (case-insensitive). |
| `agent-roles.md` | At least one `#agent` block; each role has exactly one role tag and a non-empty body; required `#coding` and `#review` roles. |
| `cq.md` | At least one `#cq` block; each is phrased as a question (the title ends with `?`), has a topic tag, and a non-empty body; required `#context` and `#safety` topics. |
| _all files_ | No credential-shaped `key: value` assignments (no-secrets rule). |

---

## Levels

- **error** — violates a required rule; fails validation (exit 1).
- **warning** — a recommended (`SHOULD`) rule is unmet; does not fail validation.

---

## Relationship to compile

`validate` is intentionally **separate** from `compile`. `compile` enforces only
the hard prerequisite (`constraints.md` present and non-empty) via
`validateAgentctxSources`, so context packs stay cheap to produce. `validate` is
the opt-in, fuller schema check an author or CI runs to keep the ontology
healthy. This keeps compilation fast while still offering a strict gate.

---

## Programmatic use

```js
import { validateOntology } from "./scripts/agentctx/schema.mjs";

const report = validateOntology(process.cwd());
if (!report.ok) {
  for (const issue of report.issues) {
    console.error(`${issue.level} [${issue.rule}] ${issue.message}`);
    if (issue.remedy) console.error(`  fix: ${issue.remedy}`);
  }
}
```

`report` is `{ ok, errors, warnings, issues }`, where each issue is
`{ file, level, rule, message, remedy }`. `remedy` is the concrete next action
for that rule (the same text the CLI renders on the `fix:` line), built from
`RULE_REMEDIES` in `schema.mjs`; it is `null` only if a rule has no mapping.
