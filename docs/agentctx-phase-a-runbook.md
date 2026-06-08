# agentctx Phase A Runbook

Phase A is the first real-operation pass after PR #4394 lands. The goal is to
prove that the SIRT dispatch queue can hand work to Claude Code with the same
scoped context contract that Codex sees.

Product framing: this is the first Mind Ontology execution proof. Mind Ontology
is the product surface, SIRT is the dispatch and memory substrate, and agentctx
is the compiler that injects the right task-scoped context into the worker AI.

## Stop Conditions

Stop only for these conditions:

- A task needs paid external capacity beyond the normal Claude/Codex plan.
- A task requires secrets, production config, deployment, migration, or forceful
  git history changes.
- The queue cannot authenticate to SIRT or the runner cannot authenticate as a
  staging runner.
- The requested work changes product direction rather than implementation path.

Routine implementation choices should stay inside the runner lane and produce a
draft PR, not a human checkpoint.

## Safety Profile

Every Phase A queue item must use:

- `executor_type: "claude_code"`
- `approval_policy: "staging_claude_code_v0"`
- `safety_profile: "restricted"`
- `target_branch: "codex/agentctx-sirt-autopilot-line-main"` until PR #4394 is
  merged, then `main`
- draft PR output only

Forbidden task text is rejected before enqueue. Keep payloads away from deploy,
secret, migration, destructive shell, or force-push wording so the dispatch API
auto-deny gate remains clean.

## Queue Packet

Generate the packet:

```sh
npm run agentctx:phase-a-packet
```

Validate only:

```sh
npm run agentctx:phase-a-packet -- --check
```

Write to staging queue, if `SIRT_BASE_URL` and `SIRT_OPERATOR_KEY` are present:

```sh
npm run agentctx:phase-a-packet -- --post
```

The post mode calls `POST {SIRT_BASE_URL}/v2/agent_tasks` once per payload with
the operator key. It prints task ids and never prints the key.

## Phase A Tasks

1. Add agentctx context injection to the Claude Code runner prompt.
2. Add MCP setup templates for Codex and Claude Code so both agents can call the
   same repo-local context source.
3. Add an acceptance smoke proving the queued Claude Code path receives an
   agentctx context pack before execution.

## Acceptance

Phase A is complete when a queued staging Claude Code task creates a draft PR
whose implementation used `agentctx` context from `.agentctx/`, with tests
passing and no live deployment or production mutation.
