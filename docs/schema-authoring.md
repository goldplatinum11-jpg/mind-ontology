# Schema Authoring Guide

One reference for authoring every `.agentctx/` source file. The authoritative
rules live in `ONTOLOGY_SCHEMA` (`scripts/agentctx/schema.mjs`); this guide
explains them in one place. Run `npm run agentctx:validate` to check your work.

## Block format (shared by every file)

The skeleton below is illustrative only — angle-bracket placeholders, not a
real source file — and is not validated. For validated minimal examples, see
the per-file `*-schema-v0.md` reference docs.

```md
# <File Title>

## <Block heading> #tag1 #tag2

Block body. The compiler scores headings, tags, and body against the task.
```

- One `#` H1 title per file (ignored by the compiler).
- Each `##` heading is a **block**; inline `#tag` tokens are extracted as tags
  and stripped from the rendered title.
- A block needs a non-empty body.

## Per-file rules

### `constraints.md` — required, always included

The only **required** file: it must exist and be non-empty (an empty
`constraints.md` fails validation). Every compiled pack includes all of its blocks
(`reason: "always"`). Put non-negotiable rules here. No credential-shaped values
anywhere in any source (the validator rejects `api_key: …`, tokens, etc.).

### `identity.md`

- Every block must carry at least one tag.
- Must include a block tagged **`#identity`** and one tagged **`#style`**.
- Recommended (warning if absent): `#operator`, `#collaboration`.

### `direction.md`

- Free-form scored source: `##` blocks describing what you're building now. No
  required tags, but tag blocks so the compiler can surface them by scope.

### `projects.md`

- Must include a block tagged **`#active`**.
- Each `#active` block needs `Name:` and `Status:` fields in its body.
- `Status:` must be one of: **active, exploratory, paused, archived**.

### `decisions.md`

- Free-form scored source: durable decisions and their reasons. Tag by topic so
  the right decision surfaces for a task.

### `architecture.md`

- Free-form scored source: how the system is shaped. Optional but recommended.

### `agent-roles.md`

- Namespace tag **`#agent`** on every role block.
- Each role block carries **exactly one** tag besides `#agent` (the role name)
  and a non-empty body.
- Must include blocks tagged **`#coding`** and **`#review`**.

### `glossary.md`

- Namespace tag **`#term`** on every entry.
- Each entry needs **one extra topic tag** and a non-empty body.
- Entry titles must be **unique**, compared case-insensitively (`Foo` and `foo`
  count as duplicates).

### `cq.md` — competency questions

- Namespace tag **`#cq`** on every block.
- Each heading is phrased as a **question** (ends with `?`).
- Each carries **one extra topic tag** and a non-empty body.
- Must include CQs tagged **`#context`** and **`#safety`**.

## Adding a new source file

A new `.agentctx/` file is **additive** (a project that omits it still works).
To add one: add it to `SOURCE_FILES` in `compile.mjs`, give it a rule in
`ONTOLOGY_SCHEMA`, ship a `*-schema-v0.md` doc, and add a conformance test. See
[`mind-ontology-extraction-map.md`](mind-ontology-extraction-map.md) for the
forward-compatible source list and [testing](testing.md) for the test pattern.

Per-file schema docs: identity, projects, glossary, agent-roles, and cq each have
a `mind-ontology-<file>-schema-v0.md` reference with examples.
