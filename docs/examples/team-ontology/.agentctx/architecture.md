# Architecture

## Service map #architecture #layers

Three services: `booking/` (the booking path), `scheduling-api/` (the public
API), and `calendar-sync/` (provider integrations). A shared Redis cache fronts
availability reads.

## Data stores #architecture #data

Postgres is the source of truth; Redis is a cache only and never the source of
truth. Any write goes to Postgres first, then invalidates the cache.
