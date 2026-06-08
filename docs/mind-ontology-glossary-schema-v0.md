# Mind Ontology — `glossary.md` Schema v0

**Status:** Phase 2 / P2-PR03 (source support + schema definition)
**Source file:** `.agentctx/glossary.md`
**Compiler status:** Scored source. Wired into the compiler source list by
P2-PR06 (compiler source-list expansion); this document defines the authoring
contract ahead of that wiring.

`glossary.md` answers: **what do the project's words mean?** It is the shared
vocabulary layer so every agent resolves a term the same way instead of guessing
from its own training. Terms surfaced here keep `direction.md` / `decisions.md`
prose terse — the meaning lives once in the glossary.

---

## Block model

Shared `.agentctx/` Markdown convention:

- One `# Glossary` H1 title line (ignored by the compiler).
- Each `##` heading is a **term block**. The rendered title (with `#tag` tokens
  stripped) is the term being defined.
- The block body is the definition.

```md
# Glossary

## Context pack #context #term

A task-scoped bundle of direction, decisions, constraints, and vocabulary that
an AI agent receives before acting.
```

---

## Term block rules

A conformant glossary term block:

- carries the `#term` tag (the namespace tag that marks a glossary entry);
- SHOULD carry at least one topic tag in addition to `#term` (e.g. `#context`,
  `#constraint`) so scope queries can select related terms;
- has a non-empty definition body;
- defines exactly one term per block (the heading is the term).

A conformant `glossary.md` MUST contain **at least one** `#term` block.

---

## Definition style

- Define the term in prose; a single short paragraph is preferred.
- Avoid circular definitions that only reference other undefined terms.
- Keep definitions portable and tool-agnostic unless the term is inherently
  tool-specific.

---

## Constraints

Inherits the global ontology constraints:

- **No credentials or sensitive data** in definitions. (See `constraints.md`.)
- **Portable.** A glossary entry should be readable by any MCP client.

---

## Compiler treatment

- `glossary.md` is a **scored** source, not always-included.
- Because each term block is tagged `#term`, a task or `--scope` referencing a
  term surfaces its definition; unrelated terms are omitted, keeping the context
  pack small.
- Wired into `SOURCE_FILES` by P2-PR06; until then the schema defines the
  authoring contract only.

---

## Conformance

`tests/unit/agentctx-glossary-schema.test.mjs` parses the shipped
`templates/mind-ontology/.agentctx/glossary.md` and asserts at least one
`#term` block, that every term block has a non-empty definition body, and that
term titles are unique.

---

## Example (minimal conformant file)

```md
# Glossary

## Constraint #constraint #term

A non-negotiable rule the agent must respect. Constraints are included even
when the task does not appear to match them.
```
