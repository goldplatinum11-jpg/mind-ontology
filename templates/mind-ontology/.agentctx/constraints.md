# Constraints

## Keep the ontology portable #portable #cross-agent #mcp

Mind Ontology source files should be readable by any AI agent or MCP client.
Avoid tool-specific assumptions unless the block is explicitly scoped to that
tool.

## No secrets in ontology files #security #secrets

Never store API keys, passwords, tokens, private keys, customer secrets, or
other credential material in `.agentctx/`. Use the ontology to describe safe
handling rules, not to store secret values.

## Confirm before destructive work #safety #destructive

Before deleting data, rewriting history, changing production configuration, or
making irreversible changes, the agent must call `list_constraints()` and
follow the project-specific stop policy.

## Prefer small scoped context packs #context #selection

Agents should receive the smallest context pack that can safely guide the task.
Do not dump the whole ontology into every session when `get_context(task)` can
select the relevant blocks.
