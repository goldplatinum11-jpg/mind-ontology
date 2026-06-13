# Mind Ontology — Autopilot Result Pack Shape v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

When a worker agent finishes (or checkpoints) a lane, it returns a **Result Pack**:
a small JSON document the controller can review and act on. This doc defines the
shape so the handoff stays **machine-checkable with local tools alone** — copy-paste
is the transport, and no hosted SIRT ingest is required to read or validate it.

The Result Pack is plain JSON written to a file path the controller watches. It is
not a network call, not a hosted write, and not a SIRT control-plane object.

---

## Required top-level keys

| Key | Type | Meaning |
|---|---|---|
| `schema` | string | shape identifier, e.g. `sirt.result-pack/v1` |
| `lane` | string | the lane id the worker ran |
| `branch` | string | the git branch the work landed on (uncommitted) |
| `status` | string | `in-progress` or a terminal status |
| `runway` | object | self-pacing state — see below |
| `write_scope_respected` | boolean | the worker stayed inside its allowed write scope |
| `forbidden_scope_touched` | boolean | must be `false` for a clean handoff |
| `adls_completed` | array | one entry per ADL: `id`, `title`, `artifact`, `guard_test` |
| `validation` | object | one entry per gate: `command`, `result`, `passed` — the gates the worker ran and whether they passed |
| `uncommitted_changes` | object | `added` / `modified` file lists for controller review |
| `handoff` | string | one-line summary of what the controller should do next |

### `runway` object

| Key | Type | Meaning |
|---|---|---|
| `checkpoint` | number | monotonically increasing checkpoint counter |
| `valid_terminal_stop_reached` | boolean | `true` only when a *valid* stop condition fired |
| `reason_for_continuation` | string | why the runway continues, when it does |

---

## Invariants the guard enforces

1. **All required keys present**, with the right primitive types.
2. **`forbidden_scope_touched` is `false`** — a Result Pack that admits a forbidden
   write is a failed handoff, not a clean one.
3. **No hosted leakage** — the pack embeds no endpoint host, bearer token, or
   private clone path. It is reviewable as plain text.
4. **`adls_completed` is non-empty and each entry names a guard test**, so the
   controller can re-run the proof rather than trust prose.
5. **Self-consistent stop state** — if `valid_terminal_stop_reached` is `false`,
   `status` stays `in-progress` and a `reason_for_continuation` is given.

---

## Why local-checkable matters

The whole pack philosophy is that the *meaning* lives in files the controller can
read in a PR. The Result Pack is the same idea applied to the handoff: a controller
(or a CI step) validates it with a local schema check, no account and no hosted
ingest. Hosted SIRT *may* later ingest the same JSON for durable history, but that
is an optional, fail-closed step — never a prerequisite for the handoff to work.

An example pack lives at `tests/fixtures/autopilot-result-pack.example.json` and is
held to this shape by `tests/unit/autopilot-result-pack-shape.test.mjs`.
