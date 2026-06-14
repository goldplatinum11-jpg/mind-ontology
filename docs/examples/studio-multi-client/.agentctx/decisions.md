# Decisions

## Give each client its own workspace #isolation #client

Status: accepted
Date: YYYY-MM-DD

Each engagement lives under `clients/<name>/` with its own ontology and data.

Reason:

One shared workspace would make cross-client leakage easy and reviews ambiguous.
Per-client workspaces make the boundary explicit and auditable.

## Reuse the studio platform across clients #studio-platform #reuse

Status: accepted
Date: YYYY-MM-DD

Shared concerns live once in `platform/` and are consumed by each client, rather
than copied per engagement.

Reason:

Copy-paste foundations drift and rot. One platform keeps every client on the
same proven base and makes upgrades land everywhere at once.

## Gate every client-facing change behind review #rollout #safety

Status: accepted
Date: YYYY-MM-DD

No change reaches a client deliverable without a second set of eyes.

Reason:

Client trust is the studio's product. A reviewed change is reversible and
explainable; an unreviewed one risks the engagement.
