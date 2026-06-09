import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EDGE_TYPES,
  buildTypedEdge,
  isEdgeType,
  isSymmetric,
  reverseEdge,
} from "../../scripts/agentctx/adapters/edge-model.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODULE_SRC = readFileSync(
  resolve(REPO_ROOT, "scripts/agentctx/adapters/edge-model.mjs"),
  "utf8",
);

// M10 — exercise the concrete relations the on-ramp depends on and lock the
// vocabulary boundary + the no-I/O guarantee.
describe("typed edge relations: contradicts / derived_from / supersedes (M10)", () => {
  it("supersedes is directed: from replaces to, no reverse", () => {
    const e = buildTypedEdge({ from: "decision:B", to: "decision:A", type: "supersedes" });
    expect(e).toEqual({ from: "decision:B", to: "decision:A", type: "supersedes" });
    expect(isSymmetric("supersedes")).toBe(false);
    expect(reverseEdge(e)).toBeNull();
  });

  it("contradicts is symmetric: it implies the reverse edge", () => {
    const e = buildTypedEdge({ from: "constraint:no-deploy", to: "direction:ship-fast", type: "contradicts" });
    expect(isSymmetric("contradicts")).toBe(true);
    expect(reverseEdge(e)).toEqual({
      from: "direction:ship-fast",
      to: "constraint:no-deploy",
      type: "contradicts",
    });
  });

  it("derived_from is directed and carries optional metadata as pure data", () => {
    const e = buildTypedEdge({ from: "note:summary", to: "note:raw", type: "derived_from", metadata: { confidence: 0.9 } });
    expect(e).toEqual({ from: "note:summary", to: "note:raw", type: "derived_from", metadata: { confidence: 0.9 } });
    expect(isSymmetric("derived_from")).toBe(false);
    expect(reverseEdge(e)).toBeNull();
  });

  it("'supports' is intentionally NOT in the vocabulary", () => {
    expect(isEdgeType("supports")).toBe(false);
    expect(EDGE_TYPES).not.toContain("supports");
    expect(() => buildTypedEdge({ from: "a", to: "b", type: "supports" })).toThrow();
  });

  it("the edge model performs no network or hosted I/O", () => {
    expect(MODULE_SRC).not.toMatch(/\bfetch\s*\(/);
    expect(MODULE_SRC).not.toMatch(/https?:\/\//);
    expect(MODULE_SRC).not.toMatch(/\b(import|require)\b[^\n]*\bnode:(https?|net|dns)\b/);
  });
});
