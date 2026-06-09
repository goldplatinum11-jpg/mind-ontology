# Mind Ontology — Autopilot Canonical One-Line Instruction v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The single instruction every agent in an autopilot line is given. It is two
sentences, and it is enough — everything else in the pack expands *when* to follow
it, not *what* to add. This doc fixes the canonical string so adopters copy it
verbatim.

---

## The canonical instruction

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

That is the whole instruction. Paste it into each agent's system/role prompt,
unchanged. It uses only the two read-only tools and makes no network call.

## Why two sentences are enough

- **Sentence one** binds context to the start of every task — the right-axis read
  that keeps the agent current. See the
  [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md).
- **Sentence two** binds the safety re-read to the moment before a risky write —
  the guard against crossing a boundary. See the
  [risk modes](mind-ontology-autopilot-risk-modes-v1.md).

There is nothing to add because the surface is exactly two tools: the instruction
names both and says when to call each. See the
[two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md).

## What the rest of the pack does

Every other doc expands a *condition* around this instruction — the stop policy
(when the line may end), scope discipline (where it may write), the lifecycle (how
a lane flows) — but none changes the instruction itself. The
[cheat sheet](../templates/mind-ontology/autopilot/cheat-sheet.md) and the
[example agent prompt](../templates/mind-ontology/autopilot/example-codex-agent.md)
both embed exactly this string.

---

One instruction, two sentences, two tools. If an adopter remembers nothing else,
this is the line that makes a constitution actually get read. See
[the pack frame](mind-ontology-autopilot-pack-v1.md).
