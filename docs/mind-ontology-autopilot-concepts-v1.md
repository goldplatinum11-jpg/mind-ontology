# Mind Ontology — Autopilot Concepts v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The [product concepts](concepts.md) define Mind Ontology's own vocabulary —
source files, blocks, tags, context packs, the two MCP tools, the hosted boundary.
This doc adds the **autopilot line's** vocabulary and maps each term back onto
those product concepts, so an autonomous line and the compiler share one language.

These are line/runway terms. They add no new tool, no network call, and no hosted
dependency; they describe *how* a line uses the existing two-tool surface.

---

## Line & runway terms

- **Runway** — a long-running autonomous work session in which a worker executes
  many lane steps, optimizing for safe continuation. A runway reads many
  **context packs** (one per step), never one giant dump.
- **Lane** — one bounded, reviewable unit of work with an explicit write scope and
  a stop policy. The lane's write scope is exactly what `constraints.md` and
  `direction.md` encode as **always-included** and scored **blocks**.
- **ADL (atomic development loop)** — the smallest work cycle inside a lane:
  inspect → add a product artifact → add a guard test → run focused tests →
  continue. Each ADL is one `get_context(task)` read on the right axis.
- **Result Pack** — the JSON a worker returns to the controller at each checkpoint.
  It is plain, locally-checkable data — the handoff analog of a **context pack**.
  See [result-pack shape](mind-ontology-autopilot-result-pack-v1.md).

## Role terms

- **Worker** — the agent that edits inside the lane scope; reads a **context pack**
  at every step and calls `list_constraints()` before risky writes.
- **Controller** — the agent that plans lanes and reviews results against the
  **constraint / always-included** blocks before approving continuation.

## Axis & policy terms

- **Right-axis read** — reading the constitution as a *task-scoped policy*: a
  `get_context(task)` call parameterized by the current task. This is the normal
  **compilation** path.
- **Wrong-axis read** — mistaking the constitution for a lookup store ("what did we
  say before?"). The compiler resists it: an off-axis task earns only the
  always-included floor, never a dump. That history axis is the optional hosted
  **memory adapter**, not the local layer.
- **Stop policy** — the rule set deciding when a line may terminate. It gates
  *continuation*; it never relaxes **risk forcing** or the fail-closed hosted
  boundary. See [stop policy](mind-ontology-autopilot-stop-policy-v1.md).

---

## Concept map

| Autopilot term | Maps onto product concept |
|---|---|
| ADL read | `get_context(task)` → context pack |
| Lane write scope | `constraints.md` always-included + scored blocks |
| Safety re-read | `list_constraints()` |
| Risky lane step | risk forcing of safety-tagged blocks |
| History/recall need | hosted memory adapter (optional, fail-closed) |
| Result Pack | local JSON handoff (no hosted ingest required) |

See the [product concepts](concepts.md) for the base vocabulary and the
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) for the
trigger points.
