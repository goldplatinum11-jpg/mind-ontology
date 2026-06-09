# Constraints

## Re-read constraints before irreversible work #autopilot #safety #destructive

Before any destructive, structural, or irreversible action — deletes, schema or
contract changes, migrations, deploys, anything hard to undo — call
`list_constraints()`. If a constraint forbids the action, stop and report.

## No secrets in ontology files #security #secrets

Never store API keys, tokens, or private credentials in `.agentctx/`. Describe
safe handling rules, not secret values.

## Stop only on a real boundary #autopilot #stop-policy

Stop the line only on a valid terminal condition. A completed task, green tests,
a denied commit, or "no remote" are not stop conditions — continue to the next
action.
