import { describe, expect, it } from "vitest";
import {
  EDGE_TYPES,
  buildTypedEdge,
  isEdgeType,
  isSymmetric,
  isTypedEdge,
  reverseEdge,
} from "../../scripts/agentctx/adapters/edge-model.mjs";

describe("typed edge model (P4-PR03)", () => {
  it("defines a controlled edge-type vocabulary", () => {
    expect(EDGE_TYPES).toContain("relates_to");
    expect(EDGE_TYPES).toContain("supersedes");
    expect(isEdgeType("depends_on")).toBe(true);
    expect(isEdgeType("deletes")).toBe(false);
  });

  it("builds a valid typed edge", () => {
    const e = buildTypedEdge({ from: "n1", to: "n2", type: "depends_on" });
    expect(isTypedEdge(e)).toBe(true);
    expect(e).toEqual({ from: "n1", to: "n2", type: "depends_on" });
  });

  it("rejects unknown types, self-loops, and missing ids", () => {
    expect(() => buildTypedEdge({ from: "a", to: "b", type: "owns" })).toThrow();
    expect(() => buildTypedEdge({ from: "a", to: "a", type: "relates_to" })).toThrow();
    expect(() => buildTypedEdge({ from: "", to: "b", type: "relates_to" })).toThrow();
  });

  it("validates edge shape", () => {
    expect(isTypedEdge({ from: "a", to: "b", type: "part_of" })).toBe(true);
    expect(isTypedEdge({ from: "a", to: "b", type: "x" })).toBe(false);
    expect(isTypedEdge({ from: "a", to: "a", type: "relates_to" })).toBe(false);
    expect(isTypedEdge({ from: "a", to: "b", type: "relates_to", metadata: "no" })).toBe(false);
  });

  it("knows which types are symmetric and derives the reverse edge", () => {
    expect(isSymmetric("relates_to")).toBe(true);
    expect(isSymmetric("depends_on")).toBe(false);

    const sym = buildTypedEdge({ from: "a", to: "b", type: "relates_to" });
    expect(reverseEdge(sym)).toEqual({ from: "b", to: "a", type: "relates_to" });

    const directed = buildTypedEdge({ from: "a", to: "b", type: "supersedes" });
    expect(reverseEdge(directed)).toBeNull();
  });
});
