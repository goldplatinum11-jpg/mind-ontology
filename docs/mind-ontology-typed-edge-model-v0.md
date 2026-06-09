# Mind Ontology — Typed Edge Model v0

**Status:** Phase 4 / P4-PR03 (hosted SIRT on-ramp) — **schema + validators only**
**Module:** `scripts/agentctx/adapters/edge-model.mjs`

Defines the typed-edge schema used by the `edge` writeback proposal (P4-PR02)
and any hosted-graph relationship the on-ramp carries. Pure schema, validators,
and a constructor — no I/O, no hosted call.

A typed edge keeps hosted graphs legible: every relationship is drawn from a
small controlled vocabulary instead of free-text.

---

## Schema

```ts
interface TypedEdge {
  from: string;        // source node id
  to: string;          // target node id (≠ from; no self-loops)
  type: EdgeType;      // from the controlled vocabulary
  metadata?: object;   // optional
}
```

## Vocabulary

| Type | Meaning (directional `from → to`) | Symmetric |
|---|---|---|
| `relates_to` | generic association | yes |
| `depends_on` | `from` requires `to` | no |
| `supersedes` | `from` replaces `to` | no |
| `contradicts` | `from` conflicts with `to` | yes |
| `derived_from` | `from` was produced from `to` | no |
| `part_of` | `from` is a component of `to` | no |

Symmetric types imply the reverse edge; `reverseEdge(edge)` returns it for
symmetric types and `null` for directional ones.

---

## API

- `EDGE_TYPES` / `isEdgeType(type)` — the vocabulary and membership check.
- `isTypedEdge(edge)` — full shape validation (string ids, known type, no
  self-loop, object metadata).
- `buildTypedEdge({from, to, type, metadata?})` — validated constructor; throws
  on unknown type, self-loop, or missing ids. Pure data, no write.
- `isSymmetric(type)` / `reverseEdge(edge)` — symmetry helpers.

---

## Examples

```js
import { buildTypedEdge, reverseEdge } from "./scripts/agentctx/adapters/edge-model.mjs";

// "decision B replaces decision A"
buildTypedEdge({ from: "decision:B", to: "decision:A", type: "supersedes" });
// → { from: "decision:B", to: "decision:A", type: "supersedes" }   (directed; reverseEdge → null)

// "this constraint conflicts with that direction"
const conflict = buildTypedEdge({ from: "constraint:no-deploy", to: "direction:ship-fast", type: "contradicts" });
reverseEdge(conflict);
// → { from: "direction:ship-fast", to: "constraint:no-deploy", type: "contradicts" }   (symmetric)

// "this summary was produced from that source note"
buildTypedEdge({ from: "note:summary", to: "note:raw", type: "derived_from", metadata: { confidence: 0.9 } });
```

There is intentionally **no `supports` edge type**. Endorsement/agreement is
modeled with `relates_to` (generic) or, where one thing replaces another, with
`supersedes` — keeping the vocabulary small and unambiguous. Adding a relation
type is a deliberate schema change, not an ad-hoc string.

---

## Boundary & safety

- **Schema only.** No persistence, no hosted call, no secret.
- **Closed vocabulary.** Unknown relation types are rejected, so a hosted graph
  cannot accumulate ad-hoc edge types from this layer.
- Feeds the `edge` proposal `payload` — and like all writeback, edges are
  proposed, never written, by the OSS layer.
