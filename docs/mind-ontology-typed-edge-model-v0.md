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

## Boundary & safety

- **Schema only.** No persistence, no hosted call, no secret.
- **Closed vocabulary.** Unknown relation types are rejected, so a hosted graph
  cannot accumulate ad-hoc edge types from this layer.
- Feeds the `edge` proposal `payload` — and like all writeback, edges are
  proposed, never written, by the OSS layer.
