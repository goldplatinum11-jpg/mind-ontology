# Constraints

## Never touch production data without a reviewed migration #safety #destructive

No agent may run a migration, drop a table, or mutate production records directly.
Schema and data changes go through a reviewed migration and a staging run first.

## No secrets in code or context #security #secrets

API keys, tokens, and customer data never live in the repo or in `.agentctx/`.
Use the secret manager; reference secrets by name only.

## Ship behind a flag #safety #rollout

User-facing changes ship behind a feature flag, defaulted off, and are ramped
deliberately. A change with no rollback path is not ready.

## Keep the public API backward compatible #api #compat

Do not remove or retype a public API field without a deprecation window and a
major version. Additive changes are fine.
