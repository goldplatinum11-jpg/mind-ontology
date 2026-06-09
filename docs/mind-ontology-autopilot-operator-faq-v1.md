# Mind Ontology — Autopilot Operator FAQ v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The questions an operator asks before wiring an autonomous line onto Mind
Ontology — each answered from a local artifact already in this pack. No answer
needs a hosted SIRT account.

---

## Do I need an account or a server?

No. The free layer is local and file-based. See the
[adoption walkthrough](mind-ontology-autopilot-adoption-v1.md): scaffold, paste
blocks, wire the local MCP server, done.

## What can the agent actually do?

It can call two read-only tools, `get_context` and `list_constraints`, and nothing
else. See the [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md).

## Will it write to my files or my database?

Not through this layer. There is no write path; writeback is a separate, optional,
fail-closed adapter. See the [trust tie-in](mind-ontology-autopilot-trust-tie-in-v1.md).

## When does the line stop on its own?

Only on a valid terminal boundary — time budget, operator STOP, a
deploy/secrets/irreversible boundary, and a few others. Green tests or a finished
task are not stops. See the [stop policy](mind-ontology-autopilot-stop-policy-v1.md).

## How do I review what it did?

Each checkpoint produces a Result Pack you read as plain JSON, and every claimed
step names a guard test you can re-run. See the
[controller checklist](mind-ontology-autopilot-controller-checklist-v1.md) and the
[Result Pack walkthrough](mind-ontology-autopilot-result-pack-walkthrough-v1.md).

## Can I use it with ChatGPT or Claude.ai too?

Yes, via a thin connector you self-host that mirrors the same two tools. See
[connector parity](mind-ontology-autopilot-connector-parity-v1.md).

## What if my ontology is tiny?

A `constraints.md`-only line still works — the safety floor is always included.
Grow from there. See [minimal vs full](mind-ontology-autopilot-minimal-vs-full-v1.md).

## What stops the line from going off the rails?

The reading protocol binds the two tools to the right moments, risk forcing
surfaces safety on destructive tasks, and scope discipline keeps edits in bounds.
See [failure modes](mind-ontology-autopilot-failure-modes-v1.md) for each guard.

---

Every answer above resolves to a file in this repo — the FAQ is a map into the
pack, not new policy.
