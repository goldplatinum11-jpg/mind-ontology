# Competency Questions

## What should the agent know before starting? #cq #context

The current direction (booking latency, public API, reliability), the active
projects, and the team's vocabulary — from `direction.md`, `projects.md`, and
`glossary.md`.

## What must the agent avoid? #cq #safety

Touching production data directly, shipping without a flag, removing a public API
field without deprecation, or storing secrets — from `constraints.md`.

## Which writes are forbidden, and when must the agent fail closed? #cq #safety #boundary

Direct production data mutation and unreviewed migrations are forbidden; the agent
stops and asks before any destructive or irreversible change. See `constraints.md`.

## Which prior decision applies? #cq #decision

The relevant accepted decision from `decisions.md` (caching, API versioning, or
feature-flag rollout) for the task at hand.

## Which project does this task belong to? #cq #scope

Whether the work is part of `booking-fast-path`, `public-scheduling-api`, or
reliability — from `projects.md` and `direction.md`.
