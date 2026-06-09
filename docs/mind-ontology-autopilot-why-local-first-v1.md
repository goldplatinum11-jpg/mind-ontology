# Mind Ontology — Why Local-First for Autopilot v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

Why an autopilot line should run on a **local-first** constitution rather than a
hosted memory service from day one. Local-first is not a limitation here; it is
what makes the line trustable, portable, and cheap to run.

No part of this argument depends on a hosted SIRT service.

---

## What local-first means here

The constitution lives in `.agentctx/` Markdown files in the repo. The compiler
and the two tools run on the operator's machine. There is no account, no database,
and no network call in the free path.

## Why a line benefits from it

- **Trustable.** The operator can read the whole layer in a PR. A hosted service
  cannot offer that — you trust its behavior, not its files.
- **Portable.** The same files feed every client identically; nothing is pinned to
  one vendor or one machine's cloud state. See
  [portability](mind-ontology-autopilot-portability-v1.md).
- **Versioned with the work.** The constitution is git-native, so it moves with the
  branch and reviews like code — no out-of-band state to reconcile.
- **Cheap and offline.** No per-call cost, no rate limit, no outage in the free
  path. A long runway is not throttled by someone else's service.
- **Fail-safe by default.** With nothing hosted in the load-bearing path, the line
  cannot be broken by a hosted dependency going down.

## When hosted is the right add-on

Local-first is the *default*, not a ceiling. Durable cross-machine memory,
retrieval, and writeback execution are real needs — and they are the optional,
fail-closed hosted layer, added when a team wants them, never required for the
line to function. See [minimal vs full](mind-ontology-autopilot-minimal-vs-full-v1.md)
for the spectrum and [two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md)
for where those capabilities live.

---

The default is the smallest thing that works and that you can fully audit: local
files plus two read-only tools. Hosting is an upgrade you opt into, not a
prerequisite you inherit.
