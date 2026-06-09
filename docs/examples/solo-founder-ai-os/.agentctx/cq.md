# Competency Questions

## What should the agent know before starting work? #cq #context

The current direction (Cloud revenue, a healthy open Core, founder focus), the
active projects and which line each belongs to, and the shared vocabulary — from
`direction.md`, `projects.md`, and `glossary.md`.

## What must the agent never do on its own? #cq #safety

Deploy Cloud, publish the docs site, cut a release, store secrets, or move paid
features into the open Core — from `constraints.md`.

## When must the agent stop and fail closed? #cq #safety #boundary

Before any deploy, publish, release, production data change, or moving a feature
across the open-core line, it stops and asks for an explicit go. See
`constraints.md`.

## Which line does this feature belong to — open Core or paid Cloud? #cq #boundary

Whether the work is part of `lumen-core` (free, Apache-2.0) or `lumen-cloud`
(paid, hosted) — from `projects.md`, `decisions.md`, and `architecture.md`.

## Which agent role owns this step? #cq #roles

Whether planning, building, or review is in play, and what each role is allowed
to do — from `agent-roles.md`.

## What does a term mean in Lumen versus a competitor? #cq #vocabulary

The precise product meaning of Lumen, Workspace, and open-core, and that Luminary
is a competitor and not us — from `glossary.md`.
