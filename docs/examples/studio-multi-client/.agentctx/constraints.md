# Constraints

## Never mix data across client engagements #safety #destructive

Data, code, and context from one client must never enter another client's
workspace or deliverable. Cross-client leakage is the most serious failure in
this studio; when unsure whether something is shared, treat it as client-private.

## No secrets in code or context #security #secrets

Never store API keys, passwords, tokens, or client credentials in `.agentctx/`
or in committed code. Describe safe handling instead of embedding secret values.

## Ship client-facing changes behind review #safety #rollout

Every change that reaches a client deliverable goes through review first. An
unreviewed client change is forbidden, however small.

## Keep the studio platform backward compatible #api #compat

Platform changes are consumed by every engagement, so they must stay backward
compatible. A breaking platform change without a migration path is not allowed.
