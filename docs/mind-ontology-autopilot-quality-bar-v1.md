# Mind Ontology — Autopilot Pack Quality Bar v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

What "good enough to land" means for a pack artifact. The bar is concrete and
mostly machine-checked, so a contributor knows when a doc, fixture, or template is
done — and a reviewer knows what to insist on.

Local-only: every check below runs locally, no hosted SIRT.

---

## The bar

An artifact is ready to land when it:

1. **Honors the six [principles](mind-ontology-autopilot-principles-v1.md).**
   Local-first, two read-only tools, right-axis read, safe continuation, mechanical
   enforcement, opt-in hosted. If it violates one, it does not belong in v1.
2. **Passes the ten structural guards.** Indexed, frame-linked, manifested,
   version-named, guarded, discoverable, glossary-clean, kit-documented,
   floor-safe, in reading order. See
   [cross-pack consistency](mind-ontology-autopilot-consistency-v1.md).
3. **Has a guard that asserts its real claims.** Not "the file exists" alone — the
   guard checks the load-bearing statements, so the doc cannot drift from them.
4. **Resolves all its links.** Every `(*.md)` it cites exists on disk; no dangling
   reference.
5. **Leaks nothing.** No hosted host, token, or private clone path; secrets checks
   run on config/data, not prose.
6. **Reads cleanly.** Plain, scannable, no filler — a reviewer can verify it in a
   PR. See [the principles applied](mind-ontology-autopilot-principles-applied-v1.md).

## What is NOT the bar

- **Length.** A short, precise doc beats a long one. The pitch is one paragraph.
- **Novelty for its own sake.** A new artifact must earn its place against the
  [non-goals](mind-ontology-autopilot-non-goals-v1.md) and the principles, not just
  add surface.
- **Green-by-vacuity.** A guard that asserts nothing real does not count as a
  guard; pack-acceptance counts tests, but the bar is that they *mean* something.

## How to check the bar

Run `npm test` and `npm run agentctx:validate`. Green means the structural bar is
met; the human bar (principles honored, reads cleanly) is the reviewer's call,
guided by the [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md).

---

Good enough to land = honors the principles, passes the guards, links resolve,
leaks nothing, reads cleanly. Most of that is machine-checked; the rest is a quick
human read. See [extending the pack](mind-ontology-autopilot-extending-v1.md).
