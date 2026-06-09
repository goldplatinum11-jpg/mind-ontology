# Mind Ontology — State of the Pack v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A point-in-time overview of what the Autopilot Integration Pack ships in v1, so a
reader can size the whole thing before diving in. For the linkable list see the
[pack at a glance](mind-ontology-autopilot-manifest-v1.md) manifest; this doc is
the narrative shape.

Local-only: everything below is docs, tests, fixtures, and templates — no hosted
SIRT in the load-bearing path.

---

## What v1 ships

- **Docs.** A frame plus behavior, adoption, contracts, discipline, reference,
  rationale, and meta docs — the full conceptual surface of an autonomous line on
  Mind Ontology, every file named `-v1.md` and indexed in reading order.
- **Fixtures.** Five worked `.agentctx/` ontologies — a full nine-file line, a
  multi-role line, a constraints-only minimal line, a multi-project team, and a
  solo founder — several with competency-question regressions.
- **Kit.** A drop-in `templates/mind-ontology/autopilot/` bundle: tagged blocks,
  MCP configs for Claude Code / Cursor / Codex, a pasteable agent prompt, and a
  one-screen cheat sheet.
- **Guards.** A guard test per artifact plus cross-cutting structural guards, so
  the pack mechanically enforces its own consistency.

## The boundary v1 holds

- **Two read-only tools.** `get_context` and `list_constraints`; nothing mutates.
- **Local-first.** No account, no network, no hosted SIRT required.
- **Opt-in hosted.** Durable memory, retrieval, and writeback stay the optional,
  fail-closed paid layer. See [non-goals](mind-ontology-autopilot-non-goals-v1.md).

## How to verify the state

Run `npm test` and `npm run agentctx:validate`. A green suite means every doc is
indexed, manifested, frame-linked, version-named, guarded, and discoverable; every
fixture keeps the safety floor; and the kit and glossary resolve. The state of the
pack is, by design, readable from one green command. See
[cross-pack consistency](mind-ontology-autopilot-consistency-v1.md).

## Status

v1 is a complete, self-consistent, local-first product surface for putting Mind
Ontology under an autonomous AI development line. It is built docs/tests-first and
left uncommitted for controller review; the contract (two read-only tools,
local-first, the stop policy) is frozen for v1. See
[pack versioning](mind-ontology-autopilot-versioning-v1.md) for what a v2 would
change and [the pack frame](mind-ontology-autopilot-pack-v1.md) to start reading.

---

One green suite describes the whole state: a self-enforcing, local-first pack that
makes Mind Ontology consumable by an autonomous line. See the
[reading paths](mind-ontology-autopilot-reading-paths-v1.md) for where to go next.
