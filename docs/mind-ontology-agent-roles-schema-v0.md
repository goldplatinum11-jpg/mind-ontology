# Mind Ontology — `agent-roles.md` Schema v0

**Status:** Phase 2 / P2-PR04 (schema definition)
**Source file:** `.agentctx/agent-roles.md`
**Compiler status:** Scored source. Wired into the compiler source list by
P2-PR06 (compiler source-list expansion); this document defines the authoring
contract ahead of that wiring.

`agent-roles.md` answers: **which role should the agent adopt for this task?** It
is the role-routing layer — it tells a multi-agent or single-agent system which
hat to wear (plan, implement, review, remember) so behavior matches the work.

---

## Block model

Shared `.agentctx/` Markdown convention:

- One `# Agent Roles` H1 title line (ignored by the compiler).
- Each `##` heading is a **role block**; inline `#tag` tokens are extracted as
  tags and stripped from the rendered title.
- The block body describes when to use the role.

```md
# Agent Roles

## Coding agent #agent #coding

Use this role for implementation, tests, commits, and PR creation inside the
current task scope.
```

---

## Role block rules

A conformant role block:

- carries the `#agent` namespace tag (marks the block as a role);
- carries exactly one **role tag** identifying the role (e.g. `#coding`,
  `#review`, `#strategy`, `#memory`);
- has a non-empty body describing **when to use** the role.

---

## Required roles

A conformant `agent-roles.md` MUST define at least these two roles, because they
are the minimum for a safe build-and-check loop:

| Role | Required tag | Purpose |
|---|---|---|
| Coding agent | `#coding` | Implementation, tests, commits, PRs within scope. |
| Review agent | `#review` | Code review, risk classification, merge-readiness. |

---

## Recommended roles

| Role | Recommended tag | Purpose |
|---|---|---|
| Strategy agent | `#strategy` | Direction, tradeoffs, phase planning, what to build next. |
| Memory agent | `#memory` | Turning durable decisions into ontology updates / writeback. |

Authors MAY add further roles; each follows the same role-block rules.

---

## Constraints

Inherits the global ontology constraints:

- **No credentials or sensitive data** in role descriptions. (See
  `constraints.md`.)
- **Portable.** Describe roles in tool-agnostic terms so any client can route by
  them.

---

## Compiler treatment

- `agent-roles.md` is a **scored** source, not always-included.
- Role tags let a task or `--scope` (e.g. `--scope review`) surface the relevant
  role guidance and omit the rest.
- Wired into `SOURCE_FILES` by P2-PR06; until then the schema defines the
  authoring contract only.

---

## Validator enforcement

`npm run agentctx:validate` applies the `agent-roles.md` entry of
`ONTOLOGY_SCHEMA` (`scripts/agentctx/schema.mjs`). Rules apply only when the
file is present; a project without `agent-roles.md` still validates.

| Rule | Level | What it checks |
|---|---|---|
| `namespace-required` | error | At least one block tagged `#agent` exists. |
| `one-role-tag` | error | Every `#agent` block carries exactly one tag besides `#agent`. |
| `non-empty-body` | error | Every `#agent` block has a non-empty body. |
| `required-tag` | error | Blocks tagged `#coding` and `#review` exist. |
| `no-credentials` | error | No credential-shaped `key: value` line anywhere in the file. |

---

## Conformance

`tests/unit/agentctx-agent-roles-schema.test.mjs` parses the shipped
`templates/mind-ontology/.agentctx/agent-roles.md` and asserts the `#agent`
namespace on every role block, non-empty bodies, and the presence of the
required coding and review roles.

---

## Example (minimal conformant file)

```md
# Agent Roles

## Coding agent #agent #coding

Use this role for implementation, tests, commits, and PR creation inside the
current task scope.

## Review agent #agent #review

Use this role for code review, risk classification, missing-test detection, and
merge-readiness assessment.
```
