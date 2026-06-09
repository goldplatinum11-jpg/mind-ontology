# Glossary

## Booking fast-path #term #performance

The optimized booking-confirmation code path that serves availability from cache
and confirms a booking with a single write.

## Availability TTL #term #cache

The short time-to-live on cached availability in Redis. Bounds how stale a
read can be before it is recomputed from Postgres.

## Ramp #term #rollout

The deliberate, staged increase of a feature flag's exposure from 0% toward 100%,
with a pause-and-rollback option at each step.
