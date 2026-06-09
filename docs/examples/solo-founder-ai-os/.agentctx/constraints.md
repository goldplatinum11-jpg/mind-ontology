# Constraints

## Never deploy, publish, or release without explicit approval #safety #destructive

No agent deploys Lumen Cloud, publishes the docs/marketing site, or cuts a
release on its own. These are public, hard-to-reverse actions: prepare the
change, show exactly what will go out, and wait for an explicit human go.

## Keep secrets out of the repos and the ontology #security #secrets

Cloud credentials, signing keys, and customer data never live in any repo or in
`.agentctx/`. Reference secrets by name from the secret manager only; never paste
a value into context.

## Do not move paid features into the open-source Core #safety #boundary

Hosted-only capabilities — billing, multi-tenant admin, team management — stay in
the private cloud line. Never copy or re-implement them in the Apache-2.0 Core
repo. When unsure which side a feature belongs to, stop and ask.

## Protect customer data and production #safety #destructive

No direct writes to production data, no destructive migration, and no bulk
customer email without a reviewed plan and a rollback path. If a step has no way
back, it is not ready.
