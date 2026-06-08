# Mind Ontology — `cq.md` Schema v0

**Status:** Phase 2 / P2-PR05 (competency questions)
**Source file:** `.agentctx/cq.md`
**Compiler status:** Scored source. Wired into the compiler source list by
P2-PR06 (compiler source-list expansion); this document defines the authoring
contract ahead of that wiring.

`cq.md` holds the ontology's **competency questions** — the questions the rest of
the ontology must be able to answer. In ontology engineering, competency
questions are the acceptance criteria for the model: if the sources cannot
answer a listed CQ, the ontology is incomplete. `cq.md` is therefore the
self-test layer that keeps the other source files honest.

---

## Block model

Shared `.agentctx/` Markdown convention:

- One `# Competency Questions` H1 title line (ignored by the compiler).
- Each `##` heading is a **competency question**; inline `#tag` tokens are
  extracted as tags and stripped from the rendered title.
- The block body states which source(s) should answer the question.

```md
# Competency Questions

## What should the agent know before starting? #cq #context

The ontology should answer which direction, decisions, constraints, and terms
matter for the current task.
```

---

## CQ block rules

A conformant competency-question block:

- has a heading phrased as a **question** (the rendered title ends with `?`);
- carries the `#cq` namespace tag;
- carries at least one **topic tag** mapping the CQ to the source area it tests
  (e.g. `#context`, `#safety`, `#decision`, `#boundary`);
- has a non-empty body describing what the ontology should answer.

---

## Required competency questions

A conformant `cq.md` MUST cover at least these two topics, because they are the
baseline an agent needs before acting:

| Topic tag | Question it tests |
|---|---|
| `#context` | What should the agent know before starting? |
| `#safety` | What must the agent avoid? |

---

## Recommended competency questions

| Topic tag | Question it tests |
|---|---|
| `#decision` | Which prior decision applies? |
| `#boundary` | Is this capability local or hosted? |

Authors SHOULD add CQs as the ontology grows; each new CQ is a promise that some
source file answers it.

---

## Constraints

Inherits the global ontology constraints:

- **No credentials or sensitive data** in questions or answers. (See
  `constraints.md`.)
- **Portable.** Phrase CQs so any MCP client benefits from them.

---

## Compiler treatment

- `cq.md` is a **scored** source, not always-included.
- Topic tags let a task or `--scope` surface the CQs relevant to the work.
- Wired into `SOURCE_FILES` by P2-PR06; until then the schema defines the
  authoring contract only.

---

## Conformance

`tests/unit/agentctx-cq-schema.test.mjs` parses the shipped
`templates/mind-ontology/.agentctx/cq.md` and asserts every block is a `#cq`
question with a topic tag and non-empty body, headings end with `?`, and the
required `#context` and `#safety` CQs are present.

---

## Example (minimal conformant file)

```md
# Competency Questions

## What should the agent know before starting? #cq #context

The ontology should answer which direction, decisions, constraints, and terms
matter for the current task.

## What must the agent avoid? #cq #safety

The ontology should answer which actions are forbidden, risky, destructive, or
outside the current scope.
```
