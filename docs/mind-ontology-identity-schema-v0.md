# Mind Ontology — `identity.md` Schema v0

**Status:** Phase 2 / P2-PR01 (schema definition)
**Source file:** `.agentctx/identity.md`
**Compiler status:** Scored source. Wired into the compiler source list by
P2-PR06 (compiler source-list expansion); this document defines the authoring
contract ahead of that wiring so files written now are forward-compatible.

`identity.md` answers a single competency question: **who is the agent helping,
and how should it relate to them?** It is the personal-relationship layer of the
ontology — distinct from `constraints.md` (hard rules), `direction.md` (where the
work is going), and `projects.md` (what is being worked on).

---

## Block model

`identity.md` follows the shared `.agentctx/` Markdown convention:

- One `# Identity` H1 title line. The compiler ignores `# ` lines; the title is
  for humans.
- Each `##` heading starts a **block**. Inline `#tag` tokens in the heading are
  extracted as tags and stripped from the rendered title.
- Block body is the prose beneath the heading, up to the next `##`.

```md
# Identity

## Operator profile #identity #operator

<prose describing who the agent helps>
```

---

## Required blocks

A conformant `identity.md` MUST contain these blocks. Block matching is by the
**required tag**, not the exact title text, so authors may rename titles while
staying conformant.

| Block | Required tag | Recommended tags | Body |
|---|---|---|---|
| Operator profile | `#identity` | `#operator` | Who the agent is helping and how to relate to them. Non-empty. |
| Working style | `#style` | `#collaboration` | The working rhythm that helps the operator. Non-empty. |

"Non-empty" means at least one non-whitespace line of body after the heading.

---

## Optional blocks

Authors MAY add further blocks for richer identity context. Recommended tags:

| Purpose | Recommended tags |
|---|---|
| Communication preferences (tone, length, language) | `#identity #communication` |
| Decision authority (what the agent may decide alone) | `#identity #authority` |
| Time zone / availability context | `#identity #context` |

Optional blocks are scored against the task like any other non-constraint
source; they surface only when relevant.

---

## Tag conventions

- Every block SHOULD carry at least one tag.
- Prefer the `#identity` namespace tag on identity blocks so scope queries
  (`--scope identity`) select them reliably.
- Tags are lower-cased and matched case-insensitively by the compiler.

---

## Constraints

`identity.md` inherits the global ontology constraints:

- **No secrets.** Never store credentials, tokens, private contact details, or
  other sensitive personal data. Describe *how* to relate to the operator, not
  private identifiers. (See `constraints.md` → "No secrets in ontology files".)
- **Portable.** Avoid tool-specific assumptions unless a block is explicitly
  scoped to that tool, so any MCP client can read the file.

---

## Compiler treatment

- `identity.md` is a **scored** source, not an always-included one. Only
  `constraints.md` is always included.
- Until P2-PR06 wires it into `SOURCE_FILES`, the compiler does not yet read
  `identity.md`; this schema defines the authoring contract so the file is ready
  when the source list expands.
- Once wired, identity blocks are selected by task/scope relevance, capped by
  `--max-blocks-per-file`, the same as `direction.md` / `decisions.md`.

---

## Conformance

`tests/unit/agentctx-identity-schema.test.mjs` parses the shipped
`templates/mind-ontology/.agentctx/identity.md` with the compiler's
`parseMarkdownBlocks` and asserts the required blocks, required tags, and
non-empty bodies defined here. The template and this schema must not drift.

---

## Example (minimal conformant file)

```md
# Identity

## Operator profile #identity #operator

The operator is a builder who prefers autonomous execution, compact summaries,
and tools that turn repeated explanation into reusable context.

## Working style #style #collaboration

Prefer concrete progress over abstract discussion. Ask for clarification only
when a product, cost, legal, or safety decision cannot be inferred from context.
```
