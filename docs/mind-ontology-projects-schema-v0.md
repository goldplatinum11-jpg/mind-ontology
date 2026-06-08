# Mind Ontology — `projects.md` Schema v0

**Status:** Phase 2 / P2-PR02 (schema definition)
**Source file:** `.agentctx/projects.md`
**Compiler status:** Scored source. Wired into the compiler source list by
P2-PR06 (compiler source-list expansion); this document defines the authoring
contract ahead of that wiring.

`projects.md` answers: **what is being worked on, and which work should the agent
not confuse with the active effort?** It is the work-inventory layer — distinct
from `direction.md` (where the work is going) and `identity.md` (who is helped).

---

## Block model

Shared `.agentctx/` Markdown convention:

- One `# Projects` H1 title line (ignored by the compiler).
- Each `##` heading starts a **block**; inline `#tag` tokens are extracted as
  tags and stripped from the rendered title.
- Block body is the prose beneath the heading.

Project blocks additionally use two **field lines** at the top of the body:

```md
## Active project #project #active

Name: <short project name>
Status: <active | exploratory | paused | archived>

<prose: what it is, why it matters, which repos/docs/tools belong to it>
```

A field line is `Key: value` on its own line. The schema defines `Name` and
`Status`; authors may add further field lines (e.g. `Repo:`), which are treated
as ordinary body text by the compiler.

---

## Required blocks

| Block | Required tag | Required fields | Body |
|---|---|---|---|
| Active project | `#active` | `Name`, `Status` | Non-empty description of the active project. |

The active project block MUST also carry the `#project` namespace tag.

`Status` for the active project SHOULD be `active`.

---

## Optional blocks

| Block | Recommended tags | Notes |
|---|---|---|
| Secondary project | `#project #secondary` | Adjacent project agents should know about but not confuse with the active one. Same `Name` / `Status` fields. |
| Archived project | `#project #archived` | Past work kept for reference. `Status: archived`. |

There is no upper limit on optional project blocks; they are scored and
selected per task like other non-constraint sources.

---

## Field conventions

- `Name:` — a short human-readable label, not a path or URL.
- `Status:` — one of `active`, `exploratory`, `paused`, `archived`. Unknown
  values are allowed but discouraged; `active` and `archived` carry the clearest
  selection meaning.
- Field lines appear before the prose body and each on their own line.

---

## Constraints

Inherits the global ontology constraints:

- **No credentials or sensitive data.** Do not store access values for a
  project; describe handling rules, not the values. (See `constraints.md`.)
- **Portable.** Avoid tool-specific assumptions unless explicitly scoped.

---

## Compiler treatment

- `projects.md` is a **scored** source, not always-included.
- Field lines (`Name:`, `Status:`) are part of the block body for scoring, so a
  task mentioning a project name can surface its block.
- Wired into `SOURCE_FILES` by P2-PR06; until then the schema defines the
  authoring contract only.

---

## Conformance

`tests/unit/agentctx-projects-schema.test.mjs` parses the shipped
`templates/mind-ontology/.agentctx/projects.md` and asserts the required active
block, its tags, the `Name` / `Status` field lines, and a non-empty body.

---

## Example (minimal conformant file)

```md
# Projects

## Active project #project #active

Name: Example Project
Status: active

What this project is, why it matters, and which repos, docs, or tools belong
to it.
```
