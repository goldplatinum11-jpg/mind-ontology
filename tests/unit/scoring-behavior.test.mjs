import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_BLOCKS_PER_FILE,
  DEFAULT_MIN_SCORE,
  compileContext,
  scoreBlock,
} from "../../scripts/agentctx/compile.mjs";

const block = (over = {}) => ({ title: "Notes", tags: [], body: "z", index: 0, ...over });

// M48 — pin the documented scoring properties against the real scorer.
describe("block scoring weights (M48)", () => {
  it("a scope match outscores the same word as a task word, at every tier", () => {
    const tagBlock = block({ tags: ["perf"] });
    expect(scoreBlock(tagBlock, [], ["perf"])).toBeGreaterThan(scoreBlock(tagBlock, ["perf"], []));

    const headBlock = block({ title: "perf notes", tags: ["other"] });
    expect(scoreBlock(headBlock, [], ["perf"])).toBeGreaterThan(scoreBlock(headBlock, ["perf"], []));
  });

  it("tag > heading-only > body-only, and tags count toward the heading tier too", () => {
    const tag = scoreBlock(block({ tags: ["perf"] }), [], ["perf"]); // 8 (tag) + 5 (tag-as-heading) = 13
    const heading = scoreBlock(block({ title: "perf notes", tags: ["other"] }), [], ["perf"]); // 5
    const body = scoreBlock(block({ title: "notes", tags: ["other"], body: "perf z" }), [], ["perf"]); // 2
    expect(tag).toBeGreaterThan(heading);
    expect(heading).toBeGreaterThan(body);
    expect(tag).toBe(13);
  });

  it("an unmatched block scores zero", () => {
    expect(scoreBlock(block({ tags: ["x"], title: "y", body: "z" }), ["nomatch"], ["none"])).toBe(0);
  });
});

describe("selection rules (M48)", () => {
  const SOURCES = {
    "constraints.md": "# Constraints\n\n## Always #safety\n\nbe careful\n",
    "direction.md":
      "# Direction\n\n## Perf work #perf\n\nmake it fast\n\n## Other #misc\n\nwe frobnicate things rarely\n",
  };

  it("constraints.md is always included regardless of task", () => {
    const pack = compileContext({ sources: SOURCES, task: "totally unrelated", scopes: [] });
    const cons = pack.selected.filter((b) => b.file === "constraints.md");
    expect(cons.length).toBeGreaterThanOrEqual(1);
    expect(cons.every((b) => b.reason === "always" && b.score === Infinity)).toBe(true);
  });

  it("a sub-threshold body-only match is omitted, not selected", () => {
    // "frobnicate" hits only the body of the #misc block → score 1 < DEFAULT_MIN_SCORE (2).
    expect(DEFAULT_MIN_SCORE).toBe(2);
    const pack = compileContext({ sources: SOURCES, task: "frobnicate", scopes: [] });
    const selectedNonConstraint = pack.selected.filter((b) => b.file !== "constraints.md");
    expect(selectedNonConstraint.every((b) => b.title !== "Other")).toBe(true);
    expect(pack.omitted.some((b) => b.title === "Other")).toBe(true);
  });

  it("at most maxBlocksPerFile blocks are kept per scored file", () => {
    expect(DEFAULT_MAX_BLOCKS_PER_FILE).toBe(1);
    // Both direction blocks match scope "perf"/"misc"; only the top one is kept.
    const pack = compileContext({ sources: SOURCES, task: "improve things", scopes: ["perf", "misc"] });
    const dir = pack.selected.filter((b) => b.file === "direction.md");
    expect(dir.length).toBeLessThanOrEqual(DEFAULT_MAX_BLOCKS_PER_FILE);
  });
});
