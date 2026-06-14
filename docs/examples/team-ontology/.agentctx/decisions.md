# Decisions

## Cache booking availability in Redis #performance #cache

Status: accepted
Date: 2026-02-10
Aliases: redis caching, availability cache, cache strategy, booking cache

Availability lookups dominate booking latency. We cache per-resource availability
in Redis with a short TTL and invalidate on write. Reason: read-heavy, tolerant
of brief staleness.

## Version the public API in the path #api #compat

Status: accepted
Date: 2026-03-01
Aliases: API versioning, path versioning, v1 v2, backward compatibility, breaking change

The public API is versioned as `/v1/…`. A breaking change ships as `/v2/…` with
`/v1` deprecated for two quarters. Reason: partners need a stable contract.

## Feature-flag every user-facing change #rollout #safety

Status: accepted
Date: 2026-01-15
Aliases: feature flags, flags, feature toggle, rollout strategy, flagged release

All user-facing changes ship behind a flag defaulted off. Reason: safe ramps and
instant rollback without a deploy.
