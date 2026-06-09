# Constraints

## Re-read constraints before irreversible work #safety #destructive

Before any destructive, structural, or irreversible action, call
`list_constraints()` and stop-and-report if a constraint forbids it.

## No secrets in ontology files #security #secrets

Never store API keys, tokens, or credentials in `.agentctx/`.
