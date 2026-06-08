// Mind Ontology — typed edge model (Phase 4 / P4-PR03).
//
// Shapes the `edge` writeback proposal payload (P4-PR02) and any hosted-graph
// relationship the on-ramp may carry. Pure schema + validators + a constructor;
// no I/O, no hosted call. A typed edge connects two nodes with a relation drawn
// from a small controlled vocabulary, so hosted graphs stay legible.

// Controlled edge-type vocabulary. Each is directional from `from` to `to`.
export const EDGE_TYPES = Object.freeze([
  "relates_to", // generic association
  "depends_on", // from requires to
  "supersedes", // from replaces to
  "contradicts", // from conflicts with to
  "derived_from", // from was produced from to
  "part_of", // from is a component of to
]);

// Edge types whose meaning is symmetric (A rel B implies B rel A).
export const SYMMETRIC_EDGE_TYPES = Object.freeze(["relates_to", "contradicts"]);

export function isEdgeType(type) {
  return EDGE_TYPES.includes(type);
}

export function isTypedEdge(edge) {
  if (!edge || typeof edge !== "object") return false;
  if (typeof edge.from !== "string" || edge.from.length === 0) return false;
  if (typeof edge.to !== "string" || edge.to.length === 0) return false;
  if (!isEdgeType(edge.type)) return false;
  if (edge.from === edge.to) return false; // no self-loops
  if (edge.metadata !== undefined && (typeof edge.metadata !== "object" || edge.metadata === null)) {
    return false;
  }
  return true;
}

/**
 * Construct a validated typed edge. Pure data — no write happens here.
 * @param {{from:string,to:string,type:string,metadata?:object}} input
 */
export function buildTypedEdge({ from, to, type, metadata }) {
  if (!isEdgeType(type)) {
    throw new Error(`Unknown edge type: ${type} (expected one of ${EDGE_TYPES.join(", ")})`);
  }
  if (!from || !to) throw new Error("A typed edge requires both from and to node ids");
  if (from === to) throw new Error("A typed edge cannot be a self-loop");
  const edge = { from, to, type, ...(metadata ? { metadata } : {}) };
  if (!isTypedEdge(edge)) throw new Error("Constructed an invalid typed edge");
  return edge;
}

export function isSymmetric(type) {
  return SYMMETRIC_EDGE_TYPES.includes(type);
}

/** Return the logically-implied reverse edge for symmetric types, else null. */
export function reverseEdge(edge) {
  if (!isTypedEdge(edge)) throw new Error("reverseEdge requires a valid typed edge");
  if (!isSymmetric(edge.type)) return null;
  return { from: edge.to, to: edge.from, type: edge.type, ...(edge.metadata ? { metadata: edge.metadata } : {}) };
}
