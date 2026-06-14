# Architecture

## Per-client workspaces #architecture #isolation

Each engagement is a self-contained workspace under `clients/<name>/`: its own
ontology, data, and deliverables. Nothing reads across client boundaries. An
agent working in `clients/acme/` cannot see `clients/northwind/`.

## Shared studio platform #architecture #platform

Cross-cutting concerns — auth, logging, and the context-compiler wiring — live
once under `platform/` and are imported by each client workspace. The platform
never embeds client-specific logic.
