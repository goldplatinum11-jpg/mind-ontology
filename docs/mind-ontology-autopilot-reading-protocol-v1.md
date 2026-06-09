# Mind Ontology — Autopilot Reading Protocol v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A portable semantic constitution only helps if agents read it **at the right
moment**. This protocol specifies *when* each agent in an autonomous line should
call `get_context(task)` and `list_constraints()` — so the trigger logic lives in
the product, not re-derived in every line.

The protocol is deliberately tool-minimal: the only surface is the two read-only
tools. It adds no new tool, no network call, and no hosted dependency.

---

## The two triggers

| Tool | When to call | Why |
|---|---|---|
| `get_context(task)` | at the **start of every task or lane step**, before planning or editing | load the task-scoped slice of direction, decisions, projects, and roles |
| `list_constraints()` | before any **destructive, structural, or irreversible** action, and before approving continuation | re-read the full non-negotiable floor; `constraints.md` is always present |

The one-line instruction every agent gets:

```text
At task start, call get_context(task). Before destructive or structural
changes, call list_constraints().
```

This protocol expands that line into explicit trigger points per role so an
autopilot line never has to guess.

---

## Trigger points by role

### Worker (e.g. Claude Code)

1. **Lane / task start** → `get_context(task)` with the task phrased in natural
   language. Reason on the returned axis, not on the whole ontology.
2. **Before a write that is destructive or structural** (deletes, schema/contract
   changes, migrations, anything hard to reverse) → `list_constraints()`. If a
   constraint forbids the write, stop and report; do not "work around" it.
3. **On a risk signal in the task text** (drop, delete, deploy, secret, migrate,
   production, live data) → treat as a risky task; the compiler forces safety
   blocks, and the agent must honor the stop policy.
4. **Before reporting completion** → confirm the action stayed inside the
   constraints surfaced in steps 1–2. Faithful reporting over optimistic closure.

### Controller / Planner / Reviewer (e.g. Codex)

1. **Before planning a lane** → `get_context("plan <lane>")` to anchor direction
   and `list_constraints()` to load the write-scope and stop policy.
2. **When reviewing a worker result** → `list_constraints()` to check the result
   did not cross a forbidden boundary, regardless of what the worker reported.
3. **Before approving continuation** → re-check the stop policy: continue only if
   no *valid* terminal stop condition is met (see the stop-policy doc).

### Any MCP client

The same two triggers apply. No client gets a richer or narrower surface; the
protocol is identical so behavior is portable across the line.

---

## Read-on-the-right-axis rule

The most common failure is **wrong-axis reasoning**: an agent treats the
constitution as a memory store ("what did we say last week?") instead of a
task-scoped policy ("what does *this task* require and forbid?"). The protocol
prevents it by binding the read to the task:

- `get_context(task)` is always parameterized by the **current task**, never a
  bare dump. A pack returned for "fix the OAuth flow" is not the pack for "drop
  the orders table".
- `list_constraints()` is the safety axis, not the history axis. It answers *what
  must I never do*, not *what happened before*.

If an agent needs durable memory or cross-session history, that is the hosted
SIRT Brain axis and is out of scope for this local protocol.

---

## What the protocol does not do

- It does not add a memory tool, a search tool, or a writeback tool.
- It does not call any network endpoint or require an account.
- It does not make the local layer depend on hosted SIRT — hosted reads, if a
  line enables them, are opt-in, fail-closed, and off by default.

See the [autopilot pack frame](mind-ontology-autopilot-pack-v1.md), the
[stop-policy context](mind-ontology-autopilot-stop-policy-v1.md), and the
[MCP server reference](agentctx-mcp.md) for the tool contract.
