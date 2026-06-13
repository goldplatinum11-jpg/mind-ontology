# Glossary

## Client workspace #term #isolation

The self-contained directory for one engagement (`clients/<name>/`) holding that
client's ontology, data, and deliverables. The unit of isolation.

## Studio platform #term #platform

The shared foundation (`platform/`) every engagement imports — auth, logging,
and context-compiler wiring. Has no client-specific logic.

## Engagement #term #client

A single client relationship and its scope of work. One engagement maps to one
client workspace and one active project.
